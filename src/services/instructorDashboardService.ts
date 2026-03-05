// src/services/instructorDashboardService.ts
import ConsultationBooking from '../models/ConsultationBooking';
import ConsultationOffering from '../models/ConsultationOffering';
import InstructorProfile from '../models/InstructorProfile';
import AppError from '../utils/AppError';
import { dateInRiyadhToUTC } from '../utils/timeSlots';
import { fromHalalas } from '../utils/money';

export async function listMyInstructorConsultationsService(
  instructorUserId: string,
  input: { page?: number; limit?: number; status?: string; from?: string; to?: string },
) {
  // ✅ تأكد إنه Instructor وفعّال (اختياري لكن مفيد)
  const prof = await InstructorProfile.findOne({ user: instructorUserId }).select('_id isActive');
  if (!prof) throw AppError.notFound('Instructor profile not found');

  const page = Math.max(1, Number(input.page || 1));
  const limit = Math.min(100, Math.max(1, Number(input.limit || 10)));
  const skip = (page - 1) * limit;

  const q: any = { instructor: instructorUserId };

  if (input.status) q.status = input.status;

  // فلترة بالتاريخ (YYYY-MM-DD Riyadh day)
  if (input.from || input.to) {
    const fromUTC = input.from ? dateInRiyadhToUTC(input.from, '00:00') : undefined;
    const toUTC = input.to ? dateInRiyadhToUTC(input.to, '23:59') : undefined;

    q.start = {};
    if (fromUTC) q.start.$gte = fromUTC;
    if (toUTC) q.start.$lte = toUTC;
  }

  const [items, total] = await Promise.all([
    ConsultationBooking.find(q)
      .sort({ start: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'user', select: 'firstName lastName email avatarUrl isDeleted' })
      .lean(),
    ConsultationBooking.countDocuments(q),
  ]);

  const pages = Math.max(1, Math.ceil(total / limit));

  // ✅ totals بالريال (SAR) + الاحتفاظ بالهللة لو احتجتها
  const mapped = items.map((b: any) => ({
    ...b,
    totals: b.totals
      ? {
          currency: 'SAR',
          price: fromHalalas(b.totals.priceHalalas ?? 0),
          vat: fromHalalas(b.totals.vatHalalas ?? 0),
          grandTotal: fromHalalas(b.totals.grandTotalHalalas ?? 0),

          // اختياري: لو عايز تبقيهم
          priceHalalas: b.totals.priceHalalas,
          vatHalalas: b.totals.vatHalalas,
          grandTotalHalalas: b.totals.grandTotalHalalas,
        }
      : undefined,
  }));

  return {
    items: mapped,
    meta: { total, page, limit, pages, hasNextPage: page < pages, hasPrevPage: page > 1 },
  };
}

export async function listMySupportedOfferingsService(instructorUserId: string, activeOnly = true) {
  const prof = await InstructorProfile.findOne({ user: instructorUserId })
    .select('supportedTypes isActive')
    .lean();

  if (!prof) throw AppError.notFound('Instructor profile not found');

  const supportedTypes = (prof as any).supportedTypes || [];
  if (!supportedTypes.length) return { items: [] };

  const q: any = { type: { $in: supportedTypes } };
  if (activeOnly) q.isActive = true;

  const items = await ConsultationOffering.find(q).sort({ order: 1, createdAt: -1 }).lean();

  return {
    items: items.map((o: any) => ({
      ...o,
      price: {
        currency: 'SAR',
        value: fromHalalas(o.priceHalalas ?? 0),
        halalas: o.priceHalalas ?? 0,
      },
    })),
  };
}
