// src/utils/generateOtp.ts
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export interface GenerateOtpOptions {
  minutes?: number;
  length?: number;
}

export interface OtpResult {
  code: string;
  expiresAt: Date;
  expiresAtMs: number;
  ttlMs: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function generateOtp(options: GenerateOtpOptions = {}): OtpResult {
  const minutes = clamp(Math.floor(options.minutes ?? 10), 1, 60); // 1..60
  const length = clamp(Math.floor(options.length ?? 6), 4, 12); // 4..12

  const max = 10 ** length;
  const n = crypto.randomInt(0, max); // [0, max)
  const code = n.toString().padStart(length, '0'); // الحفاظ على الأصفار البادئة

  const ttlMs = minutes * 60 * 1000;
  const expiresAtMs = Date.now() + ttlMs;

  return {
    code,
    expiresAt: new Date(expiresAtMs),
    expiresAtMs,
    ttlMs,
  };
}

/** تشفير الـ OTP للتخزين في DB أفضل من تخزينه خام */
export async function hashOtp(code: string, saltRounds = 10): Promise<string> {
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(code, salt);
}

/** التحقق من الـ OTP (مقارنة ثابتة الزمن داخل bcrypt) */
export async function verifyOtp(code: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(code, hashed);
}

/** هل الكود منتهي؟ */
export function isOtpExpired(expiresAt: Date | null | undefined): boolean {
  if (!(expiresAt instanceof Date)) return true;
  return expiresAt.getTime() <= Date.now();
}

/** إخفاء الكود في اللوج (يُظهر آخر رقمين فقط) */
// لا نحتاجها الآن
export function maskOtpForLogs(code: string): string {
  const s = String(code ?? '');
  if (s.length <= 2) return '**';
  return `${'*'.repeat(s.length - 2)}${s.slice(-2)}`;
}
