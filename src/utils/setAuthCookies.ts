// src/utils/setAuthCookies.ts
import type { Response } from 'express';
import { env } from '../config/env';
import { buildCookieOptions, cookieMaxAgeFromExpiresIn } from './tokens';

function getCookieDomainFromAppUrl(): string | undefined {
  try {
    const host = new URL(env.APP_URL).hostname; // ex: 'localhost' or 'yourfrontend.com'
    // في dev بلاش domain علشان localhost يبقى أسهل
    if (env.NODE_ENV !== 'production') return undefined;
    // في الإنتاج: لو عايز دومين رئيسي (بدون subdomain) عدّله هنا حسب احتياجك
    return host;
  } catch {
    return undefined;
  }
}

const COOKIE_NAMES = {
  access: 'access_token',
  refresh: 'refresh_token',
} as const;

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const domain = getCookieDomainFromAppUrl();

  // نحسب maxAge من env (مثلاً '15m' → ms)
  const accessMaxAge = cookieMaxAgeFromExpiresIn(env.ACCESS_TOKEN_EXPIRES_IN);
  const refreshMaxAge = cookieMaxAgeFromExpiresIn(env.REFRESH_TOKEN_EXPIRES_IN);

  // إعدادات مشتركة
  const common = {
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE, // 'lax' | 'strict' | 'none'
    httpOnly: true,
    domain,
    path: '/',
  } as const;

  res.cookie(
    COOKIE_NAMES.access,
    accessToken,
    buildCookieOptions({ ...common, maxAgeMs: accessMaxAge }),
  );

  res.cookie(
    COOKIE_NAMES.refresh,
    refreshToken,
    buildCookieOptions({ ...common, maxAgeMs: refreshMaxAge }),
  );
}

export function clearAuthCookies(res: Response) {
  const domain = getCookieDomainFromAppUrl();
  const common = {
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    httpOnly: true,
    domain,
    path: '/',
  } as const;

  // مسح الكوكيز بإعادة ضبطها فاضية ومنتهية
  res.clearCookie(COOKIE_NAMES.access, common);
  res.clearCookie(COOKIE_NAMES.refresh, common);
}

export { COOKIE_NAMES };
