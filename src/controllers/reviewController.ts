import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { ReviewTargetType } from '../models/Review';
import {
  createReviewService,
  getReviewsForTargetService,
  getMyReviewForTargetService,
  updateMyReviewService,
  deleteMyReviewService,
} from '../services/reviewService';

import Review from '../models/Review';
import { updateAverageRating } from '../utils/updateAverageRating';

import Book from '../models/Book';
import Course from '../models/Course';
import Consultation from '../models/ConsultationBooking';
import Research from '../models/ResearchRequest';
import { Model } from 'mongoose';

// 🧠 خريطة للنماذج المرتبطة بالتقييم
const modelMap: Record<ReviewTargetType, Model<any>> = {
  book: Book,
  course: Course,
  consultation: Consultation,
  research: Research,
};

/*
| الوظيفة                | الوصف                                                         |
| ---------------------- | ------------------------------------------------------------- |
| `createReview`         | إضافة تقييم جديد للهدف (كتاب / كورس / خدمة...)                |
| `getReviewsForTarget`  | جلب كل التقييمات الخاصة بهدف معين                             |
| `getMyReviewForTarget` | جلب تقييم المستخدم الحالي لهدف معين (لو عايز يعرضه أو يعدّله) |
| `updateMyReview`       | تعديل تقييم المستخدم الحالي                                   |
| `deleteMyReview`       | حذف تقييم المستخدم الحالي                                     |
*/

// ✅ 1. إنشاء تقييم جديد
export const createReview = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { targetId, targetType, rating, comment } = req.body as {
    targetId: string;
    targetType: ReviewTargetType;
    rating: number;
    comment?: string;
  };

  const userId = req.user?.id?.toString();
  if (!userId) throw AppError.unauthorized('Unauthorized');

  const review = await createReviewService({
    userId,
    targetId,
    targetType,
    rating,
    comment: comment?.trim(),
  });

  res.status(201).json({
    status: 'success',
    message: 'تم إضافة التقييم بنجاح ✅',
    data: review,
  });
});

// ✅ 2. جلب كل التقييمات لخدمة معينة
export const getReviewsForTarget = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { targetId, targetType } =
      (req.validated?.params as {
        targetId: string;
        targetType: ReviewTargetType;
      }) ?? req.params;

    const reviews = await getReviewsForTargetService(targetId, targetType);

    res.status(200).json({
      status: 'success',
      count: reviews.length,
      data: reviews,
    });
  },
);

// ✅ 3. جلب تقييم المستخدم الحالي لخدمة معينة
export const getMyReviewForTarget = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { targetId, targetType } =
      (req.validated?.params as {
        targetId: string;
        targetType: ReviewTargetType;
      }) ?? req.params;

    const userId = req.user!.id.toString();

    const review = await getMyReviewForTargetService(userId, targetId, targetType);

    res.status(200).json({
      status: 'success',
      data: review,
    });
  },
);

// ✅ 4. تعديل تقييم المستخدم لخدمة معينة
export const updateMyReview = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { targetId, targetType } =
      (req.validated?.params as {
        targetId: string;
        targetType: ReviewTargetType;
      }) ?? req.params;

    const userId = req.user!.id.toString();

    const updateData = {
      ...(req.body.rating !== undefined && { rating: req.body.rating }),
      ...(req.body.comment !== undefined && {
        comment: req.body.comment.trim(),
      }),
    };

    const review = await updateMyReviewService(userId, targetId, targetType, updateData);

    res.status(200).json({
      status: 'success',
      message: 'تم تعديل التقييم بنجاح ✅',
      data: review,
    });
  },
);

// ✅ 5. حذف تقييم المستخدم الحالي لخدمة معينة
export const deleteMyReview = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { targetId, targetType } =
      (req.validated?.params as {
        targetId: string;
        targetType: ReviewTargetType;
      }) ?? req.params;

    const userId = req.user!.id.toString();

    await deleteMyReviewService(userId, targetId, targetType);

    res.status(200).json({
      status: 'success',
      message: 'تم حذف التقييم بنجاح ✅',
    });
  },
);
