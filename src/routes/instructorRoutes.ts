// src/routes/instructorRoutes.ts
import { Router } from 'express';
import { protect, isAdmin } from '../middlewares/authMiddleware';
import { validateRequest, validateRequestBody, validateQuery } from '../middlewares/validate';

import {
  instructorMyConsultationsQuerySchema,
  myOfferingsQuerySchema,
} from '../validations/instructorConsultations.schema';
import {
  listMyInstructorConsultationsCtrl,
  listMySupportedOfferingsCtrl,
} from '../controllers/instructorDashboardController';

import {
  createInstructorProfileSchema,
  updateInstructorProfileSchema,
  selfUpdateInstructorProfileSchema,
  instructorIdParamsSchema,
  listInstructorsAdminQuerySchema,
  weeklyReplaceSchema,
  exceptionDateParamsSchema,
  upsertExceptionBodySchema,
  weeklyItemIdParamsSchema,
  addWeeklyItemBodySchema,
  updateWeeklyItemBodySchema,
  offRangeBodySchema,
  addSlotsToDayBodySchema,
} from '../validations/instructor.schema';

import {
  getMyInstructorProfileCtrl,
  updateMyInstructorProfileCtrl,
  adminCreateInstructorCtrl,
  listInstructorsAdminCtrl,
  getInstructorProfileCtrl,
  adminUpdateInstructorCtrl,
  activateInstructorCtrl,
  deactivateInstructorCtrl,
  updateMyWeeklyCtrl,
  upsertMyExceptionCtrl,
  deleteMyExceptionCtrl,
  addWeeklyItemCtrl,
  deleteWeeklyItemCtrl,
  updateWeeklyItemCtrl,
  setDayOffCtrl,
  setOffRangeCtrl,
  addSlotsToDayCtrl,
  rehydrateMyWeeklyCtrl,
} from '../controllers/instructorController';

const router = Router();

/** 🧑‍🏫 مدرس: يجلب ويعدّل بروفايله */
router.use('/me', protect);

router.get('/me', getMyInstructorProfileCtrl);

router.patch(
  '/me',
  validateRequestBody(selfUpdateInstructorProfileSchema),
  updateMyInstructorProfileCtrl,
);

/** ✅ Atomic: weekly & exceptions */
router.put('/me/weekly', validateRequestBody(weeklyReplaceSchema), updateMyWeeklyCtrl);

router.put(
  '/me/exceptions/:dateYMD',
  validateRequest({ params: exceptionDateParamsSchema, body: upsertExceptionBodySchema }),
  upsertMyExceptionCtrl,
);

router.delete(
  '/me/exceptions/:dateYMD',
  validateRequest({ params: exceptionDateParamsSchema }),
  deleteMyExceptionCtrl,
);

// 1) add weekly item
router.post('/me/weekly/items', validateRequestBody(addWeeklyItemBodySchema), addWeeklyItemCtrl);

// 2) delete weekly item
router.delete(
  '/me/weekly/items/:itemId',
  validateRequest({ params: weeklyItemIdParamsSchema }),
  deleteWeeklyItemCtrl,
);

// 3) update weekly item
router.patch(
  '/me/weekly/items/:itemId',
  validateRequest({ params: weeklyItemIdParamsSchema, body: updateWeeklyItemBodySchema }),
  updateWeeklyItemCtrl,
);

// 4) make day off
router.post(
  '/me/exceptions/:dateYMD/off',
  validateRequest({ params: exceptionDateParamsSchema }),
  setDayOffCtrl,
);

// 6) off range
router.post('/me/exceptions/off-range', validateRequestBody(offRangeBodySchema), setOffRangeCtrl);

// 7) add available slots to day
router.post(
  '/me/exceptions/:dateYMD/slots',
  validateRequest({ params: exceptionDateParamsSchema, body: addSlotsToDayBodySchema }),
  addSlotsToDayCtrl,
);

// ...
router.get(
  '/me/consultations',
  validateQuery(instructorMyConsultationsQuerySchema),
  listMyInstructorConsultationsCtrl,
);

router.get('/me/offerings', validateQuery(myOfferingsQuerySchema), listMySupportedOfferingsCtrl);

/* راوت مؤقت لإضافة id لعناصر ال weekly القديمة */
// تم إلغاؤه
// router.post('/me/weekly/rehydrate', rehydrateMyWeeklyCtrl);

/** 👑 Admin */
router.use(protect, isAdmin);

// إنشاء بروفايل
// ليس له UI
router.post('/', validateRequestBody(createInstructorProfileSchema), adminCreateInstructorCtrl);

// قائمة المدرّسين
router.get('/', validateQuery(listInstructorsAdminQuerySchema), listInstructorsAdminCtrl);

// بروفايل واحد
// userId not instructorId
router.get(
  '/:userId',
  validateRequest({ params: instructorIdParamsSchema }),
  getInstructorProfileCtrl,
);

// تعديل بروفايل
router.patch(
  '/:userId',
  validateRequest({ params: instructorIdParamsSchema, body: updateInstructorProfileSchema }),
  adminUpdateInstructorCtrl,
);

// تفعيل/تعطيل
router.patch(
  '/:userId/activate',
  validateRequest({ params: instructorIdParamsSchema }),
  activateInstructorCtrl,
);
router.patch(
  '/:userId/deactivate',
  validateRequest({ params: instructorIdParamsSchema }),
  deactivateInstructorCtrl,
);

export default router;
