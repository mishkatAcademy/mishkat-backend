// src/validations/book.schema.ts
import { z } from 'zod';

/* --------------------------------- Helpers -------------------------------- */

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'معرّف غير صالح (يجب أن يكون 24 خانة hex)');

/** نص محلّي */
export const localizedTextSchema = z
  .object({
    ar: z.string().trim().min(1).optional(),
    en: z.string().trim().min(1).optional(),
  })
  .refine((v) => !!(v.ar || v.en), {
    message: 'النصّ يجب أن يحتوي على العربية أو الإنجليزية على الأقل',
  });

/** رقم (ريال) بحد أقصى خانتين عشريتين – يقبل سترنج من الواجهة ويتحوّل */
const moneyNumber = z.coerce
  .number({ invalid_type_error: 'السعر يجب أن يكون رقمًا' })
  .nonnegative('السعر لا يمكن أن يكون سالبًا')
  .refine((v) => Number.isFinite(v), 'قيمة غير صالحة')
  .refine((v) => Math.round(v * 100) === v * 100, 'السعر يجب أن يحتوي على خانتين عشريتين كحد أقصى');

/** ISBN مبسّط (اختياري) */
const isbnSchema = z.string().trim().min(10, 'ISBN غير صالح').max(17, 'ISBN غير صالح').optional();

/* ------------------------------- Create Book ------------------------------- */
/**
 * ملاحظات مهمّة:
 * - لا نُجبِر pdfUrl عند isDigital=true، لأننا قد نرفع ملف PDF عبر Multer.
 * - الخدمة (service) تتكفّل بالتحقّق النهائي:
 *    - لو isDigital=true ⇒ لازم إمّا pdfUrl أو ملف مرفوع.
 * - الأسعار هنا بالريال (رقم عشري)، وهنحوّلها هللة في الخدمة.
 */
export const createBookSchema = z
  .object({
    title: localizedTextSchema,
    description: localizedTextSchema.optional(),

    author: localizedTextSchema,
    publisher: localizedTextSchema.optional(),
    language: z.enum(['ar', 'en']).optional().default('ar'),

    image: z.string().url().optional(), // لو رفعنا غلاف عبر Multer مش لازم نبعت ده

    price: moneyNumber,
    salesPrice: moneyNumber.optional(),

    isDigital: z.coerce.boolean().optional().default(true),

    // مش بنجبره هنا؛ الخدمة هتتأكد (url أو ملف)
    pdfUrl: z.string().url().optional(),

    // للورقي فقط – في الرقمي هنرفضه
    stock: z.coerce.number().int().min(0).optional(),

    // في JSON: مصفوفة IDs، في multipart ممكن تبعتها JSON-string وتفك في الكونترولر
    categories: z.array(objectId).optional().default([]),

    showInHomepage: z.coerce.boolean().optional().default(false),

    pages: z.coerce.number().int().min(1).optional(),
    publishDate: z.coerce.date().optional(),
    isbn: isbnSchema,
  })
  .superRefine((data, ctx) => {
    if (typeof data.salesPrice === 'number' && data.salesPrice > data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['salesPrice'],
        message: 'سعر التخفيض يجب أن يكون أقل من أو يساوي السعر',
      });
    }

    if (data.isDigital) {
      // لا نُلزم pdfUrl هنا – قد يأتي عبر ملف
      if (typeof (data as any).stock === 'number') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stock'],
          message: 'Stock غير مسموح للكتاب الرقمي',
        });
      }
    } else {
      // كتاب ورقي: لازم stock رقم
      if (typeof data.stock !== 'number') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stock'],
          message: 'Stock مطلوب للكتاب الورقي',
        });
      }
    }
  });

/* ------------------------------- Update Book ------------------------------- */
/**
 * - كل الحقول اختيارية.
 * - عند التحويل إلى رقمي isDigital=true لا نفرض pdfUrl هنا (قد يتم رفعه ملفًا)،
 *   لكن لو بعته، لازم يكون URL صالح.
 * - مسموح stock=null (عشان نرجّعها null للرقمي).
 */
export const updateBookSchema = z
  .object({
    title: localizedTextSchema.optional(),
    description: localizedTextSchema.optional(),

    author: localizedTextSchema.optional(),
    publisher: localizedTextSchema.optional(),
    language: z.enum(['ar', 'en']).optional(),

    image: z.string().url().optional(),

    price: moneyNumber.optional(),
    salesPrice: moneyNumber.optional(),

    isDigital: z.coerce.boolean().optional(),
    pdfUrl: z.string().url().optional(),

    stock: z.union([z.coerce.number().int().min(0), z.null()]).optional(),

    categories: z.array(objectId).optional(),
    showInHomepage: z.coerce.boolean().optional(),

    pages: z.coerce.number().int().min(1).optional(),
    publishDate: z.coerce.date().optional(),
    isbn: isbnSchema,
  })
  .superRefine((data, ctx) => {
    if (
      typeof data.price === 'number' &&
      typeof data.salesPrice === 'number' &&
      data.salesPrice > data.price
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['salesPrice'],
        message: 'سعر التخفيض يجب أن يكون أقل من أو يساوي السعر',
      });
    }

    if (data.isDigital === true) {
      // مش بنجبر pdfUrl هنا – الملف ممكن ييجي عبر Multer
      if (typeof data.stock === 'number') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stock'],
          message: 'Stock غير مسموح للكتاب الرقمي',
        });
      }
    }
  });

/* --------------------------------- :id param -------------------------------- */
export const bookIdParamsSchema = z.object({
  id: objectId,
});

/* --------------------------- ?query (القائمة العامة) --------------------------- */
const booleanFromQuery = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return val;
}, z.boolean());

export const bookQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),

  includeDeleted: booleanFromQuery.optional().default(false),

  search: z.string().trim().optional(),
  category: objectId.optional(),
  language: z.enum(['ar', 'en']).optional(),
  isDigital: booleanFromQuery.optional(),
  inStock: booleanFromQuery.optional(),
  showInHomepage: booleanFromQuery.optional(),

  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),

  sort: z.string().optional().default('createdAt:desc'),
});

/* -------------------------- ?query (هيدر الهوم بيج) -------------------------- */
export const homepageBooksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
  language: z.enum(['ar', 'en']).optional(),
  isDigital: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().optional(),
});
