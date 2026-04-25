import { z } from 'zod';

export const idempotencyHeaderSchema = z.object({
  'idempotency-key': z.string().trim().max(128).optional(),
});
