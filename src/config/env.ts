// src/config/env.ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * ملاحظة:
 * - الاتصال بـ Mongo يتم من خلال متغير واحد موحّد:
 *   MONGODB_URI
 *   مثال محلي:
 *   mongodb://127.0.0.1:27017/mishkat?directConnection=true
 * - أضفنا APP_BASE_URL (لازم لروابط /uploads).
 */

/**
 * ✅ تعريف الـ schema بكل المتغيّرات
 * - استخدمنا z.coerce.number() للأرقام كي نقبل strings من .env
 * - ACCESS/REFRESH_TOKEN_EXPIRES_IN بصيغة "15m" أو "7d" (Regex بسيط)
 * - أضفنا مفاتيح الاستشارات: HOLD_TTL/MIN_NOTICE/MAX_ADVANCE/BUFFER/CANCEL_WINDOW
 */
const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  APP_URL: z.string().url().default('http://localhost:3000'),
  // APP_BASE_URL: z.string().url().default('http://localhost:5000'),
  APP_BASE_URL: z.string().url().default('http://localhost:5000'),
  NGINX_SECURE_LINK_SECRET: z.string().min(1, 'NGINX_SECURE_LINK_SECRET is required'),
  NGINX_SECURE_LINK_TTL_SECONDS: z.coerce.number().int().min(30).max(86400).default(600),

  APP_NAME: z.string().default('Mishkat Academy'),

  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\/.+/i, 'MONGODB_URI must start with mongodb:// or mongodb+srv://'),

  //   MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  //   MONGO_DB_NAME: z.string().min(1, 'MONGO_DB_NAME is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be ≥ 32 chars'),
  REFRESH_TOKEN_SECRET: z.string().min(64, 'REFRESH_TOKEN_SECRET must be ≥ 64 chars'),

  // بصيغة مثل: "15m", "7d", "3600s"
  ACCESS_TOKEN_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/i)
    .default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/i)
    .default('7d'),

  // CORS: إمّا "*" أو قائمة مفصولة بفواصل
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 دقيقة
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  GRACEFUL_TIMEOUT_MS: z.coerce.number().default(10_000),

  // الدفع
  MOYASAR_API_KEY: z.string().min(1, 'MOYASAR_API_KEY is required'),
  CURRENCY: z.enum(['SAR', 'USD', 'EUR']).default('SAR'),
  MOYASAR_SUCCESS_URL: z.string().url().optional(),
  MOYASAR_FAIL_URL: z.string().url().optional(),
  WEBHOOK_SECRET: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  JSON_BODY_LIMIT: z.string().default('2mb'), // متوافق مع .env عندك

  // 🛒 الأوردر/المتجر
  VAT_PERCENT: z.coerce.number().min(0).max(100).default(15),
  SHIPPING_FLAT_HALALAS: z.coerce.number().int().min(0).default(0),

  // REDIS (اختياري)
  // يقبل عدم التعيين أو قيمة فارغة، ويتأكد لو موجودة تبدأ بـ redis:// أو rediss://
  REDIS_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length ? v.trim() : undefined))
    .refine(
      (v) => !v || /^(redis|rediss):\/\//i.test(v),
      'REDIS_URL must start with redis:// or rediss://',
    ),

  // 📎 الرفع
  UPLOAD_MAX_MB: z.coerce.number().positive().default(10),

  // 🧑‍⚕️ الاستشارات (القيم الافتراضية مناقشة سابقة)
  CONSULTATION_HOLD_TTL_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  CONSULTATION_MIN_NOTICE_HOURS: z.coerce.number().int().min(0).max(240).default(24),
  CONSULTATION_MAX_ADVANCE_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CONSULTATION_BUFFER_MINUTES: z.coerce.number().int().min(0).max(180).default(10),
  CONSULTATION_CANCEL_WINDOW_HOURS: z.coerce.number().int().min(0).max(240).default(24),

  // خدمة Resend لإرسال الإيميلات
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  RESEND_FROM_EMAIL: z.string().email('RESEND_FROM_EMAIL must be a valid email'),
  RESEND_FROM_NAME: z.string().min(1).default('Mishkat Academy'),

  // 👑 Seed Admin (اختياري)
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_ADMIN_FIRSTNAME: z.string().min(1).optional().default('Admin'),
  SEED_ADMIN_LASTNAME: z.string().min(1).optional().default('User'),
  SEED_ADMIN_VERIFY_EMAIL: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v === 'true'),
  SEED_ADMIN_UPDATE_NAME: z
    .string()
    .optional()
    .transform((v) => String(v || '').toLowerCase() === 'true')
    .default('false' as any),

  SEED_ADMIN_RESET_PASSWORD: z
    .string()
    .optional()
    .transform((v) => String(v || '').toLowerCase() === 'true')
    .default('false' as any),
});

const parsed = baseSchema.safeParse(process.env);
// const _env = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// اشتقاق MONGODB_URI الموحد
const d = parsed.data;
const derivedMONGODB = d.MONGODB_URI?.trim();

if (!derivedMONGODB) {
  console.error('❌ You must set MONGODB_URI in .env');
  process.exit(1);
}

// نصدّر env موحّد + MONGODB_URI
export const env = {
  ...d,
  MONGODB_URI: derivedMONGODB,
};

// Helpers
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

// لأننا بنستخدم كوكيز
export const allowCredentials = true;

/** origins:
 *  - '*' تعني السماح للجميع
 *  - غير ذلك: نفصل بالقُطوع وننظّف الفراغات ونهمل الفارغ
 */
export const corsOrigins =
  env.CORS_ORIGINS === '*'
    ? '*'
    : env.CORS_ORIGINS.split(',')
        .map((s) => s.trim())
        .filter(Boolean);

// export const env = _env.data;
