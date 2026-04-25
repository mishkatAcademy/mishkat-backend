// src/validations/instructorConsultations.schema.ts
import { z } from 'zod';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const instructorMyConsultationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),

    status: z.enum(['confirmed', 'completed', 'cancelled', 'refunded']).optional(),
    from: z.string().regex(YMD, 'Invalid from (YYYY-MM-DD)').optional(),
    to: z.string().regex(YMD, 'Invalid to (YYYY-MM-DD)').optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.from && v.to && v.from > v.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: '"to" must be on/after "from"',
      });
    }
  });

export const myOfferingsQuerySchema = z
  .object({
    activeOnly: z.coerce.boolean().optional().default(true),
  })
  .strict();

export type InstructorMyConsultationsQuery = z.infer<typeof instructorMyConsultationsQuerySchema>;
