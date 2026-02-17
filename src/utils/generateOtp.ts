// src/utils/generateOtp.ts
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export interface GenerateOtpOptions {
  /** صلاحية الكود بالدقائق (الافتراضي 10، ويُقيَّد بين 1 و 60) */
  minutes?: number;
  /** طول الكود الرقمي (الافتراضي 6، ويُقيَّد بين 4 و 12) */
  length?: number;
}

export interface OtpResult {
  /** ⚠️ لا تسجّله في اللوجز/المونيتورينج */
  code: string;
  /** وقت الانتهاء */
  expiresAt: Date;
  /** وقت الانتهاء بالملّي ثانية (مفيد للتخزين/الحساب) */
  expiresAtMs: number;
  /** المدة بالملّي ثانية */
  ttlMs: number;
}

/** قيد آمن لقيم رقمية ضمن مدى محدد */
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** توليد كود OTP رقمي آمن تشفيرياً (موحّد التوزيع) */
export function generateOtp(options: GenerateOtpOptions = {}): OtpResult {
  const minutes = clamp(Math.floor(options.minutes ?? 10), 1, 60); // 1..60
  const length = clamp(Math.floor(options.length ?? 6), 4, 12); // 4..12

  // حدود الرقم: 0000.. → 10^(length)-1
  const max = 10 ** length; // آمن حتى length=12 (≤ 1e12)
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

/** تجزئة الـ OTP للتخزين في DB بدل ما نخزّنه خام */
export async function hashOtp(code: string, saltRounds = 10): Promise<string> {
  // 8–10 كافية للكود قصير العمر؛ ارفعها لو عندك موارد CPU كافية
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(code, salt);
}

/** التحقق من الـ OTP (مقارنة ثابتة الزمن داخل bcrypt) */
export async function verifyOtp(code: string, hashed: string): Promise<boolean> {
  // لو الـ hashed فاسد/فاضي، bcrypt هيرجع false
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
