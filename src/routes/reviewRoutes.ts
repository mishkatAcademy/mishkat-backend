// مجرد بداية الشغل الأساسي في version II إن شاء الله

import express from 'express';
import {
  createReview,
  getReviewsForTarget,
  getMyReviewForTarget,
  updateMyReview,
  deleteMyReview,
} from '../controllers/reviewController';

import { protect } from '../middlewares/authMiddleware';
import { validateRequestBody } from '../middlewares/validate';
import { validateRequestParams } from '../middlewares/validate';

import {
  createReviewSchema,
  updateReviewSchema,
  reviewParamsSchema,
} from '../validations/review.schema';

const router = express.Router();

// 🛡️ حماية كل المسارات
router.use(protect);

// ✅ إنشاء تقييم جديد
router.post('/', validateRequestBody(createReviewSchema), createReview);

// ✅ جلب كل التقييمات لخدمة معينة (كتاب - كورس - استشارة - بحث)
router.get(
  '/:targetType/:targetId',
  validateRequestParams(reviewParamsSchema),
  getReviewsForTarget,
);

// ✅ جلب تقييم المستخدم لهذا الهدف
router.get(
  '/:targetType/:targetId/my',
  validateRequestParams(reviewParamsSchema),
  getMyReviewForTarget,
);

// ✅ تعديل تقييم المستخدم
router.patch(
  '/:targetType/:targetId',
  validateRequestParams(reviewParamsSchema),
  validateRequestBody(updateReviewSchema),
  updateMyReview,
);

// ✅ حذف تقييم المستخدم
router.delete('/:targetType/:targetId', validateRequestParams(reviewParamsSchema), deleteMyReview);

export default router;
