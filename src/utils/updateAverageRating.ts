import { Types, Model } from 'mongoose';
import Review from '../models/Review';
import Book from '../models/Book';
import Course from '../models/Course';
import Consultation from '../models/ConsultationBooking';
import Research from '../models/ResearchRequest';

type TargetType = 'book' | 'course' | 'consultation' | 'research';

// عدّل القيمة الافتراضية لو تحب
const DEFAULT_AVG = 5;

const modelMap: Record<TargetType, Model<any>> = {
  book: Book,
  course: Course,
  consultation: Consultation,
  research: Research,
};

/**
 * يُعيد { avgRating, ratingsCount } بعد تحديث الهدف.
 * ملاحظات:
 * - يستخدم Aggregation داخل MongoDB لأداء أعلى.
 * - يراعي التحويل إلى ObjectId لو targetId كان string.
 */
export async function updateAverageRating(
  targetType: TargetType,
  targetId: string | Types.ObjectId,
): Promise<{ avgRating: number; ratingsCount: number }> {
  const Model = modelMap[targetType];
  if (!Model) {
    // نوع غير مدعوم (احتياطي)
    return { avgRating: DEFAULT_AVG, ratingsCount: 0 };
  }

  const _id = typeof targetId === 'string' ? new Types.ObjectId(targetId) : targetId;

  // احسب المتوسط والعدد على مستوى الداتابيز
  const [stat] = await Review.aggregate<{
    ratingsCount: number;
    avgRating: number;
  }>([
    { $match: { targetType, targetId: _id, isDeleted: false } },
    {
      $group: {
        _id: null,
        ratingsCount: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
    // تقطيع لرقم بعُشر (1 decimal place) داخل الأجريجيشن
    {
      $project: {
        _id: 0,
        ratingsCount: 1,
        avgRating: { $round: ['$avgRating', 1] },
      },
    },
  ]);

  const update = stat
    ? { avgRating: stat.avgRating, ratingsCount: stat.ratingsCount }
    : { avgRating: DEFAULT_AVG, ratingsCount: 0 };

  // تحديث الهدف
  await Model.updateOne({ _id }, { $set: update }).lean();

  return update;
}

export default updateAverageRating;
