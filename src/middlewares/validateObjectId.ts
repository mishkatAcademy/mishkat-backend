// src/middlewares/validateObjectId.ts
import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import AppError from '../utils/AppError';

type Opts = {
  /** اسم الباراميتر في الراوت: الافتراضي 'id' */
  paramName?: string;
  /**
   * هل نفضّل القراءة من req.validated?.params (لو استخدمنا validate())
   * الافتراضي true
   */
  useValidatedParams?: boolean;
  /** هل وجود الباراميتر مطلوب؟ الافتراضي true */
  required?: boolean;
  /** كود الخطأ المخصّص */
  errorCode?: string;
};

/**
 * ✅ Middleware: يتحقّق أن :id (أو أي اسم تختاره) موجود وصيغته ObjectId صحيحة
 * - يقرأ أولًا من req.validated?.params (لو موجود) ثم يسقط إلى req.params
 */
export function validateObjectId(opts: Opts | string = {}): RequestHandler {
  const _opts: Opts = typeof opts === 'string' ? { paramName: opts } : opts;
  const {
    paramName = 'id',
    useValidatedParams = true,
    required = true,
    errorCode = 'E_INVALID_ID',
  } = _opts;

  return (req, _res, next) => {
    const params = (useValidatedParams ? (req as any).validated?.params : undefined) ?? req.params;
    const id = params?.[paramName];

    // مفقود؟
    if (!id) {
      return required
        ? next(AppError.badRequest(`Missing param :${paramName}`, 'E_MISSING_ID_PARAM'))
        : next();
    }

    // صيغة غير صالحة؟
    if (!isValidObjectId(id)) {
      return next(AppError.badRequest('معرّف غير صالح', errorCode));
    }

    next();
  };
}

/* (اختياري) إن عايز تتحقق من أكثر من باراميتر في نفس الراوت:
export const validateObjectIds =
  (...names: string[]): RequestHandler =>
  (req, _res, next) => {
    for (const name of names) {
      const id =
        (req as any).validated?.params?.[name] ??
        (req as any).params?.[name];
      if (!id) return next(AppError.badRequest(`Missing param :${name}`, 'E_MISSING_ID_PARAM'));
      if (!isValidObjectId(id)) return next(AppError.badRequest(`Invalid id for :${name}`, 'E_INVALID_ID'));
    }
    next();
  };
*/
