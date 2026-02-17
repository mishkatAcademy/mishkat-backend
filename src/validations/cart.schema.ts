// src/validations/cart.schema.ts
import { z } from 'zod';

export const addCartItemSchema = z.object({
  itemType: z.enum(['Book', 'Course', 'ConsultationHold']),
  itemRef: z.string().length(24, 'معرّف غير صالح'),
  quantity: z.coerce.number().int().min(1).max(20).optional(), // سيُجبر إلى 1 لغير الورقي من السيرفيس
});

export const cartItemIdParamsSchema = z.object({
  id: z.string().length(24, 'معرّف غير صالح'),
});

export const updateCartQtySchema = z.object({
  quantity: z.coerce.number().int().min(1).max(20),
});
