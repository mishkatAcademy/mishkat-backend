// src/middlewares/ensureOwnership.ts
import { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';

export function ensureOwnership(
  attachKey: string,
  ownerField: string = 'user',
  getUserId: (req: any) => string = (req) => req.user?.id,
): RequestHandler {
  return (req, _res, next) => {
    const doc = (req as any)[attachKey];
    if (!doc) return next(AppError.internal('Document not loaded', 'E_DOC_NOT_LOADED'));

    const owner = doc[ownerField]?.toString?.() ?? String(doc[ownerField]);
    const userId = getUserId(req);
    if (!userId || owner !== userId) {
      return next(AppError.forbidden('غير مسموح لك بتنفيذ هذه العملية', 'E_NOT_OWNER'));
    }
    next();
  };
}
