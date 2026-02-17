// src/routes/instructorRoutes.ts
import { Router } from 'express';
import { protect, isAdmin } from '../middlewares/authMiddleware';
import { validateRequest, validateRequestBody, validateQuery } from '../middlewares/validate';

import {
  createInstructorProfileSchema,
  updateInstructorProfileSchema,
  selfUpdateInstructorProfileSchema,
  instructorIdParamsSchema,
  listInstructorsAdminQuerySchema,
  weeklyReplaceSchema,
  exceptionDateParamsSchema,
  upsertExceptionBodySchema,
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

/** 👑 Admin */
router.use(protect, isAdmin);

// إنشاء بروفايل
router.post('/', validateRequestBody(createInstructorProfileSchema), adminCreateInstructorCtrl);

// قائمة المدرّسين
router.get('/', validateQuery(listInstructorsAdminQuerySchema), listInstructorsAdminCtrl);

// بروفايل واحد
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
