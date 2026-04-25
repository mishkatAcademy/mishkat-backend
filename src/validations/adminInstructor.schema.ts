// src/validations/adminInstructor.schema.ts
import { z } from 'zod';

const objectId = z.string().length(24);

const localizedTextSchema = z
  .object({
    ar: z.string().trim().min(1).optional(),
    en: z.string().trim().min(1).optional(),
  })
  .optional();

const localizedText = z
  .object({
    ar: z.string().trim().min(1).optional(),
    en: z.string().trim().min(1).optional(),
  })
  .refine((v) => Boolean(v.ar || v.en), { message: 'Provide ar or en' });

const localizedTextOrString = z.union([
  z
    .string()
    .trim()
    .min(1)
    .transform((s) => ({ ar: s })),
  localizedText,
]);

const localizedTextOpt = localizedTextOrString.optional();

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
    displayName: localizedTextOpt,
    headline: localizedTextOpt,
    bio: localizedTextOpt,
    academicDegree: localizedTextOpt,

    experiences: z
      .array(
        z.object({
          title: localizedTextOpt,
          organization: localizedTextOpt,
          startDate: z.coerce.date().optional(),
          endDate: z.coerce.date().optional(),
          description: localizedTextOpt,
          location: localizedTextOpt,
          untilYear: z.coerce.number().int().min(1900).max(2100).optional(),
        }),
      )
      .optional(),

    certifications: z
      .array(
        z.object({
          title: localizedTextOpt,
          issuer: localizedTextOpt,
          year: z.coerce.number().int().min(1900).max(2100).optional(),
        }),
      )
      .optional(),

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
  })
  .strict();
