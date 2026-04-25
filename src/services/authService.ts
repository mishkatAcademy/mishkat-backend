// src/services/authService.ts
import { Response } from 'express';
import User from '../models/User';
import { sendEmailVerificationOtp, sendPasswordResetOtp } from '../utils/email/authEmails';

import type { LoginInput, RegisterInput } from '../types/auth.types';

import {
  generateOtp,
  hashOtp,
  verifyOtp,
  isOtpExpired,
  maskOtpForLogs,
} from '../utils/generateOtp';

import { AppError } from '../utils/AppError';
import { createAccessToken, createRefreshToken, ExpiresIn, verifyJwt } from '../utils/tokens';
import { setAuthCookies, clearAuthCookies } from '../utils/setAuthCookies';
import { env, isProd } from '../config/env';

/* ============================== Register ============================== */
export const registerService = async ({
  firstName,
  lastName,
  email,
  password,
  role,
  avatarUrl,
  avatarRelPath,
}: RegisterInput): Promise<{ wasRestored: boolean }> => {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail }).select(
    '+emailOtpCode +resetOtpCode',
  );

  const { code, expiresAt } = generateOtp({ minutes: 10 });
  const hash = await hashOtp(code);

  if (existing && !existing.isDeleted) {
    throw new AppError('البريد الإلكتروني مستخدم من قبل', 409);
  }

  if (existing && existing.isDeleted) {
    existing.firstName = firstName.trim();
    existing.lastName = lastName.trim();

    existing.password = password;

    if (avatarUrl) {
      existing.avatarUrl = avatarUrl;
      existing.avatarRelPath = avatarRelPath;
    }

    existing.isDeleted = false;

    existing.isEmailVerified = false;
    existing.emailOtpCode = hash;
    existing.emailOtpExpires = expiresAt;

    existing.resetOtpCode = undefined;
    existing.resetOtpExpires = undefined;

    await existing.save();

    await sendEmailVerificationOtp(normalizedEmail, code);
    return { wasRestored: true };
  }

  await User.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    password,
    avatarUrl,
    avatarRelPath,
    isEmailVerified: false,
    emailOtpCode: hash,
    emailOtpExpires: expiresAt,
  });

  await sendEmailVerificationOtp(normalizedEmail, code);
  return { wasRestored: false };
};

/* ============================ Verify Email ============================ */
export const verifyEmailService = async ({
  email,
  otpCode,
}: {
  email: string;
  otpCode: string;
}) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+emailOtpCode +emailOtpExpires',
  );

  if (!user || user.isDeleted) throw new AppError('هذا الإيميل غير مسجل', 404);
  if (user.isEmailVerified) throw new AppError('هذا الإيميل مفعل بالفعل', 400);

  const expired = !user.emailOtpCode || isOtpExpired(user.emailOtpExpires);
  const ok = !expired && (await verifyOtp(otpCode, user.emailOtpCode!));
  if (!ok) throw new AppError('كود التحقق غير صحيح أو منتهي الصلاحية', 400);

  user.isEmailVerified = true;
  user.emailOtpCode = undefined;
  user.emailOtpExpires = undefined;
  await user.save();
};

/* ============== Resend Verification Email (جديد/مطلوب) ============== */
export const resendVerificationEmailService = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) throw new AppError('هذا البريد غير مسجل', 404);
  if (user.isDeleted) throw new AppError('الحساب معطل', 403);
  if (user.isEmailVerified) throw new AppError('البريد الإلكتروني مفعل بالفعل', 400);

  const { code, expiresAt } = generateOtp({ minutes: 10 });
  user.emailOtpCode = await hashOtp(code);
  user.emailOtpExpires = expiresAt;
  await user.save();

  await sendEmailVerificationOtp(normalizedEmail, code);
};

