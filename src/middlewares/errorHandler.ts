// src/middlewares/errorHandler.ts
/**
 * ✅ نظام أخطاء موحّد وقابل للتوسّع
 * - notFound: أي مسار غير موجود → 404
 * - errorConverter: يحوّل أخطاء شائعة إلى AppError موحّد (Zod/Mongoose/JWT/Multer/JSON/CORS/Rate Limit/Route Pattern)
 * - errorHandler: إخراج JSON نظيف + لوج مناسب + requestId
 *
 * 💡 ملاحظات:
 * - يعتمد على AppError (فيه: statusCode, status, code, cause, details, isOperational)
 * - يستخدم env.NODE_ENV للتمييز بين التطوير والإنتاج
 * - يدعم requestId من pino-http (req.id) أو هيدر x-request-id
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Error as MongooseError } from 'mongoose';
import multer from 'multer';
import { AppError, isAppError } from '../utils/AppError';
import { env } from '../config/env';

/* --------------------------- Multer → AppError --------------------------- */
function fromMulterError(err: multer.MulterError) {
  const map: Record<string, { status: number; code: string; message: string }> = {
    LIMIT_FILE_SIZE: { status: 413, code: 'E_MULTER_FILE_SIZE', message: 'حجم الملف كبير جدًا' },
    LIMIT_FILE_COUNT: {
      status: 400,
      code: 'E_MULTER_FILE_COUNT',
      message: 'تم تجاوز عدد الملفات المسموح',
    },
    LIMIT_PART_COUNT: {
      status: 400,
      code: 'E_MULTER_PART_COUNT',
      message: 'تم تجاوز عدد الأجزاء في الطلب',
    },
    LIMIT_FIELD_COUNT: {
      status: 400,
      code: 'E_MULTER_FIELD_COUNT',
      message: 'تم تجاوز عدد الحقول المسموح',
    },
    LIMIT_UNEXPECTED_FILE: {
      status: 400,
      code: 'E_MULTER_UNEXPECTED_FILE',
      message: 'تم رفع ملف بحقل غير متوقع',
    },
    LIMIT_FIELD_KEY_TOO_LONG: {
      status: 400,
      code: 'E_MULTER_FIELD_KEY_LONG',
      message: 'اسم الحقل طويل جدًا',
    },
    LIMIT_FIELD_VALUE_TOO_LONG: {
      status: 400,
      code: 'E_MULTER_FIELD_VALUE_LONG',
      message: 'قيمة الحقل طويلة جدًا',
    },
  };

  const m = map[err.code] || {
    status: 400,
    code: 'E_MULTER',
    message: err.message || 'خطأ في رفع الملفات',
  };
  return new AppError(m.message, m.status, { code: m.code });
}

/* ----------------------------- Request Id ------------------------------ */
function getRequestId(req: Request) {
  // pino-http يضيف req.id
  return (req as any).id || (req.headers['x-request-id'] as string | undefined);
}

/* --------------------------- 404 Not Found ----------------------------- */
export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(AppError.notFound(`Not found: ${req.originalUrl}`, 'E_NOT_FOUND'));
};

/* -------------------------- Error Converter ---------------------------- */
/**
 * يحوّل أغلب الأنواع المعروفة من الأخطاء إلى AppError موحّد.
 *   app.use(errorConverter);
 *   app.use(errorHandler);
 */
