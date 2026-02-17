import Review from '../models/Review';
import { updateAverageRating } from '../utils/updateAverageRating';
import { ReviewTargetType } from '../models/Review';
import { AppError } from '../utils/AppError';
import { Types } from 'mongoose';

/* HELPER METHOD */
import Book from '../models/Book';
import Course from '../models/Course';
import Consultation from '../models/ConsultationBooking';
import Research from '../models/ResearchRequest';
import { Model } from 'mongoose';

// خريطة النماذج حسب النوع
const modelMap: Record<ReviewTargetType, Model<any>> = {
  book: Book,
  course: Course,
  consultation: Consultation,
  research: Research,
};

export const checkTargetExists = async (targetType: ReviewTargetType, targetId: string) => {
  // ✅ التحقق من نوع الخدمة
  const TargetModel = modelMap[targetType];
  if (!TargetModel) {
    throw new AppError('نوع الهدف غير مدعوم', 400);
  }

  // ✅ التحقق من وجود عنصر الخدمة
  const doc = await TargetModel.findById(targetId);
  if (!doc || doc.isDeleted) {
    throw new AppError('العنصر غير موجود أو محذوف', 404);
  }

  return doc;
};

/*
// createReviewService
// getReviewsForTargetService
// getMyReviewService
// updateMyReviewService
// deleteMyReviewService
*/

export const createReviewService = async ({
  userId,
  targetId,
  targetType,
  rating,
  comment,
}: {
  userId: string;
  targetId: string;
  targetType: ReviewTargetType;
  rating: number;
  comment?: string;
}) => {
  // ✅ التحقق من نوع الخدمة والتحقق من وجود عنصر الخدمة
  await checkTargetExists(targetType, targetId);

  // ✅ التحقق من وجود تقييم مسبق
  const existingReview = await Review.findOne({
    user: userId,
    targetId,
    targetType,
    isDeleted: false,
  });

  if (existingReview) {
    throw new AppError('لقد قمت بتقييم هذا العنصر من قبل', 400);
  }

  // ✅ إنشاء التقييم
  const review = await Review.create({
    user: userId,
    targetId,
    targetType,
    rating,
    comment,
  });

  // ✅ تعديل قيمة متوسط التقييم وعدد التقييمات للعنصر
  await updateAverageRating(targetType, targetId);

  return review;
};

export const getReviewsForTargetService = async (
  targetId: string,
  targetType: ReviewTargetType,
) => {
  // ✅ التحقق من نوع الخدمة والتحقق من وجود عنصر الخدمة
  await checkTargetExists(targetType, targetId);

  const reviews = await Review.find({
    targetId,
    targetType,
    isDeleted: false,
  })
    .populate('user', 'firstName lastName avatar')
    .sort({ createdAt: -1 });

  return reviews;
};

export const getMyReviewForTargetService = async (
  userId: string,
  targetId: string,
  targetType: string,
) => {
  const review = await Review.findOne({
    targetId,
    targetType,
    user: userId,
    isDeleted: false,
  });

  if (!review) {
    throw new AppError('لم تقم بتقييم هذا العنصر من قبل', 404);
  }

  return review;
};

export const updateMyReviewService = async (
  userId: string,
  targetId: string,
  targetType: ReviewTargetType,
  updateData: Partial<{ rating: number; comment: string }>,
) => {
  const review = await Review.findOneAndUpdate(
    {
      user: userId,
      targetId,
      targetType,
      isDeleted: false,
    },
    updateData,
    { new: true, runValidators: true },
  );

  if (!review) {
    throw new AppError('التقييم غير موجود', 404);
  }

  await updateAverageRating(targetType, targetId);

  return review;
};

export const deleteMyReviewService = async (
  userId: string,
  targetId: string,
  targetType: ReviewTargetType,
) => {
  const review = await Review.findOneAndUpdate(
    {
      user: userId,
      targetId,
      targetType,
      isDeleted: false,
    },
    { isDeleted: true },
  );

  if (!review) {
    throw new AppError('التقييم غير موجود', 404);
  }

  await updateAverageRating(targetType, targetId);
};
