// src/middlewares/fetchDoc.ts
/**
 * ✅ Middleware عام لجلب Document بالـ :id.
 */

import type { RequestHandler } from 'express';
import type { Model } from 'mongoose';
import { isValidObjectId } from 'mongoose';
import AppError from '../utils/AppError';

type FetchDocOptions<T> = {
  idParam?: string;
  select?: any;
  lean?: boolean;

  attachKey?: string;

  filter?: Record<string, any>;

  attachOnResLocals?: boolean;

  compatAttachOnReq?: boolean;

  strictObjectId?: boolean;
};

const RESERVED_REQ_KEYS = new Set([
  'query',
  'params',
  'headers',
  'body',
  'route',
  'url',
  'originalUrl',
  'baseUrl',
  'path',
  'socket',
  'app',
  'res',
  'next',
  'id',
  'log',
  'user',
  'files',
  'file',
  'cookies',
  'signedCookies',
  'ctx',
  'validated',
]);

const is24Hex = (s: unknown): s is string => typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(s);

export function fetchDoc<T extends object>(
  model: Model<T>,
  opts: FetchDocOptions<T> = {},
): RequestHandler {
  const {
    idParam = 'id',
    select,
    lean = true,
    attachKey = model.modelName.toLowerCase(),
    filter,
    attachOnResLocals = true,
    compatAttachOnReq = true,
    strictObjectId = true,
  } = opts;

  return async (req, res, next) => {
    try {
      const params = (req as any).validated?.params ?? req.params;
      const rawId = params?.[idParam];

      if (rawId == null || rawId === '') {
        return next(AppError.badRequest(`Missing param :${idParam}`, 'E_MISSING_ID_PARAM'));
      }

      const id = typeof rawId === 'string' ? rawId.trim() : String(rawId);

      if (strictObjectId ? !(is24Hex(id) && isValidObjectId(id)) : !isValidObjectId(id)) {
        return next(AppError.badRequest(`Invalid id format for :${idParam}`, 'E_INVALID_ID'));
      }

      const baseQuery = model.findOne({ _id: id, ...(filter || {}) }, select);
      const query = lean ? baseQuery.lean<T>() : baseQuery;
      const doc = await query.exec();

      if (!doc) {
        return next(AppError.notFound('العنصر غير موجود', 'E_NOT_FOUND'));
      }

      (req as any).ctx = (req as any).ctx || {};
      (req as any).ctx[attachKey] = doc;

      if (attachOnResLocals) {
        (res as any).locals = (res as any).locals || {};
        (res as any).locals.docs = (res as any).locals.docs || {};
        (res as any).locals.docs[attachKey] = doc;
      }

      if (compatAttachOnReq) {
        if (RESERVED_REQ_KEYS.has(attachKey)) {
          return next(
            AppError.internal(
              `fetchDoc: attachKey '${attachKey}' is reserved — use req.ctx['${attachKey}'] instead`,
              'E_INVALID_ATTACHKEY',
            ),
          );
        }
        (req as any)[attachKey] = doc;
      }

      next();
    } catch (err: any) {
      if (err?.name === 'CastError') {
        return next(AppError.badRequest('Invalid id', 'E_INVALID_ID'));
      }
      next(err);
    }
  };
}
