// src/validations/library.schema.ts
import { z } from 'zod';

export const listMyLibraryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  })
  .strict();

export const bookIdParamSchema = z
  .object({
    id: z.string().length(24, 'Invalid id'),
  })
  .strict();

export type ListMyLibraryQuery = z.infer<typeof listMyLibraryQuerySchema>;
export type BookIdParam = z.infer<typeof bookIdParamSchema>;
