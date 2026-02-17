import { z } from 'zod';

export const idempotencyHeaderSchema = z.object({
  // Node/Express بتمرّر مفاتيح الهيدرز lowercase
  'idempotency-key': z.string().trim().max(128).optional(),
});
