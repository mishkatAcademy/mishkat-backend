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
    // فلترة التصنيفات
    { $match: { isDeleted: false } },

    // نحسب عدد العناصر المرتبطة بهذه الفئة عبر lookup pipeline + count
    {
      $lookup: {
        from: collectionName,
        let: { catId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$isDeleted', false] }, { $in: ['$$catId', '$categories'] }],
              },
            },
          },
          { $count: 'count' },
        ],
        as: 'stats',
      },
    },

    {
      $addFields: {
        [countFieldName]: {
          $ifNull: [{ $first: '$stats.count' }, 0],
        },
      },
    },

    {
      $match: {
        [countFieldName]: { $gt: 0 },
      },
    },

    { $project: { stats: 0 } },
  ];

  return Category.aggregate(pipeline);
};
