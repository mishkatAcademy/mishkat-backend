// src/middlewares/validate.ts
/**
 * ✅ Middleware موحّد للتحقق من الطلبات باستخدام Zod
 * - يدعم body / query / params / headers عبر خيار واحد
 * - يعمل trim تلقائيًا لكل قيم الـ string (قابل للتعطيل)
 * - لا يكتب على req.query/req.params/req.headers (توافقًا مع Express الحديثة)
 * - (اختياري) ممكن يكتب على req.body فقط لو حابب (لتوافق كود قديم)
 * - يُعيد البيانات المتحققة دائمًا في req.validated
 * - يُمرّر أخطاء زود بشكل منظّم داخل AppError.details مع الكود E_VALIDATION
 */

import { ZodError, ZodTypeAny } from 'zod';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import AppError from '../utils/AppError';

type Where = 'body' | 'query' | 'params' | 'headers';

interface ValidateOptions {
  where?: Where; // الافتراضي: "body"
  trimStrings?: boolean; // الافتراضي: true
  attachValidated?: boolean; // حفظ نسخة في req.validated (الافتراضي: true)
  mutateSource?: boolean; // ⚠️ يسمح بالكتابة على المصدر "للـ body فقط"؛ الافتراضي: false
}

/** حماية + تنظيف: نمرّ على أي قيمة ونقوم بعمل trim للـ strings */
const deepTrimStrings = (v: any): any => {
  if (typeof v === 'string') return v.trim();

  // 👇 اترك الأنواع الخاصة كما هي
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
      // حماية بسيطة من prototype pollution
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      out[k] = deepTrimStrings((v as any)[k]);
    }
    return out;
  }
  return v;
};

/** تحويل أخطاء Zod إلى مصفوفة منظمة (path/message/code) */
const zodIssuesArray = (err: ZodError) =>
  err.issues.map((i) => ({
    path: i.path,
    message: i.message,
    code: i.code,
  }));

/**
 * الميدلويير الأساسي:
 *  - يقرأ المصدر المحدد (body/query/params/headers)
 *  - يطبّق trim (اختياري)
 *  - يتحقق عبر Zod (safeParseAsync)
 *  - عند الخطأ: AppError.badRequest مع كود E_VALIDATION وتفاصيل issues
 *  - عند النجاح:
 *      * لا نعدّل req.query/req.params/req.headers إطلاقًا (تجنّب "Cannot set property query...")
 *      * (اختياري) نعدّل req.body فقط لو opts.mutateSource=true
 *      * دائمًا نضع الناتج في req.validated[where]
 */
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

      // ✨ لا نكتب أبدًا على query/params/headers — ده اللي كان بيكسر في Express v5
      if (allowMutateBody) {
        // مسموح نعدّل الـ body فقط لتوافق كود قديم
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

/** رابرز مألوفة (توافق كامل مع الكود الحالي) */

// body: نسمح بالتعديل على req.body لتوافق كود قديم يعتمد عليه
export const validateRequestBody = (schema: ZodTypeAny) =>
  validate(schema, { where: 'body', mutateSource: true });

// query/params: لا نعدّل المصدر — نحفظ فقط في req.validated
export const validateRequestParams = (schema: ZodTypeAny) => validate(schema, { where: 'params' });

export const validateQuery = (schema: ZodTypeAny) => validate(schema, { where: 'query' });

/**
 * ✅ ميدلويير مركّب: يفعّل أكثر من سكيمة في طلب واحد (params → query → headers → body)
 * - لا يكتب على أي مصدر إلا body (حسب الرابر أعلاه)
 * - أول خطأ يوقف السلسلة
 */
export const validateRequest = (schemas: {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  headers?: ZodTypeAny;
  body?: ZodTypeAny;
}): RequestHandler => {
  // Helper: شغّل أي ميدلويير Express كـ Promise
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
