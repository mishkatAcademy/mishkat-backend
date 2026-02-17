// src/middlewares/fetchDoc.ts
/**
 * ✅ Middleware عام لجلب Document بالـ :id وتعليقه على الطلب للاستعمال لاحقًا.
 *
 * المزايا:
 * - يتحقق من وجود وحُسن صياغة المعرّف (ObjectId) مع خيار تشديد التحقق.
 * - يدعم select/lean/فلتر إضافي (مثال: isDeleted:false).
 * - لا يكتب على خصائص Express الحساسة (query/params/headers).
 * - يعلّق النتيجة في مساحة آمنة: req.ctx[attachKey] + (اختياريًا) res.locals.docs[attachKey].
 * - خيار "توافق خلفي" لتعليقها كذلك على req[attachKey] لو الاسم غير محجوز.
 *
 * ملاحظات:
 * - لو اخترت attachKey اسمًا محجوزًا (مثل: "query" أو "params") هيرجع خطأ واضح.
 */

import type { RequestHandler } from 'express';
import type { Model } from 'mongoose';
import { isValidObjectId } from 'mongoose';
import AppError from '../utils/AppError';

type FetchDocOptions<T> = {
  /** اسم البراميتر الذي يحمل الـ id في الراوت (افتراضي: "id") */
  idParam?: string;

  /** Projection/Select (سلسلة أو كائن) — مثال: "title slug -secret" */
  select?: any;

  /** استخدام .lean() لأداء أعلى (افتراضي: true) */
  lean?: boolean;

  /**
   * المفتاح الذي سنعلّق تحته النتيجة:
   * - الافتراضي: model.modelName.toLowerCase()
   * - مثال: Category → "category"
   */
  attachKey?: string;

  /** فلتر إضافي يطبّق مع _id — مفيد للـ soft-delete: مثال: { isDeleted: false } */
  filter?: Record<string, any>;

  /**
   * تعليق النتيجة كذلك داخل res.locals.docs[attachKey]
   * مفيد للوصول من أي ميدلويير/كونترولر لاحقًا (افتراضي: true)
   */
  attachOnResLocals?: boolean;

  /**
   * توافق خلفي: تعليق النتيجة كذلك على req[attachKey]
   * (يتم فقط إذا لم يكن attachKey اسمًا محجوزًا) (افتراضي: true)
   */
  compatAttachOnReq?: boolean;

  /**
   * تشديد التحقق من ObjectId (24 hex) بالإضافة لـ isValidObjectId
   * (افتراضي: true)
   */
  strictObjectId?: boolean;
};

/* أسماء محجوزة لا يجب التعليق عليها مباشرة داخل req[...] */
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

/** تحقق صارم من كون المعرف 24 حرفًا سداسيًا */
const is24Hex = (s: unknown): s is string => typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(s);

/**
 * ✅ Middleware: fetchDoc
 * - يجلب document بالـ :id ويعلّقه في req.ctx[attachKey]
 * - (اختياريًا) يعلقه في res.locals.docs[attachKey]
 * - (توافق خلفي اختياري) يعلقه في req[attachKey] لو الاسم غير محجوز
 */
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
      // نقرأ من req.validated?.params (لو وُجدت) وإلا من req.params
      const params = (req as any).validated?.params ?? req.params;
      const rawId = params?.[idParam];

      // وجود الـ id؟
      if (rawId == null || rawId === '') {
        return next(AppError.badRequest(`Missing param :${idParam}`, 'E_MISSING_ID_PARAM'));
      }

      // تنظيف بسيط
      const id = typeof rawId === 'string' ? rawId.trim() : String(rawId);

      // صيغة الـ ObjectId
      if (strictObjectId ? !(is24Hex(id) && isValidObjectId(id)) : !isValidObjectId(id)) {
        return next(AppError.badRequest(`Invalid id format for :${idParam}`, 'E_INVALID_ID'));
      }

      // query: _id + (فلتر إضافي)
      const baseQuery = model.findOne({ _id: id, ...(filter || {}) }, select);
      const query = lean ? baseQuery.lean<T>() : baseQuery;
      const doc = await query.exec();

      if (!doc) {
        return next(AppError.notFound('العنصر غير موجود', 'E_NOT_FOUND'));
      }

      // ✅ تعليق داخل مساحة آمنة على req: ctx
      (req as any).ctx = (req as any).ctx || {};
      (req as any).ctx[attachKey] = doc;

      // ✅ تعليق كذلك داخل res.locals.docs (اختياري)
      if (attachOnResLocals) {
        (res as any).locals = (res as any).locals || {};
        (res as any).locals.docs = (res as any).locals.docs || {};
        (res as any).locals.docs[attachKey] = doc;
      }

      // ♻️ (توافق خلفي اختياري) تعليق على req[attachKey] لو الاسم غير محجوز
      if (compatAttachOnReq) {
        if (RESERVED_REQ_KEYS.has(attachKey)) {
          // منعنا الكتابة على خصائص حساسة (زي query/params/headers)
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
      // احتياط في حال CastError من مكان آخر
      if (err?.name === 'CastError') {
        return next(AppError.badRequest('Invalid id', 'E_INVALID_ID'));
      }
      next(err);
    }
  };
}

/* ----------------------------------------------------------------------
 * 💡 ملاحظات استخدام:
 *
 * 1) القراءة في الكونترولر:
 *    const category = req.ctx?.category;                 // المفضّل
 *    const sameCat = res.locals.docs?.category;          // بديل
 *    // (لو مفعّل compatAttachOnReq):
 *    const legacyCat = (req as any).category;            // توافق خلفي
 *
 * 2) أمثلة:
 *    import { Category } from '../models/Category';
 *    router.get('/:id', fetchDoc(Category, { filter: { isDeleted: { $ne: true } } }), ctrl.getById);
 *
 * 3) تحذير:
 *    - تجنّب تعيين attachKey لأسماء محجوزة مثل: "query", "params", "headers"... إلخ.
 *    - في حال الإصرار على نفس الاسم لأسباب قديمة، عطّل compatAttachOnReq واستخدم req.ctx فقط.
 * -------------------------------------------------------------------- */
