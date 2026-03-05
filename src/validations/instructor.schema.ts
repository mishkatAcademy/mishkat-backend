// src/validations/instructor.schema.ts
import { z } from 'zod';

export const localizedTextSchema = z.object({
  ar: z.string().trim().min(1).optional(),
  en: z.string().trim().min(1).optional(),
});

const localizedTextRequired = z
  .object({
    ar: z.string().trim().min(1).optional(),
    en: z.string().trim().min(1).optional(),
  })
  .refine((v) => Boolean(v.ar || v.en), { message: 'Provide ar or en' });

const localizedTextOptional = localizedTextRequired.optional();

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const exceptionDateParamsSchema = z.object({
  dateYMD: z.string().regex(YMD, 'Invalid date (YYYY-MM-DD)'),
});

const dailyTimeRangeObjectSchema = z
  .object({
    start: z.string().regex(HHMM, 'Invalid HH:mm'),
    end: z.string().regex(HHMM, 'Invalid HH:mm'),
  })
  .strict();

export const dailyTimeRangeSchema = dailyTimeRangeObjectSchema.refine((v) => v.start < v.end, {
  message: 'start must be before end',
});

const weeklySlotObjectSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    start: z.string().regex(HHMM),
    end: z.string().regex(HHMM),
  })
  .strict();

export const weeklySlotSchema = weeklySlotObjectSchema.refine((v) => v.start < v.end, {
  message: 'start must be before end',
});

/** PUT /me/exceptions/:dateYMD */
export const upsertExceptionBodySchema = z
  .object({
    closed: z.boolean().optional(),
    slots: z.array(dailyTimeRangeSchema).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.closed === true && v.slots?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['slots'],
        message: 'slots must be empty when closed=true',
      });
    }
  });

/** PUT /me/weekly */
export const weeklyReplaceSchema = z
  .object({
    weekly: z.array(weeklySlotSchema),
  })
  .strict();

export const availabilityExceptionSchema = z.object({
  date: z.coerce.date(),
  closed: z.boolean().optional(),
  slots: z.array(dailyTimeRangeSchema).optional(),
});

const supportedTypeEnum = z.enum(['academic', 'social', 'coaching']);

// 1) base بدون defaults
const base = z.object({
  userId: z.string().length(24),
  displayName: localizedTextOptional,
  headline: localizedTextOptional,
  bio: localizedTextOptional,
  academicDegree: localizedTextOptional,
  experiences: z
    .array(
      z.object({
        title: localizedTextOptional,
        organization: localizedTextOptional,
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        description: localizedTextOptional,
        location: localizedTextOptional,
        untilYear: z.coerce.number().int().min(1900).max(2100).optional(),
      }),
    )
    .optional(),

  certifications: z
    .array(
      z.object({
        title: localizedTextOptional,
        issuer: localizedTextOptional,
        year: z.coerce.number().int().min(1900).max(2100).optional(),
      }),
    )
    .optional(),

  supportedTypes: z.array(supportedTypeEnum).optional(),
  timezone: z.string().optional(),
  bufferMinutes: z.number().int().min(0).max(180).optional(),
  minNoticeHours: z.number().int().min(0).max(240).optional(),
  maxAdvanceDays: z.number().int().min(1).max(365).optional(),
  rescheduleWindowHours: z.number().int().min(0).max(240).optional(),
  weekly: z.array(weeklySlotSchema).optional(),
  exceptions: z.array(availabilityExceptionSchema).optional(),
  meetingMethod: z.enum(['manual']).optional(),
  meetingUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

/** helper لتطبيق قواعد إضافية بعد البناء */
const withRules = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((v: any, ctx) => {
    if (v?.meetingMethod === 'manual' && v?.meetingUrl && !/^https?:\/\//i.test(v.meetingUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['meetingUrl'],
        message: 'Invalid URL',
      });
    }
  });

/** ✳️ إنشاء (Admin) */
export const createInstructorProfileSchema = withRules(
  base.extend({
    supportedTypes: z.array(supportedTypeEnum).min(1).default(['academic']),
    timezone: z.string().default('Asia/Riyadh'),
    bufferMinutes: z.number().int().min(0).max(180).default(10),
    minNoticeHours: z.number().int().min(0).max(240).default(24),
    maxAdvanceDays: z.number().int().min(1).max(365).default(30),
    rescheduleWindowHours: z.number().int().min(0).max(240).default(12),
    weekly: z.array(weeklySlotSchema).default([]),
    meetingMethod: z.enum(['manual']).default('manual'),
    isActive: z.boolean().default(true),
  }),
);

/** ✏️ تحديث (Admin) — partial */
export const updateInstructorProfileSchema = withRules(base.omit({ userId: true }).partial());

/** ✏️ تحديث (Self) — بدون isActive */
export const selfUpdateInstructorProfileSchema = withRules(
  base.omit({ userId: true, isActive: true }).partial(),
);

/** :params */
export const instructorIdParamsSchema = z.object({
  userId: z.string().length(24),
});

/** ?query (قائمة الأدمن) */
export const listInstructorsAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  type: supportedTypeEnum.optional(),
  activeOnly: z.coerce.boolean().optional().default(true),
  search: z.string().trim().optional(),
  sort: z.string().optional().default('createdAt:desc'),
});

/* =========================================================
✅ إضافات جديدة للـ 7 endpoints (لن تُلغي الموجود)
========================================================= */

export const weeklyItemIdParamsSchema = z.object({
  itemId: z.string().length(24, 'Invalid itemId'),
});

export const addWeeklyItemBodySchema = weeklySlotObjectSchema;

export const updateWeeklyItemBodySchema = z
  .object({
    day: z.number().int().min(0).max(6).optional(),
    start: z.string().regex(HHMM, 'Invalid HH:mm').optional(),
    end: z.string().regex(HHMM, 'Invalid HH:mm').optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const hasStart = typeof v.start === 'string';
    const hasEnd = typeof v.end === 'string';

    // لو واحد موجود والتاني مش موجود => غلط
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasStart ? ['end'] : ['start'],
        message: 'start and end must be provided together',
      });
    }

    if (hasStart && hasEnd && v.start! >= v.end!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'start must be before end',
      });
    }
  });

/** POST /me/exceptions/off-range */
export const offRangeBodySchema = z
  .object({
    from: z.string().regex(YMD, 'Invalid from'),
    to: z.string().regex(YMD, 'Invalid to'),
  })
  .strict()
  .refine((v) => v.from <= v.to, {
    path: ['to'],
    message: '"to" must be on/after "from"',
  });

/** POST /me/exceptions/:dateYMD/slots */
export const addSlotsToDayBodySchema = z
  .object({
    slots: z.array(dailyTimeRangeSchema).min(1),
  })
  .strict();
