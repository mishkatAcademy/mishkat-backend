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
  role, // هنطنّشه هنا لأمان أعلى، ما نديش role من الـ register
  avatarUrl,
  avatarRelPath,
}: RegisterInput): Promise<{ wasRestored: boolean }> => {
  const normalizedEmail = email.trim().toLowerCase();

  // 1) هل يوجد مستخدم بنفس الإيميل (سواء active أو soft-deleted)؟
  const existing = await User.findOne({ email: normalizedEmail }).select(
    '+emailOtpCode +resetOtpCode',
  );

  // 2) توليد OTP
  const { code, expiresAt } = generateOtp({ minutes: 10 });
  const hash = await hashOtp(code);

  // 3) لو موجود ومش محذوف → ممنوع التسجيل بنفس الإيميل
  if (existing && !existing.isDeleted) {
    throw new AppError('البريد الإلكتروني مستخدم من قبل', 409);
  }

  // 4) لو موجود وهو soft-deleted → إعادة إحياء الحساب وتحديث بياناته
  if (existing && existing.isDeleted) {
    existing.firstName = firstName.trim();
    existing.lastName = lastName.trim();

    // نعتبر إن التسجيل الجديد = باسورد جديدة
    existing.password = password;

    // تحديث الأفاتار لو جاي من الفورم
    if (avatarUrl) {
      existing.avatarUrl = avatarUrl;
      existing.avatarRelPath = avatarRelPath;
    }

    existing.isDeleted = false;

    // نرجّع فلو تفعيل الإيميل من الأول
    existing.isEmailVerified = false;
    existing.emailOtpCode = hash;
    existing.emailOtpExpires = expiresAt;

    // تنظيف أي reset OTP قديمة
    existing.resetOtpCode = undefined;
    existing.resetOtpExpires = undefined;

    await existing.save();

    await sendEmailVerificationOtp(normalizedEmail, code);
    return { wasRestored: true };
  }

  // 5) لا يوجد مستخدم بهذا الإيميل → إنشاء جديد
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
    // اختياري: لو حابب تفضل تستخدم avatar في الفرونت:
    // avatar: user.avatarUrl,
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

  // أنشئ Access جديد
  const access = createAccessToken(
    String(user._id),
    user.role,
    env.JWT_SECRET,
    env.ACCESS_TOKEN_EXPIRES_IN as ExpiresIn,
  );

  // أعد وضع الكوكيز (refresh نفسه بدون تغيير)
  setAuthCookies(res, access.token, token);
};

/* ================================ Logout ============================== */
export const logoutService = (res: Response) => {
  clearAuthCookies(res); // يستخدم أسماء الكوكيز الموحّدة وقيم sameSite/secure من env
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
