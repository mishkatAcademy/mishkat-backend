// src/validations/category.schema.ts
import { z } from 'zod';

/* ========== Helpers مشتركة ========== */

// ObjectId صارم: 24 hex
const objectIdStrict = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'معرّف غير صالح (يجب أن يكون 24 خانة hex)');

// نص محلّي: لازم واحد على الأقل
export const localizedTextSchema = z
  .object({
    ar: z.string().trim().min(1).optional(),
    en: z.string().trim().min(1).optional(),
  })
  .refine((v) => !!(v.ar || v.en), {
    message: 'العنوان/الوصف يجب أن يحتوي على نص بالعربية أو الإنجليزية على الأقل',
  });

// قائمة بيضاء لحِقول الفرز
const SORTABLE_FIELDS = ['order', 'createdAt', 'booksCount', 'coursesCount'] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];
const sortDir = ['asc', 'desc'] as const;

function isValidSort(value: string | undefined) {
  if (!value) return true;
  return value.split(',').every((part) => {
    const [field, dir] = part.split(':').map((s) => s.trim());
    if (!field) return false;
    const okField = (SORTABLE_FIELDS as readonly string[]).includes(field);
    const okDir = !dir || (sortDir as readonly string[]).includes(dir.toLowerCase());
    return okField && okDir;
  });
}

/* ========== Schemas ========== */

export const createCategorySchema = z.object({
  title: localizedTextSchema,
  description: localizedTextSchema.optional(),
  image: z.string().url().optional(),
  // لو عايز تبدأ بقيمة افتراضية محدّدة:
  scopes: z
    .array(z.enum(['book', 'course']))
    .min(1, 'اختر نطاقًا واحدًا على الأقل')
    .default(['book', 'course'])
    .optional(),
  order: z.number().int().min(0).optional(),
  // (اختياري) لو هتخزّن محليًا: imageRelPath
  // imageRelPath: z.string().trim().optional(),
});

export const updateCategorySchema = z
  .object({
    title: localizedTextSchema.optional(),
    description: localizedTextSchema.optional(),
    image: z.string().url().optional(),
    scopes: z
      .array(z.enum(['book', 'course']))
      .min(1)
      .optional(),
    order: z.number().int().min(0).optional(),
    // imageRelPath: z.string().trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'يرجى إرسال حقل واحد على الأقل للتحديث',
  });

export const categoryIdParamsSchema = z.object({
  id: objectIdStrict,
});

export const categoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),

    scope: z.enum(['book', 'course']).optional(),
    nonEmpty: z.coerce.boolean().optional(), // true => رجّع اللي فيه عناصر فقط حسب scope
    includeDeleted: z.coerce.boolean().optional().default(false),

    // اسم:اتجاه,اسم:اتجاه ... من القائمة البيضاء فقط
    sort: z
      .string()
      .optional()
      .default('order:asc,createdAt:desc')
      .refine(isValidSort, {
        message: `حقل sort غير مسموح. الحقول المسموحة: ${SORTABLE_FIELDS.join(', ')} (مع :asc أو :desc)`,
      }),

    search: z.string().trim().optional(),
  })
  .strict();