export const errorConverter = (err: any, _req: Request, _res: Response, next: NextFunction) => {
  // 0) لو بالفعل AppError → مرّره كما هو
  if (isAppError(err)) return next(err);

  // 1) JSON parse (body-parser)
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return next(AppError.badRequest('Invalid JSON body', 'E_JSON_PARSE'));
  }

  // 1.1) Payload too large (413)
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return next(new AppError('Payload too large', 413, { code: 'E_PAYLOAD_TOO_LARGE' }));
  }

  // 2) Zod (Validation)
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      path: i.path,
      message: i.message,
      code: i.code,
    }));
    return next(AppError.badRequest('Invalid request', 'E_ZOD_VALIDATION', details));
  }

  // 3) JWT
  if (err?.name === 'JsonWebTokenError') {
    return next(AppError.unauthorized('Invalid token', 'E_JWT_INVALID'));
  }
  if (err?.name === 'TokenExpiredError') {
    return next(new AppError('Token expired', 401, { code: 'E_JWT_EXPIRED' }));
  }
  if (err?.name === 'NotBeforeError') {
    return next(new AppError('Token not active yet (nbf)', 401, { code: 'E_JWT_NBF' }));
  }

  // 4) CORS
  if (err?.message === 'Not allowed by CORS') {
    return next(new AppError('CORS: Origin not allowed', 403, { code: 'E_CORS_FORBIDDEN' }));
  }

  // 5) Mongoose Cast Error (ObjectId invalid)
  if (err instanceof MongooseError.CastError) {
    const path = err.path ?? 'id';
    const value = (err as any).value?.toString?.() ?? String((err as any).value);
    return next(AppError.badRequest(`Invalid ${path}: ${value}`, 'E_MONGO_CAST'));
  }

  // 6) Mongoose ValidationError
  if (err instanceof MongooseError.ValidationError) {
    const details = Object.values(err.errors).map((e: any) => ({
      path: e?.path ? [e.path] : [],
      message: e?.message || 'Validation error',
      code: 'mongoose_validation',
    }));
    return next(AppError.badRequest('Invalid request', 'E_MONGO_VALIDATION', details));
  }

  // 7) Mongo duplicate key
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    const details = fields.map((f) => ({
      path: [f],
      message: `Duplicate value for '${f}'`,
      code: 'duplicate_key',
    }));
    return next(AppError.conflict('Duplicate key', 'E_DUPLICATE', details));
  }

  // 8) Rate limiter (express-rate-limit)
  if (err?.name === 'RateLimitError' || err?.name === 'RateLimitExceeded' || err?.status === 429) {
    return next(new AppError('Too many requests', 429, { code: 'E_RATE_LIMIT' }));
  }

  // 9) Multer
  if (err instanceof multer.MulterError) {
    return next(fromMulterError(err));
  }

  // 10) أخطاء تعريف الراوت (path-to-regexp) — زي: "Missing parameter name at 1: https://git.new/pathToRegexpError"
  if (typeof err?.message === 'string' && err.message.includes('pathToRegexpError')) {
    return next(AppError.internal('Route pattern error', 'E_ROUTE_PATTERN'));
  }

  // 11) أي خطأ تاني → 500 داخلي
  return next(AppError.internal(err?.message || 'Internal server error', 'E_INTERNAL'));
};

/* ---------------------------- Error Handler ---------------------------- */
/**
 * الميدلويير النهائي الذي يرسل الرد للعميل.
 * - يُتوقع استقبال AppError (من errorConverter أو من أي مكان تاني في السلسلة)
 * - يُرجع JSON: { status, message, code, details?, stack? }
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  // لو الرد بدأ يتبعت، يمنع الرد مرة تانية
  if (res.headersSent) return res.end();

  // نسخة من الـ err الأصلي لبعض الهيدرز (Retry-After)
  const originalErr = err;

  // التعديل قبل البرودكشن
  const appErr = isAppError(err)
    ? err
    : AppError.internal(err?.message || 'Internal server error', 'E_INTERNAL');

  const requestId = getRequestId(req);
  const statusCode = appErr.statusCode || 500;
  const status = (appErr as any).status || (statusCode >= 500 ? 'error' : 'fail');
  const isProd = env.NODE_ENV === 'production';

  // 🔐 في الإنتاج
  const safeMessage =
    isProd && statusCode >= 500 && !appErr.isOperational
      ? 'حدث خطأ غير متوقع'
      : appErr.message || 'Error';

  // 🎯 جسم الرد
  const body: any = {
    status, // "fail" | "error"
    message: safeMessage,
    code: appErr.code, // كود داخلي
    requestId,
  };

  // إظهار details دائمًا في التطوير، أما في الإنتاج فتظهر لطلبات 4xx فقط
  if (!isProd || statusCode < 500) {
    if (appErr.details) body.details = appErr.details;
  }

  // 🧰 Debug في التطوير
  if (!isProd && appErr.stack) body.stack = appErr.stack;

  // هيدرز مساعدة حسب الحالة
  if (statusCode === 401) {
    res.setHeader('WWW-Authenticate', 'Bearer');
  }

  if (statusCode === 429) {
    const msBeforeNext =
      typeof (originalErr as any)?.msBeforeNext === 'number'
        ? (originalErr as any).msBeforeNext
        : undefined;

    const resetTime: Date | undefined = (req as any)?.rateLimit?.resetTime;

    let retryAfterSec: number | undefined;
    if (typeof msBeforeNext === 'number') {
      retryAfterSec = Math.ceil(msBeforeNext / 1000);
    } else if (resetTime instanceof Date) {
      const diff = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
      if (diff > 0) retryAfterSec = diff;
    }

    if (retryAfterSec && retryAfterSec > 0) {
      res.setHeader('Retry-After', String(retryAfterSec));
    }
  }

  // 📝 Logging (pino-http: req.log) وإلا console
  const log = (req as any).log || console;
  const logPayload = {
    requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    status,
    message: appErr.message,
    code: appErr.code,
    details: appErr.details,
    userId: (req as any).user?.id,
  };
  if (statusCode >= 500) log.error(logPayload, 'Request failed (server error)');
  else log.warn(logPayload, 'Request failed (client error)');

  res.status(statusCode).json(body);
}
