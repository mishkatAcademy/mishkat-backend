// src/utils/aggregationHelper.ts
import type { PipelineStage } from 'mongoose';
import Category from '../models/Category';

type CollectionName = 'books' | 'courses';

/**
 * يرجّع التصنيفات التي لديها عناصر (كتب/كورسات) + الحقل booksCount/coursesCount
 * دون جلب العناصر نفسها (أداء أعلى).
 */
export const getCategoriesWithItems = async (collectionName: CollectionName) => {
  const countFieldName = collectionName === 'books' ? 'booksCount' : 'coursesCount';

  const pipeline: PipelineStage[] = [
    // فلترة التصنيفات بدري
    { $match: { isDeleted: false } },

    // احسب عدد العناصر المرتبطة بهذه الفئة عبر lookup pipeline + count
    {
      $lookup: {
        from: collectionName, // تأكد إنه اسم الـ collection الحقيقي في Mongo
        let: { catId: '$_id' },
        pipeline: [
          // طابق العناصر اللي تحتوي هذه الفئة داخل مصفوفة categories
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$isDeleted', false] }, { $in: ['$$catId', '$categories'] }],
              },
            },
          },
          // عدّ فقط بدون إرجاع المستندات
          { $count: 'count' },
        ],
        as: 'stats',
      },
    },

    // أضف الحقل {booksCount|coursesCount}
    {
      $addFields: {
        [countFieldName]: {
          $ifNull: [{ $first: '$stats.count' }, 0],
        },
      },
    },

    // رجّع فقط التصنيفات اللي عدّها > 0
    {
      $match: {
        [countFieldName]: { $gt: 0 },
      },
    },

    // أسقط الحقل المؤقت
    { $project: { stats: 0 } },
  ];

  return Category.aggregate(pipeline);
};
