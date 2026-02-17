// src/utils/tokens.ts
import jwt, { JwtPayload, Secret, SignOptions, VerifyOptions } from 'jsonwebtoken';
import type { StringValue as MsStringValue } from 'ms';
import crypto from 'crypto';

import type { Role, AccessTokenPayload, RefreshTokenPayload } from '../types';

/**
 * شكل نتيجة التوقيع
 */
export interface SignedToken {
  token: string;
  expiresAt: Date;
  expiresAtMs: number;
}

// جهة الإصدار والجمهور (ثوابت مفيدة للتحقق/التنظيم)
const ISSUER = 'mishkat.api';
const AUDIENCE = 'mishkat.app';

/**
 * ✅ صيغة مدة الانتهاء المقبولة حسب @types/jsonwebtoken:
 * - number بالثواني
 * - MsStringValue مثل "15m" / "7d" ... إلخ
 */
export type ExpiresIn = number | MsStringValue;

/**
 * 🧮 يحوّل صيغة '15m'/'7d'/... إلى millis من "الآن"
 * - يدعم s/m/h/d  (ثواني/دقائق/ساعات/أيام)
 * - لو أُعطي رقم داخل string (مثلاً "3600") يُعتبر ثواني
 * - لو فشل التحويل يرجّع "الآن" (آمن)
 */
function calcExpiryFromString(expiresIn: string, now = Date.now()): number {
  const m = expiresIn.match(/^(\d+)([smhd])$/i);
  if (!m) {
    const n = Number(expiresIn);
    if (!Number.isNaN(n) && n > 0) return now + n * 1000;
    return now; // fallback آمن
  }
  const amount = Number(m[1]);
  const unit = m[2].toLowerCase();

  const unitMs =
    unit === 's' ? 1_000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : /* d */ 86_400_000;

  return now + amount * unitMs;
}

/**
 * ✍️ توقيع JWT عام
 */
export function signJwt(
  payload: string | Buffer | object,
  secret: Secret,
  expiresIn: ExpiresIn,
  opts?: Omit<SignOptions, 'expiresIn'>,
): SignedToken {
  const options: SignOptions = { ...(opts || {}) };
  if (typeof expiresIn !== 'undefined') {
    options.expiresIn = expiresIn;
  }

  const token = jwt.sign(payload, secret, options);

  const expForCalc = typeof expiresIn === 'number' ? `${expiresIn}s` : String(expiresIn);
  const expiresAtMs = calcExpiryFromString(expForCalc);

  return { token, expiresAt: new Date(expiresAtMs), expiresAtMs };
}

/**
 * 🔍 التحقق من JWT
 */
export function verifyJwt<T extends JwtPayload = JwtPayload>(
  token: string,
  secret: Secret,
  opts?: VerifyOptions,
): T {
  return jwt.verify(token, secret, opts) as T;
}

/**
 * 👀 فكّ JWT بدون تحقق توقيع (استخدمه بحذر)
 */
export function decodeJwt<T = any>(token: string): T | null {
  return jwt.decode(token) as T | null;
}

/* ========= Convenience Helpers ========= */
export function createAccessToken(
  userId: string,
  role: Role,
  secret: Secret,
  expiresIn: ExpiresIn,
  opts?: Omit<SignOptions, 'expiresIn'>,
): SignedToken {
  const payload: AccessTokenPayload & { type: 'access' } = {
    sub: userId,
    role,
    type: 'access',
  };

  return signJwt(payload, secret, expiresIn, {
    issuer: ISSUER,
    audience: AUDIENCE,
    ...opts,
  });
}

export function createRefreshToken(
  userId: string,
  secret: Secret,
  expiresIn: ExpiresIn,
  opts?: Omit<SignOptions, 'expiresIn'>,
): SignedToken {
  const payload = { sub: userId, type: 'refresh' };

  return signJwt(payload, secret, expiresIn, {
    issuer: ISSUER,
    audience: AUDIENCE,
    jwtid: crypto.randomUUID(),
    ...opts,
  });
}

/* ========= Helpers للكوكيز ========= */
export function buildCookieOptions({
  maxAgeMs,
  secure = false,
  sameSite = 'lax',
  httpOnly = true,
  domain,
  path = '/',
}: {
  maxAgeMs: number;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  httpOnly?: boolean;
  domain?: string;
  path?: string;
}) {
  return {
    maxAge: maxAgeMs,
    secure,
    sameSite,
    httpOnly,
    domain,
    path,
  } as const;
}

// /**
//  * ⏳ حساب maxAge للكوكي من صيغة expiresIn
//  */
export function cookieMaxAgeFromExpiresIn(expiresIn: ExpiresIn | string) {
  const expForCalc = typeof expiresIn === 'number' ? `${expiresIn}s` : String(expiresIn);
  return calcExpiryFromString(expForCalc) - Date.now();
}
