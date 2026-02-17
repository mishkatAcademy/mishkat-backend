// src/validations/order.schema.ts
import { z } from 'zod';

export const createOrderBodySchema = z.object({
  cartItemId: z.string().length(24).optional(),
  addressId: z.string().length(24).optional(), // هنلزمه في الخدمة لو فيه عناصر تحتاج شحن
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum(['moyasar']).default('moyasar'), // قابل للتوسّع لاحقاً
});

export const idParamSchema = z.object({
  id: z.string().length(24, 'Invalid id'),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
