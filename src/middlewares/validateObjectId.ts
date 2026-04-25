// src/middlewares/validateObjectId.ts
import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import AppError from '../utils/AppError';

type Opts = {
  paramName?: string;
  useValidatedParams?: boolean;
  required?: boolean;
  errorCode?: string;
};

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

    if (!id) {
      return required
        ? next(AppError.badRequest(`Missing param :${paramName}`, 'E_MISSING_ID_PARAM'))
        : next();
    }

    if (!isValidObjectId(id)) {
      return next(AppError.badRequest('معرّف غير صالح', errorCode));
    }

    next();
  };
}
