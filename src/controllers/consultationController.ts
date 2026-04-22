// src/controllers/consultationController.ts
import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok, created } from '../utils/response';

import {
  createConsultationOffering,
  listOfferingsService,
  listInstructorsService,
  getPublicInstructorByUserIdService,
  availabilityService,
  rangeSlotsPublicService,
  createHoldAndPaymentService,
  handleConsultationWebhook,
  listMyConsultationsService,
  getMyConsultationService,
  rescheduleConsultationService,
  cancelConsultationService,
  calendarOverlayService,
} from '../services/consultationService';

/** POST /consultations/offering */
export const createConsultationOfferingCtrl = catchAsync(async (req: Request, res: Response) => {
  const body = (req.validated?.body ?? req.body) as any;
  const offering = await createConsultationOffering(body);
  return created(res, { offering });
});

/** GET /consultations/offerings */
export const listOfferingsCtrl = catchAsync(async (req: Request, res: Response) => {
  const { type, activeOnly } = (req.validated?.query as any) || {};
  const items = await listOfferingsService(type, activeOnly !== false);
  return ok(res, { offerings: items });
});

/** GET /consultations/instructors */
export const listInstructorsCtrl = catchAsync(async (req: Request, res: Response) => {
  const { type, activeOnly } = (req.validated?.query as any) || {};
  const items = await listInstructorsService({ type, activeOnly: activeOnly !== false });
  return ok(res, { instructors: items });
});

/** GET /consultations/instructors/:userId */
export const getPublicInstructorCtrl = catchAsync(async (req, res) => {
  // هنا بنبعت ال userId وليس ال instructorId
  const { userId } = req.params;
  const { type, activeOnly } = (req.validated?.query as any) ?? req.query;

  const instructor = await getPublicInstructorByUserIdService(String(userId), {
    type,
    activeOnly: activeOnly !== 'false' && activeOnly !== false,
  });

  return ok(res, { instructor });
});

/** GET /consultations/instructors/:instructorId/availability?date=YYYY-MM-DD&offeringId=... */
export const availabilityCtrl = catchAsync(async (req: Request, res: Response) => {
  // هنا بنرسل ال instructorId
  const { instructorId } = (req.validated?.params as { instructorId?: string }) ?? req.params;
  const { date, offeringId } = (req.validated?.query as { date: string; offeringId: string })!;

  const slots = await availabilityService({
    instructorId: String(instructorId),
    date,
    offeringId,
  });

  return ok(res, { slots });
});

/** GET /consultations/instructors/:instructorId/slots?from=...&to=...&offeringId=... */
export const rangeSlotsCtrl = catchAsync(async (req: Request, res: Response) => {
  const { instructorId } = (req.validated?.params as { instructorId?: string }) ?? req.params;
  const { from, to, offeringId } = (req.validated?.query as any) || {};
  const slotsByDate = await rangeSlotsPublicService(String(instructorId), from, to, offeringId);
  return ok(res, { slotsByDate });
});

/** GET /consultations/instructors/:instructorId/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD */
export const calendarOverlayCtrl = catchAsync(async (req: Request, res: Response) => {
  const { instructorId } = (req.validated?.params as { instructorId?: string }) ?? req.params;
  const { from, to } = (req.validated?.query as any) || {};

  const data = await calendarOverlayService({
    instructorId: String(instructorId),
    from,
    to,
  });

  if (!req.user) {
    const { busy, ...safe } = data as any;
    return ok(res, safe);
  }

  return ok(res, data);
});

export const createHoldAndPaymentCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id?.toString();
  const { instructorId, offeringId, date, startHHMM, applicant, idempotencyKey } =
    (req.validated?.body as any) || req.body;

  const result = await createHoldAndPaymentService({
    userId,
    instructorId,
    offeringId,
    date,
    startHHMM,
    applicant,
    idempotencyKey,
  });

  return created(res, result);
});

/** alias: POST /consultations/bookings → نفس نتيجة createHoldAndPaymentCtrl */
export const createBookingAliasCtrl = createHoldAndPaymentCtrl;

/** POST /consultations/webhook/moyasar (عام) */
export const consultationWebhookCtrl = catchAsync(async (req: Request, res: Response) => {
  const result = await handleConsultationWebhook(req.body);
  return ok(res, result);
});

/** GET /consultations/me */
export const listMyConsultationsCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id.toString();
  const { page = 1, limit = 10 } = ((req.validated?.query as any) || {}) as {
    page?: number;
    limit?: number;
  };
  const result = await listMyConsultationsService(userId, Number(page), Number(limit));
  // لو حابب تلفّها في مفتاح: return ok(res, { bookings: result.items }, result.meta);
  return ok(res, result.items, result.meta);
});

/** GET /consultations/me/:id */
export const getMyConsultationCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id.toString();
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  const booking = await getMyConsultationService(userId, String(id));
  return ok(res, { booking });
});

/** POST /consultations/me/:id/reschedule */
export const rescheduleConsultationCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id.toString();
  const { id, consultationId } =
    (req.validated?.params as { id?: string; consultationId?: string }) ?? req.params;
  const bookingId = String(id ?? consultationId);
  const { newStartAt } = (req.validated?.body as { newStartAt: string }) ?? req.body;

  const booking = await rescheduleConsultationService(userId, bookingId, newStartAt);
  return ok(res, { booking });
});

/** POST /consultations/me/:id/cancel */
export const cancelConsultationCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id.toString();
  const { id, consultationId } =
    (req.validated?.params as { id?: string; consultationId?: string }) ?? req.params;
  const bookingId = String(id ?? consultationId);

  const result = await cancelConsultationService(userId, bookingId);
  return ok(res, result);
});