/* ================================ Login =============================== */
export const loginService = async ({ email, password }: LoginInput, res: Response) => {
  if (!email || !password) throw new AppError('يرجى إدخال البريد الإلكتروني وكلمة المرور', 400);

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) throw new AppError('المستخدم غير موجود', 404);
  if (user.isDeleted) throw new AppError('هذا الحساب محذوف', 403);

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError('كلمة المرور غير صحيحة', 401);
  if (!user.isEmailVerified)
    throw new AppError('يرجى تفعيل بريدك الإلكتروني قبل تسجيل الدخول', 403);

  // Access + Refresh (tokens.ts)
  const access = createAccessToken(
    String(user._id),
    user.role,
    env.JWT_SECRET,
    env.ACCESS_TOKEN_EXPIRES_IN as ExpiresIn,
  );

  const refresh = createRefreshToken(
    String(user._id),
    env.REFRESH_TOKEN_SECRET,
    env.REFRESH_TOKEN_EXPIRES_IN as ExpiresIn,
  );
  // كوكيز موحّدة
  setAuthCookies(res, access.token, refresh.token);

  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
};

/* ======================== Refresh Access Token ======================== */
export const refreshTokenService = async (token: string, res: Response) => {
  if (!token) throw new AppError('لا يوجد Refresh Token', 401);

  // تحقّق من الـ refresh
  const payload = verifyJwt<{ sub: string }>(token, env.REFRESH_TOKEN_SECRET);
  const userId = payload?.sub;
  if (!userId) throw new AppError('المعرف غير موجود في التوكن', 400);

  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new AppError('المستخدم غير موجود أو محذوف', 404);

  // إنشاء Access جديد
  const access = createAccessToken(
    String(user._id),
    user.role,
    env.JWT_SECRET,
    env.ACCESS_TOKEN_EXPIRES_IN as ExpiresIn,
  );

  setAuthCookies(res, access.token, token);
};

/* ================================ Get Me ============================== */
export const getMeService = async (userId: string) => {
  if (!userId) throw new AppError('معرّف المستخدم غير موجود', 400);

  const user = await User.findById(userId)
    .select('_id firstName lastName email role avatarUrl isEmailVerified phoneNumber isDeleted')
    .lean();

  if (!user || user.isDeleted) {
    throw new AppError('المستخدم غير موجود أو محذوف', 404);
  }

  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isEmailVerified: user.isEmailVerified,
    phoneNumber: user.phoneNumber,
  };
};

/* ================================ Logout ============================== */
export const logoutService = (res: Response) => {
  clearAuthCookies(res);
};

/* ============================ Forgot Password ========================= */
export const forgotPasswordService = async (email: string) => {
  if (!email) throw new AppError('يرجى إدخال البريد الإلكتروني', 400);

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.isDeleted) {
    throw new AppError('لا يوجد مستخدم بهذا البريد الإلكتروني', 404);
  }

  const { code, expiresAt } = generateOtp({ minutes: 10 });
  user.resetOtpCode = await hashOtp(code);
  user.resetOtpExpires = expiresAt;
  await user.save();

  // تم حذف الدالة -- كانت تستخدم للتجربة في الديف
  // printOtpToConsole(normalizedEmail, code, 'reset');
  await sendPasswordResetOtp(normalizedEmail, code);
};

/* ============================= Reset Password =========================
 * الفلو الجديد: خطوة واحدة بعد forgot-password
 * يستقبل: email + otpCode + newPassword
 */
export const resetPasswordService = async (email: string, otpCode: string, newPassword: string) => {
  if (!email || !otpCode || !newPassword) {
    throw new AppError('يرجى إدخال البريد الإلكتروني، رمز التحقق، وكلمة المرور الجديدة', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+password +resetOtpCode +resetOtpExpires',
  );

  if (!user || user.isDeleted) throw new AppError('المستخدم غير موجود', 404);

  const expired = !user.resetOtpCode || isOtpExpired(user.resetOtpExpires);
  const ok = !expired && (await verifyOtp(otpCode, user.resetOtpCode!));
  if (!ok) throw new AppError('رمز الاستعادة غير صالح أو منتهي', 400);

  user.password = newPassword;
  user.resetOtpCode = undefined;
  user.resetOtpExpires = undefined;
  await user.save();
};
