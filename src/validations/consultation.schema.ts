// src/validations/consultation.schema.ts
import { z } from 'zod';

/* ========== Helpers / Reusable ==========
 * - ObjectId: 24 chars
 * - YMD: "YYYY-MM-DD"
 * - HH:mm
 * - Enum النوع
 * ====================================== */
export const objectId = z.string().length(24, 'Invalid id');
export const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const consultationTypeEnum = z.enum(['academic', 'social', 'coaching']);

/* ========== Offerings ==========
 * ?type + activeOnly + pagination اختيارياً
 * ============================== */
export const listOfferingsQuerySchema = z
  .object({
    type: consultationTypeEnum.optional(),
    activeOnly: z.coerce.boolean().optional().default(true),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().trim().optional(),
    sort: z.string().optional().default('order:asc,createdAt:desc'),
  })
  .strict();

/* ========== Instructors ==========
 * ?type + activeOnly + pagination
 * ================================= */
export const listInstructorsQuerySchema = z
  .object({
    type: consultationTypeEnum.optional(),
    activeOnly: z.coerce.boolean().optional().default(true),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().trim().optional(),
    sort: z.string().optional().default('createdAt:desc'),
  })
  .strict();

/* ========== Availability (day) ==========
 * GET /consultations/instructors/:instructorId/availability
 * query: offeringId + date
 * ====================================== */
export const availabilityQuerySchema = z
  .object({
    offeringId: objectId,
    date: z.string().regex(YMD, 'Invalid date (YYYY-MM-DD)'),
  })
  .strict();

/* ========== Range Slots ==========
 * GET /consultations/instructors/:instructorId/slots
 * query: offeringId + from + to
 * ====================================== */
export const rangeSlotsQuerySchema = z
  .object({
    offeringId: objectId,
    from: z.string().regex(YMD, 'Invalid from (YYYY-MM-DD)'),
    to: z.string().regex(YMD, 'Invalid to (YYYY-MM-DD)'),
  })
  .strict()
  .refine((v) => v.from <= v.to, {
    path: ['to'],
    message: '"to" must be on/after "from"',
  });

/* ========== Calendar Overlay (Version II) ==========
 * GET /consultations/instructors/:instructorId/calendar
 * query: from + to
 * ====================================== */
export const calendarQuerySchema = z
  .object({
    from: z.string().regex(YMD, 'Invalid from (YYYY-MM-DD)'),
    to: z.string().regex(YMD, 'Invalid to (YYYY-MM-DD)'),
  })
  .strict()
  .refine((v) => v.from <= v.to, {
    path: ['to'],
    message: '"to" must be on/after "from"',
  });

/* ========== Hold / Booking Body ==========
 * POST /consultations/hold
 * body: instructorId + offeringId + date + startHHMM + applicant + idempotencyKey?
 * ====================================== */
export const holdBodySchema = z
  .object({
    instructorId: objectId,
    offeringId: objectId,
    date: z.string().regex(YMD, 'Invalid date (YYYY-MM-DD)'),
    startHHMM: z.string().regex(HHMM, 'Invalid time (HH:mm)'),
    applicant: z
      .object({
        fullName: z.string().min(2).max(80),
        email: z.string().email(),
        whatsapp: z.string().min(6),
        issueDescription: z.string().max(1000).optional(),
        acceptedTerms: z.coerce.boolean().refine((v) => v === true, 'يجب الموافقة على الشروط'),
      })
      .strict(),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict();

export const bookingBodySchema = holdBodySchema;

/* ========== My Bookings Query ==========
 * GET /consultations/me
 * ====================================== */
export const listMineQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    status: z.enum(['confirmed', 'cancelled', 'refunded', 'completed']).optional(),
  })
  .strict();

/* ========== Common ==========
 * :id param + Reschedule body
 * ====================================== */
export const idParamSchema = z.object({ id: objectId }).strict();

export const rescheduleBodySchema = z
  .object({
    // ISO datetime: مثال "2025-10-05T14:30:00.000Z"
    newStartAt: z.string().datetime(),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict();

/* ========== Types ==========
 * مفيدة في السيرفس/الكونترولر
 * ====================================== */
export type ListOfferingsQuery = z.infer<typeof listOfferingsQuerySchema>;
export type ListInstructorsQuery = z.infer<typeof listInstructorsQuerySchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type RangeSlotsQuery = z.infer<typeof rangeSlotsQuerySchema>;
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
export type HoldBody = z.infer<typeof holdBodySchema>;
export type BookingBody = z.infer<typeof bookingBodySchema>;
export type ListMineQuery = z.infer<typeof listMineQuerySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type RescheduleBody = z.infer<typeof rescheduleBodySchema>;
