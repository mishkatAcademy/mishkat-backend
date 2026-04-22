// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';
import { verifyJwt } from '../utils/tokens';
import { env } from '../config/env';
import { COOKIE_NAMES } from '../utils/setAuthCookies';
import User from '../models/User';

import type { Role } from '../types';

/**
 * يستخرج الـ Access Token من:
 * 1) Authorization: Bearer <token>  (مرن في المسافات/حالة الأحرف)
 * 2) كوكي اسمها COOKIE_NAMES.access
 * 3) (اختياري) فالباك لاسم شائع 'access_token'
 *
 * يرجّع null لو مفيش توكن صالح.
 */
export function getAccessToken(req: Request): string | null {
  // (1) header
  const authFromGet = req.get('authorization'); // string | undefined
  // احتياط نادر لو حد حقن الهيدر بحروف كبيرة بشكل غير قياسي
  const rawAuth = authFromGet ?? (req.headers as any)?.Authorization;

  if (rawAuth) {
    const authVal = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    if (typeof authVal === 'string') {
      // Bearer <token> مع مسافات مرنة
      const m = authVal.match(/^Bearer\s+(.+)$/i);
      if (m) {
        const token = m[1].trim();
        if (token) return token;
      }
    }
  }

  // (2) الكوكي القياسية للمشروع
  const fromCookie = req.cookies?.[COOKIE_NAMES.access];
  if (typeof fromCookie === 'string' && fromCookie.trim()) {
    return fromCookie.trim();
  }

  const fallback = req.cookies?.['access_token'];
  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback.trim();
  }

  return null;
}

/**
 * ✅ protect: يتأكد من وجود Access Token صالح،
 *   ويتحقق من المستخدم في قاعدة البيانات (وليس محذوفًا)
 * - يتحقّق إن type === 'access' لو موجود
 * - يقرأ userId من sub (أو id كـ fallback)
 * - يحقن req.user = { id, role }
 *
 * ملاحظات:
 * - verifyJwt هيرمي خطأ لو التوكن باطل/منتهي — بينتهي في error handler كـ 401/403 حسب AppError.
 * - التحقق من DB مهم عشان نمنع دخول حسابات معمولة لها soft-delete.
 */
export async function protect(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getAccessToken(req);
    if (!token) throw AppError.unauthorized('غير مصرح: لا يوجد توكن وصول');

    // ملهاش لازمة اللي معمول كافي ويؤدي الغرض
    // const payload = verifyJwt(token, env.JWT_SECRET, { issuer: 'mishkat.api', audience: 'mishkat.app' });
    const payload = verifyJwt(token, env.JWT_SECRET);

    if ((payload as any).type && (payload as any).type !== 'access') {
      throw AppError.unauthorized('توكن غير صالح');
    }

    const userId = (payload as any).sub || (payload as any).id;
    const role = (payload as any).role as Role | undefined;
    if (!userId) throw AppError.unauthorized('توكن بلا معرّف مستخدم');

    const user = await User.findById(userId).select('_id role isDeleted').lean();
    if (!user || user.isDeleted) {
      throw AppError.forbidden('الحساب غير متاح أو محذوف');
    }

    (req as any).user = { id: String(user._id), role: user.role as Role };
    return next();
  } catch (err) {
    return next(err);
  }
}

/** ✅ isAdmin: يسمح فقط للأدمن */
export function isAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return next(AppError.forbidden('يتطلب صلاحية أدمن'));
  }
  return next();
}

/**
 * ✅ requireRole: قيد الوصول على مجموعة أدوار
 * مثال: router.get('/x', protect, requireRole('instructor','admin'), handler)
 * معمواة علشان ممكن نحتاجها في version II إن شاء الله 
 * لم تستخدم
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized('غير مصرح'));
    if (!roles.includes(req.user.role as Role)) {
      return next(AppError.forbidden('صلاحية غير كافية'));
    }
    return next();
  };
}
