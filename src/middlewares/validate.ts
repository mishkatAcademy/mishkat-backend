// src/middlewares/validate.ts

import { ZodError, ZodTypeAny } from 'zod';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import AppError from '../utils/AppError';

type Where = 'body' | 'query' | 'params' | 'headers';

interface ValidateOptions {
  where?: Where;
  trimStrings?: boolean;
  attachValidated?: boolean;
  mutateSource?: boolean;
}

const deepTrimStrings = (v: any): any => {
  if (typeof v === 'string') return v.trim();

  if (
    v instanceof Date ||
    v instanceof RegExp ||
    (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(v))
  ) {
    return v;
  }

  if (Array.isArray(v)) return v.map(deepTrimStrings);

  if (v && typeof v === 'object') {
    const out: any = {};
    for (const k of Object.keys(v)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      out[k] = deepTrimStrings((v as any)[k]);
    }
    return out;
  }
  return v;
};

const zodIssuesArray = (err: ZodError) =>
  err.issues.map((i) => ({
    path: i.path,
    message: i.message,
    code: i.code,
  }));

export const validate =
  (schema: ZodTypeAny, opts: ValidateOptions = {}): RequestHandler =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const where: Where = opts.where ?? 'body';
    const trim = opts.trimStrings ?? true;
    const attach = opts.attachValidated ?? true;
    const allowMutateBody = opts.mutateSource === true && where === 'body';

    try {
      const source: any = (req as any)[where] ?? {};
      const input = trim ? deepTrimStrings(source) : source;

      const parsed = await schema.safeParseAsync(input);
      if (!parsed.success) {
        return next(
          AppError.badRequest('Invalid request', 'E_VALIDATION', zodIssuesArray(parsed.error)),
        );
      }

      if (allowMutateBody) {
        (req as any).body = parsed.data;
      }

      if (attach) {
        (req as any).validated ??= {};
        (req as any).validated[where] = parsed.data;
      }

      return next();
    } catch (e) {
      if (e instanceof ZodError) {
        return next(AppError.badRequest('Invalid request', 'E_VALIDATION', zodIssuesArray(e)));
      }
      return next(e);
    }
  };

export const validateRequestBody = (schema: ZodTypeAny) =>
  validate(schema, { where: 'body', mutateSource: true });

export const validateRequestParams = (schema: ZodTypeAny) => validate(schema, { where: 'params' });

export const validateQuery = (schema: ZodTypeAny) => validate(schema, { where: 'query' });

export const validateRequest = (schemas: {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  headers?: ZodTypeAny;
  body?: ZodTypeAny;
}): RequestHandler => {
  const run = (mw: RequestHandler, req: Request, res: Response) =>
    new Promise<void>((resolve, reject) =>
      mw(req, res, (err?: any) => (err ? reject(err) : resolve())),
    );

  return async (req, res, next) => {
    try {
      if (schemas.params) await run(validateRequestParams(schemas.params), req, res);
      if (schemas.query) await run(validateQuery(schemas.query), req, res);
      if (schemas.headers) await run(validate(schemas.headers, { where: 'headers' }), req, res);
      if (schemas.body) await run(validateRequestBody(schemas.body), req, res);
      next();
    } catch (err) {
      next(err);
    }
  };
};
