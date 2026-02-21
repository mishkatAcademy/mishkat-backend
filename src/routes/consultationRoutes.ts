// src/routes/consultationRoutes.ts
import { Router } from 'express';
import { z } from 'zod';

import {
  createConsultationOfferingCtrl,
  listOfferingsCtrl,
  listInstructorsCtrl,
  availabilityCtrl,
  rangeSlotsCtrl,
  createHoldAndPaymentCtrl,
  createBookingAliasCtrl,
  consultationWebhookCtrl,
  listMyConsultationsCtrl,
  getMyConsultationCtrl,
  rescheduleConsultationCtrl,
  cancelConsultationCtrl,
  calendarOverlayCtrl,
} from '../controllers/consultationController';

import { protect } from '../middlewares/authMiddleware';
import { validateRequest, validateQuery, validateRequestBody } from '../middlewares/validate';

import {
  listOfferingsQuerySchema,
  listInstructorsQuerySchema,
  availabilityQuerySchema,
  rangeSlotsQuerySchema,
  holdBodySchema,
  bookingBodySchema,
  listMineQuerySchema,
  idParamSchema,
  rescheduleBodySchema,
  calendarQuerySchema,
} from '../validations/consultation.schema';

import { isAdmin } from '../middlewares/authMiddleware';
import { createConsultationOfferingBodySchema } from '../validations/consultation.schema';

const instructorIdParamsSchema = z.object({
  instructorId: z.string().length(24, 'Invalid instructorId'),
});

const router = Router();

// admin only Create offering
router.post(
  '/offering',
  protect,
  isAdmin,
  validateRequest({ body: createConsultationOfferingBodySchema }),
  createConsultationOfferingCtrl,
);

/** 🟢 Public: offerings & instructors */
router.get('/offerings', validateQuery(listOfferingsQuerySchema), listOfferingsCtrl);
router.get('/instructors', validateQuery(listInstructorsQuerySchema), listInstructorsCtrl);

/** 🟢 Public: availability & range slots */
router.get(
  '/instructors/:instructorId/availability',
  validateRequest({ params: instructorIdParamsSchema, query: availabilityQuerySchema }),
  availabilityCtrl,
);

router.get(
  '/instructors/:instructorId/slots',
  validateRequest({ params: instructorIdParamsSchema, query: rangeSlotsQuerySchema }),
  rangeSlotsCtrl,
);

router.get(
  '/instructors/:instructorId/calendar',
  validateRequest({ params: instructorIdParamsSchema, query: calendarQuerySchema }),
  calendarOverlayCtrl,
);

/** 🟢 Public: create hold + payment (والـ alias /bookings) */
router.post('/hold', validateRequestBody(holdBodySchema), createHoldAndPaymentCtrl);
router.post('/bookings', validateRequestBody(bookingBodySchema), createBookingAliasCtrl);

/** 🟢 Public: payment webhook (سيبه بدون validate لو هتتحقق من التوقيع بـ raw body) */
router.post('/webhook/moyasar', consultationWebhookCtrl);

/** 🔐 Protected: my bookings */
router.use(protect);

router.get('/me', validateQuery(listMineQuerySchema), listMyConsultationsCtrl);

router.get('/me/:id', validateRequest({ params: idParamSchema }), getMyConsultationCtrl);

router.post(
  '/me/:id/reschedule',
  validateRequest({ params: idParamSchema, body: rescheduleBodySchema }),
  rescheduleConsultationCtrl,
);

router.post('/me/:id/cancel', validateRequest({ params: idParamSchema }), cancelConsultationCtrl);

export default router;
