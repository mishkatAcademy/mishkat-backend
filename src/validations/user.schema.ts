// src/validations/user.schema.ts
import { z } from 'zod';

/* ========== Helpers مشتركة ========== */

// Email normalized (lowercase + trim)
export const emailNormalized = z
  .string()
  .trim()
  .email('بريد إلكتروني غير صالح')
  .transform((e) => e.toLowerCase());

// Strong password (8+ مع تعقيد)
export const passwordStrong = z
  .string()
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  .regex(/[A-Z]/, 'يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل')
  .regex(/[a-z]/, 'يجب أن تحتوي كلمة المرور على حرف صغير واحد على الأقل')
  .regex(/\d/, 'يجب أن تحتوي كلمة المرور على رقم واحد على الأقل')
  .regex(/[@$!%*?&._\-#]/, 'يجب أن تحتوي كلمة المرور على رمز خاص واحد على الأقل مثل @ أو #');

// ObjectId صارم: 24 hex
export const objectIdStrict = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'معرّف غير صالح (يجب أن يكون 24 خانة hex)');

// Avatar URL اختياري
// export const avatarUrl = z.string().url('رابط صورة غير صالح').optional();

// Avatar URL اختياري (يتعامل مع '' و trim)
export const avatarField = z.preprocess((val) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  // لو جاي فاضي نخليه undefined علشان يعدّي كـ optional
  return trimmed === '' ? undefined : trimmed;
}, z.string().url('رابط صورة غير صالح').optional());

/* ========== AUTH ========== */

// 1) register
export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, 'الاسم الأول قصير')
      .max(20, 'الاسم الأول يجب أن يكون أقل 20 حرف'),
    lastName: z
      .string()
      .trim()
      .min(2, 'الاسم الأخير قصير')
      .max(20, 'الاسم الأخير يجب أن يكون أقل 20 حرف'),
    email: emailNormalized,
    password: passwordStrong,
    avatar: avatarField,
    // isInstructor: z.boolean().default(false).optional(), // (مُلغى لتناسق الموديل)
  })
  .strict();

// 2) verifyEmail
export const verifyEmailSchema = z
  .object({
    email: emailNormalized,
    otpCode: z.string().regex(/^\d{6}$/, 'رمز التحقق يجب أن يكون 6 أرقام'),
  })
  .strict();

// 3) resendVerificationEmail
export const resendVerificationEmailSchema = z
  .object({
    email: emailNormalized,
  })
  .strict();

// 4) login
export const loginSchema = z
  .object({
    email: emailNormalized,
    password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  })
  .strict();

// 5) forgotPassword
export const forgotPasswordSchema = z
  .object({
    email: emailNormalized,
  })
  .strict();

// 6) verifyResetOtp
// export const verifyResetOtpSchema = z
//   .object({
//     email: emailNormalized,
//     otpCode: z.string().regex(/^\d{6}$/, 'رمز التحقق يجب أن يكون 6 أرقام'),
//   })
//   .strict();

// 7) resetPassword
export const resetPasswordSchema = z
  .object({
    email: emailNormalized,
    otpCode: z.string().regex(/^\d{6}$/, 'رمز التحقق يجب أن يكون 6 أرقام'),
    newPassword: passwordStrong,
  })
  .strict();

/* ========== USER (Profile/Role/Password) ========== */

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(2, 'قصير').max(50, 'طويل').optional(),
    lastName: z.string().trim().min(2, 'قصير').max(50, 'طويل').optional(),
    avatar: avatarField,
  })
  .strict()
  .refine(
    (data) =>
      (data.firstName && data.firstName.trim() !== '') ||
      (data.lastName && data.lastName.trim() !== '') ||
      !!data.avatar,
    {
      message: 'يرجى إدخال حقل واحد على الأقل للتحديث',
    },
  );

export const updateUserRoleSchema = z
  .object({
    role: z.enum(['student', 'instructor', 'admin']),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .nonempty('كلمة المرور الحالية مطلوبة')
      .min(8, 'كلمة المرور الحالية يجب أن تكون 8 أحرف على الأقل'),
    newPassword: passwordStrong,
  })
  .strict();

/* ========== Params ========== */

// /users/:id
export const userIdParamsSchema = z
  .object({
    id: objectIdStrict,
  })
  .strict();

/* ========== Query (Search/Filter) ========== */
/**
 * متوافق مع searchHelper.ts:
 * - page/limit أرقام
 * - sortBy أبيض-قائمة لتفادي حقن مفاتيح فرز خبيثة
 * - order asc/desc
 * - isDeleted/isInstructor كـ boolean
 * - afterId (كسرسور) + regexMode/useTextSearch/textLanguage (اختياري)
 */
const SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'firstName',
  'lastName',
  'email',
  'role',
] as const;

export const userSearchQuerySchema = z
  .object({
    searchTerm: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
    sortBy: z.enum(SORTABLE_FIELDS).optional(),
    order: z.enum(['asc', 'desc']).optional(),

    isDeleted: z.coerce.boolean().optional(),
    // isInstructor: z.coerce.boolean().optional(), // موجود للفلترة لو رجّعناه/لازال في الداتا

    // توافق مع searchHelper.ts (اختياري)
    afterId: objectIdStrict.optional(),
    regexMode: z.enum(['contains', 'prefix', 'suffix']).optional(),
    useTextSearch: z.coerce.boolean().optional(),
    textLanguage: z.enum(['ar', 'en']).optional(),
  })
  .strict();
