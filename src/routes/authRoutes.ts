// src/routes/authRoutes.ts
import express from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

import { uploadAvatarDisk } from '../middlewares/upload.disk';

import {
  register,
  verifyEmail,
  resendVerificationEmail,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
} from '../controllers/authController';

import { validateRequestBody } from '../middlewares/validate';

import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationEmailSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validations/user.schema';
// import { env } from '../config/env';

const router = express.Router();

/* ============================================================================
🛡️ Rate limit / Slowdown مخصّص لمسارات حسّاسة
- إضافة إلى أي limiter عام عاملُه على /api/v1/auth في server.ts
============================================================================ */

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 دقائق
  max: 5, // بحد أقصى 5 محاولات في الـ window
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'محاولات كثيرة جدًا. جرّب لاحقًا.' },
});

const otpSlow = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  // ✅ سلوك v2: ثبّت التأخير لكل طلب بعد الحد
  delayMs: () => 250,
  // اختياري: اسكت تحذير التحقق
  validate: { delayMs: false },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'محاولات دخول كثيرة. حاول لاحقًا.' },
});

const loginSlow = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 10,
  delayMs: () => 250,
  // اختياري: اسكت تحذير التحقق
  validate: { delayMs: false },
});

/* ============================================================================
📦 المسارات
ملاحظة: refresh/logout بيقروا/يمسحوا كوكيز، لذا مش محتاجين body validation
============================================================================ */

// 👤 إنشاء حساب جديد + توليد OTP
router.post(
  '/register',
  otpLimiter,
  otpSlow,
  uploadAvatarDisk,
  validateRequestBody(registerSchema),
  register,
);

// ✅ تأكيد البريد الإلكتروني باستخدام OTP
router.post(
  '/verify-email',
  otpLimiter,
  otpSlow,
  validateRequestBody(verifyEmailSchema),
  verifyEmail,
);

// ✉️ إعادة إرسال رمز التفعيل
router.post(
  '/resend-verification',
  otpLimiter,
  otpSlow,
  validateRequestBody(resendVerificationEmailSchema),
  resendVerificationEmail,
);

// 🔑 تسجيل الدخول
router.post('/login', loginLimiter, loginSlow, validateRequestBody(loginSchema), login);

// 🔄 تحديث الـ Access Token (يقرأ refresh_token من الكوكي)
router.post('/refresh-token', refreshToken);

// 🚪 تسجيل الخروج (يمسح الكوكيز)
router.post('/logout', logout);

// 🔁 نسيان كلمة المرور → إرسال OTP
router.post(
  '/forgot-password',
  otpLimiter,
  otpSlow,
  validateRequestBody(forgotPasswordSchema),
  forgotPassword,
);

// 🔓 تعيين كلمة مرور جديدة بعد التحقق
router.post(
  '/reset-password',
  otpLimiter,
  otpSlow,
  validateRequestBody(resetPasswordSchema),
  resetPassword,
);

export default router;
