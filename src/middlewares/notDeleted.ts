// src/middlewares/notDeleted.ts
import type { RequestHandler } from 'express';
import type { Model } from 'mongoose';
import { fetchDoc } from './fetchDoc';
import { AppError } from '../utils/AppError';

type NotDeletedOpts = {
  idParam?: string; // ':id' by default
  select?: string;
  lean?: boolean; // default true
  attachKey?: string; // default model.modelName.toLowerCase()
  deletedField?: string; // default 'isDeleted'
};

/** رابر بسيط: يجيب الدوكيومنت + يتأكد إن isDeleted !== true */
export function notDeleted<T extends Record<string, any>>(
  model: Model<T>,
  opts: NotDeletedOpts = {},
): RequestHandler[] {
  const {
    idParam = 'id',
    select,
    lean = true,
    attachKey = model.modelName.toLowerCase(),
    deletedField = 'isDeleted',
  } = opts;

  const fetch = fetchDoc<T>(model, { idParam, select, lean, attachKey });

  const ensureNotDeleted: RequestHandler = (req, _res, next) => {
    const doc = (req as any)[attachKey];
    if (!doc) return next(AppError.internal(`Missing req.${attachKey}`, 'E_MISSING_DOC'));
    if (doc[deletedField] === true) {
      return next(AppError.notFound('العنصر غير موجود أو تم حذفه', 'E_NOT_FOUND_OR_DELETED'));
    }
    next();
  };

  return [fetch, ensureNotDeleted];
}
