import { z } from 'zod';

/** 📄 Query: pagination + sorting بسيطة */
export const addressListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(), // مثال: "-createdAt" أو "city"
});

/** 🔑 Params: id */
export const addressIdParamsSchema = z.object({
  id: z.string().length(24, 'معرّف غير صالح'),
});

/** 📦 Body: إنشاء عنوان */
export const createAddressSchema = z.object({
  label: z.enum(['home', 'work', 'other']).optional(),
  recipientName: z.string().min(2, 'الاسم قصير').max(100),
  phone: z
    .string()
    .min(6)
    .max(30)
    .regex(/^[+0-9\s\-()]+$/, 'رقم هاتف غير صالح'),
  street: z.string().min(2).max(200),
  city: z.string().min(2).max(120),
  state: z.string().min(2).max(120).optional(),
  postalCode: z.string().min(2).max(20).optional(),
  country: z.string().min(2).max(120),
  notes: z.string().max(300).optional(),
  isDefault: z.boolean().optional(),
});

/** ✏️ Body: تحديث عنوان (كل الحقول اختيارية) */
export const updateAddressSchema = createAddressSchema.partial();

/** ✅ Body (اختياري): لو حابب تخلي المسار /:id/default بدون body */
export const setDefaultAddressSchema = z.object({
  isDefault: z.boolean().optional(), // مش هنستخدمه غالبًا
});
