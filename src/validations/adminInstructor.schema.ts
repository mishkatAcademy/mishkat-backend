// src/validations/adminInstructor.schema.ts
import { z } from 'zod';

const objectId = z.string().length(24);

const localizedTextSchema = z
  .object({
    ar: z.string().trim().min(1).optional(),
    en: z.string().trim().min(1).optional(),
  })
  .optional();

export const adminCreateInstructorSchema = z
  .object({
    // User
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(2).max(60),
    email: z
      .string()
      .email()
      .transform((v) => v.trim().toLowerCase()),
    phoneNumber: z.string().trim().min(6).max(30).optional(),
    password: z.string().min(8).max(100),

    verifyEmail: z.coerce.boolean().optional().default(false),

    // Profile (اختياري)
    displayName: z.string().trim().min(2).max(120).optional(),
    supportedTypes: z
      .array(z.enum(['academic', 'social', 'coaching']))
      .min(1)
      .default(['academic']),
    timezone: z.string().optional().default('Asia/Riyadh'),

    bufferMinutes: z.coerce.number().int().min(0).max(180).optional(),
    minNoticeHours: z.coerce.number().int().min(0).max(240).optional(),
    maxAdvanceDays: z.coerce.number().int().min(1).max(365).optional(),
    rescheduleWindowHours: z.coerce.number().int().min(0).max(240).optional(),

    meetingUrl: z.string().trim().url().optional(),

    weekly: z
      .array(
        z.object({
          day: z.coerce.number().int().min(0).max(6),
          start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        }),
      )
      .optional(),

    // exceptions اختياري… (يفضل atomic endpoints بعدين)
  })
  .strict();
