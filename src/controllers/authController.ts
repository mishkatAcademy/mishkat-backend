// src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import type { Express } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok, created } from '../utils/response';
import { AppError } from '../utils/AppError';

import { moveDiskFileToUploads } from '../services/localFiles.disk';

import {
  registerService,
  verifyEmailService,
  resendVerificationEmailService,
  loginService,
  refreshTokenService,
  getMeService,
  logoutService,
  forgotPasswordService,
  resetPasswordService,
} from '../services/authService';

import { COOKIE_NAMES } from '../utils/setAuthCookies';

/*
| الوظيفة   |             الوصف                                               |
| ------------------ | -----------------------------------------------------   |
| `register()`       | إنشاء مستخدم جديد                                      |
| `verifyEmail()`    | تأكيد البريد الإلكتروني (لو النظام يتطلب ذلك)         |
| `resendVerificationEmail()`| إعادة ارسال ايميل تأكيد البريد الإلكتروني     |

| `login()`          | تسجيل الدخول والتحقق من الإيميل والباسورد             |
| `refreshToken()`   | إعادة توليد توكن جديد (لو بتستخدم JWT Refresh Tokens) |
| `logout()`         | تسجيل الخروج (اختياري حسب نظام الجلسات أو التوكن)    |

| `forgotPassword()` | إرسال رابط إعادة تعيين كلمة المرور                    |
| `verifyResetOtp()` | التأكد من صحة رابط إعادة تعيين كلمة المرور           |
| `resetPassword()`  | تنفيذ عملية تغيير كلمة المرور                         |
*/

// 🆕 تسجيل مستخدم
export const register = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
  const avatarFile = files.avatar?.[0];

  // لو المستخدم بعت URL جاهز في body
  let avatarUrl: string | undefined = (req.body as any)?.avatar;
  let avatarRelPath: string | undefined;

  if (avatarFile) {
    const up = await moveDiskFileToUploads(avatarFile, 'avatars');
    avatarUrl = up.url;
    avatarRelPath = up.relPath;
  }

  const { firstName, lastName, email, password } = req.body as any;

  const { wasRestored } = await registerService({
    firstName,
    lastName,
    email,
    password,
    avatarUrl,
    avatarRelPath,
  });

  const message = wasRestored
    ? 'تم استعادة الحساب، يرجى إدخال رمز التفعيل المرسل إلى بريدك.'
    : 'تم إنشاء الحساب. يرجى إدخال رمز التفعيل المرسل إلى بريدك.';

  return created(res, { message });
});

// ✅ تفعيل البريد الإلكتروني
export const verifyEmail = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { email, otpCode } = req.body;
  await verifyEmailService({ email, otpCode });
  return ok(res, { message: 'تم تأكيد البريد الإلكتروني بنجاح ✅' });
});

// ✉️ إعادة إرسال رمز التفعيل
export const resendVerificationEmail = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { email } = req.body;
    await resendVerificationEmailService(email);
    return ok(res, { message: 'تم إرسال رمز التفعيل بنجاح ✅' });
  },
);

// 🔐 تسجيل الدخول
export const login = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { email, password } = req.body;
  const user = await loginService({ email, password }, res);
  return ok(res, { message: 'تم تسجيل الدخول بنجاح ✅', user });
});

// ♻️ تحديث التوكن (Access من Refresh)
export const refreshToken = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const token = String(req.cookies?.[COOKIE_NAMES.refresh] || '');
  await refreshTokenService(token, res);
  return ok(res, { message: 'تم تحديث التوكن بنجاح ✅' });
});

// 👤 جلب المستخدم الحالي
export const getMe = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user?.id) {
    throw AppError.unauthorized('غير مصرح: المستخدم غير موجود');
  }

  const user = await getMeService(req.user.id);
  return ok(res, { user });
});

// 🚪 تسجيل الخروج
export const logout = catchAsync(async (_req: Request, res: Response, _next: NextFunction) => {
  logoutService(res);
  return ok(res, { message: 'تم تسجيل الخروج بنجاح ✅' });
});

// 🔁 نسيت كلمة المرور (إرسال OTP)
export const forgotPassword = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { email } = req.body;
    await forgotPasswordService(email);
    return ok(res, { message: 'تم إرسال رمز استعادة كلمة المرور إلى بريدك الإلكتروني' });
  },
);

// 🔑 تعيين كلمة مرور جديدة
export const resetPassword = catchAsync(async (req, res) => {
  const { email, otpCode, newPassword } = req.body;
  await resetPasswordService(email, otpCode, newPassword);
  return ok(res, { message: 'تم تغيير كلمة المرور بنجاح ✅' });
});
