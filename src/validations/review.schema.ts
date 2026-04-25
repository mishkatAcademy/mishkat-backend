// مجرد بداية الشغل الأساسي في version II إن شاء الله

import { z } from 'zod';
import mongoose from 'mongoose';

// 🟡 أنواع المسموح بها للتقييم
import { REVIEW_TARGETS } from '../models/Review';

// ✅ للتحقق من المعاملات (params)
export const reviewParamsSchema = z.object({
  params: z.object({
    targetType: z.enum(REVIEW_TARGETS, {
      errorMap: () => ({ message: 'نوع التقييم غير صالح' }),
    }),
    targetId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'معرّف الهدف غير صالح',
    }),
  }),
});

// ✅ لإنشاء تقييم جديد
export const createReviewSchema = z.object({
  body: z.object({
    targetType: z.enum(REVIEW_TARGETS, {
      errorMap: () => ({ message: 'نوع التقييم غير صالح' }),
    }),
    targetId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'معرّف الهدف غير صالح',
    }),
    rating: z
      .number({ invalid_type_error: 'التقييم يجب أن يكون رقمًا' })
      .min(1, 'الحد الأدنى للتقييم هو 1')
      .max(5, 'الحد الأقصى للتقييم هو 5'),
    comment: z.string().max(500, 'التعليق طويل جدًا').optional(),
  }),
});

// ✅ لتعديل تقييم
export const updateReviewSchema = z.object({
  body: z
    .object({
      rating: z
        .number({ invalid_type_error: 'التقييم يجب أن يكون رقمًا' })
        .min(1, 'الحد الأدنى للتقييم هو 1')
        .max(5, 'الحد الأقصى للتقييم هو 5')
        .optional(),
      comment: z.string().max(500, 'التعليق طويل جدًا').optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'يرجى إدخال حقل واحد على الأقل لتعديل التقييم',
    }),
});
