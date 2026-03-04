// src/services/consultationService.ts
import { Types } from 'mongoose';
import { addMinutes, addDays, parseISO } from 'date-fns';
import AppError from '../utils/AppError';
import InstructorProfile from '../models/InstructorProfile';
import ConsultationOffering from '../models/ConsultationOffering';
import ConsultationHold from '../models/ConsultationHold';
import ConsultationBooking from '../models/ConsultationBooking';
import { createMoyasarPayment, MoyasarWebhookPayload } from '../utils/payments/moyasar';
import { env } from '../config/env';
import {
  dayIndexSaturday0,
  generateSlotsForWindow,
  overlaps,
  dateInRiyadhToUTC,
} from '../utils/timeSlots';
import { saveOnce, getIfExists } from '../utils/inMemoryOnceStore';
import { toRiyadhYMD } from '../utils/time';
import { toHalalas, fromHalalas } from '../utils/money';
import { createOrderForConsultationPaid } from './orderService';

import type { CreateConsultationOfferingBody } from '../validations/consultation.schema';

type HoldPaymentResult = {
  hold: { id: string; status: string; expiresAt: Date };
  payment: {
    provider: 'moyasar';
    paymentUrl: string;
    paymentId: string;
    currency: 'SAR';
    amount: number;
    amountHalalas?: number;
  };
  bookingPreview: {
    instructorId: string;
    offeringId: string;
    date: string;
    startHHMM: string;
    startUtc: Date;
    endUtc: Date;
    durationMinutes: number;
  };
  totals: {
    price: number;
    vat: number;
    grandTotal: number;
    priceHalalas?: number;
    vatHalalas?: number;
    grandTotalHalalas?: number;
  };
};

function bookingToPublicDTO(b: any) {
  const t = b?.totals || {};
  return {
    ...b,
    totals: {
      // SAR (for UI)
      price: typeof t.priceHalalas === 'number' ? fromHalalas(t.priceHalalas) : 0,
      vat: typeof t.vatHalalas === 'number' ? fromHalalas(t.vatHalalas) : 0,
      grandTotal: typeof t.grandTotalHalalas === 'number' ? fromHalalas(t.grandTotalHalalas) : 0,
      currency: 'SAR' as const,

      // keep halalas (backward)
      priceHalalas: t.priceHalalas,
      vatHalalas: t.vatHalalas,
      grandTotalHalalas: t.grandTotalHalalas,
    },
  };
}

// إعدادات افتراضية من env (يرجى تعريفها في env.ts مع Defaults)
const HOLD_TTL_MINUTES = env.CONSULTATION_HOLD_TTL_MINUTES ?? 15;
const DEFAULT_CANCEL_WINDOW_HOURS = env.CONSULTATION_CANCEL_WINDOW_HOURS ?? 24;

/* =================== Offerings =================== */
export async function createConsultationOffering(data: CreateConsultationOfferingBody) {
  const ar = data.title?.ar?.trim();
  const en = data.title?.en?.trim();

  const maybeDup = await ConsultationOffering.findOne({
    type: data.type,
    isActive: true,
    $or: [...(ar ? [{ 'title.ar': ar }] : []), ...(en ? [{ 'title.en': en }] : [])],
  }).lean();

  if (maybeDup) {
    throw AppError.badRequest('Offering with same title already exists (active)');
  }

  const created = await ConsultationOffering.create({
    type: data.type,
    title: data.title,
    description: data.description,
    durationMinutes: data.durationMinutes,
    priceHalalas: toHalalas(data.priceSAR),
    isActive: data.isActive ?? true,
    order: data.order ?? 0,
  });

  return created.toJSON();
}

export async function listOfferingsService(type?: any, activeOnly = true) {
  const q: any = {};
  if (type) q.type = type;
  if (activeOnly) q.isActive = true;

  const docs = await ConsultationOffering.find(q).sort({ order: 1, createdAt: -1 });
  return docs.map((d) => d.toJSON());
}

/* =================== Instructors =================== */
export async function listInstructorsService(opts: {
  type?: 'academic' | 'social' | 'coaching';
  activeOnly?: boolean;
}) {
  const { type, activeOnly = true } = opts || {};
  const q: any = {};
  if (activeOnly) q.isActive = true;
  if (type) q.supportedTypes = type;
  return InstructorProfile.find(q).lean();
}

export async function getPublicInstructorByUserIdService(
  userId: string,
  opts?: { activeOnly?: boolean; type?: 'academic' | 'social' | 'coaching' },
) {
  const activeOnly = opts?.activeOnly !== false;

  const q: any = { user: userId };
  if (activeOnly) q.isActive = true;
  if (opts?.type) q.supportedTypes = opts.type;

  const prof = await InstructorProfile.findOne(q)
    .populate({ path: 'user', select: 'firstName lastName avatarUrl isDeleted' })
    .lean();

  if (!prof || (prof as any).user?.isDeleted) throw AppError.notFound('Instructor not found');

  const u: any = prof.user;

  // Public DTO فقط
  return {
    userId: String(u?._id ?? prof.user),
    displayName: prof.displayName ?? { ar: `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() },
    headline: prof.headline,
    bio: prof.bio,
    academicDegree: prof.academicDegree,
    experiences: prof.experiences,
    certifications: prof.certifications,
    supportedTypes: prof.supportedTypes,
    timezone: prof.timezone,
    bufferMinutes: prof.bufferMinutes,
    minNoticeHours: prof.minNoticeHours,
    maxAdvanceDays: prof.maxAdvanceDays,
    rescheduleWindowHours: prof.rescheduleWindowHours,
    weekly: prof.weekly,
    exceptions: prof.exceptions,
    meetingMethod: prof.meetingMethod,
    meetingUrl: prof.meetingUrl, // لو meetingUrl حساس، رجّعه فقط بعد الدفع/للمستخدمين
    isActive: prof.isActive,
    avatarUrl: u?.avatarUrl,
  };
}

function ensureDate(v: any, label: string): Date {
  const d = v instanceof Date ? v : new Date(v);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw AppError.badRequest(`Invalid ${label}`);
  }
  return d;
}

/* ============= مساعد داخلي: توفّر ليوم بمدة صريحة ============= */
async function computeAvailabilityForDayWithDuration(
  instructorUserId: string,
  date: string, // YYYY-MM-DD (محلي سعودي)
  durationMinutes: number,
) {
  const inst = await InstructorProfile.findOne({ user: instructorUserId, isActive: true }).lean();
  if (!inst) throw AppError.notFound('المدرّس غير موجود/غير فعّال');

  const buffer = inst.bufferMinutes ?? env.CONSULTATION_BUFFER_MINUTES ?? 0;
  const minNotice = inst.minNoticeHours ?? env.CONSULTATION_MIN_NOTICE_HOURS ?? 0;

  const now = new Date();
  const minStartUTC = new Date(now.getTime() + minNotice * 3600 * 1000);

  const dayIx = dayIndexSaturday0(date);

  const dayMidnightUTC = ensureDate(dateInRiyadhToUTC(date, '00:00'), 'date midnight');

  // هل في استثناء لهذا اليوم؟

  const exception = (inst.exceptions || []).find((e: any) => {
    const expDate = ensureDate(e.date, 'exception.date');
    return (
      expDate.getUTCFullYear() === dayMidnightUTC.getUTCFullYear() &&
      expDate.getUTCMonth() === dayMidnightUTC.getUTCMonth() &&
      expDate.getUTCDate() === dayMidnightUTC.getUTCDate()
    );
  });

  if (exception?.closed) return [];

  // نوافذ اليوم
  const windows = exception?.slots?.length
    ? exception.slots
    : (inst.weekly || []).filter((w) => w.day === dayIx);

  if (!windows.length) return [];

  // سلوتس خام
  const raw = windows.flatMap((w) =>
    generateSlotsForWindow(date, w.start, w.end, durationMinutes, buffer),
  );
  if (!raw.length) return [];

  // فلتر minNotice
  const afterNotice = raw.filter((s) => s.start >= minStartUTC);

  const dayStart = ensureDate(dateInRiyadhToUTC(date, '00:00'), 'dayStart');
  const dayEnd = ensureDate(dateInRiyadhToUTC(date, '23:59'), 'dayEnd');

  const [bookings, holds] = await Promise.all([
    ConsultationBooking.find({
      instructor: instructorUserId,
      status: { $in: ['confirmed', 'completed', 'refunded'] },
      start: { $lt: dayEnd },
      end: { $gt: dayStart },
    })
      .setOptions({ sanitizeFilter: false })
      .select('start end')
      .lean(),

    ConsultationHold.find({
      instructor: instructorUserId,
      status: 'holding',
      expiresAt: { $gt: new Date() },
      start: { $lt: dayEnd },
      end: { $gt: dayStart },
    })
      .setOptions({ sanitizeFilter: false })
      .select('start end')
      .lean(),
  ]);

  // const [bookings, holds] = await Promise.all([
  //   ConsultationBooking.find({
  //     instructor: instructorUserId,
  //     status: { $in: ['confirmed', 'completed', 'refunded'] },
  //     start: { $lt: dayEnd },
  //     end: { $gt: dayStart },
  //   })
  //     .select('start end')
  //     .lean(),
  //   ConsultationHold.find({
  //     instructor: instructorUserId,
  //     status: 'holding',
  //     expiresAt: { $gt: new Date() },
  //     start: { $lt: dayEnd },
  //     end: { $gt: dayStart },
  //   })
  //     .select('start end')
  //     .lean(),
  // ]);

  const blocked = [...bookings, ...holds];
  const free = afterNotice.filter(
    (s) => !blocked.some((b) => overlaps(s.start, s.end, b.start, b.end)),
  );

  return free;
}

/* ============= Availability (حسب Offering) ============= */
export async function availabilityService({
  instructorId,
  date,
  offeringId,
}: {
  instructorId: string; // id مستخدم المُدرّس (User._id)
  date: string;
  offeringId: string;
}) {
  const off = await ConsultationOffering.findById(offeringId).lean();
  if (!off || !off.isActive) throw AppError.notFound('العرض غير متاح');

  // المدرّس لازم يدعم النوع
  const inst = await InstructorProfile.findOne({ user: instructorId, isActive: true }).lean();
  if (!inst) throw AppError.notFound('المدرّس غير موجود/غير فعّال');
  if (!inst.supportedTypes.includes(off.type)) {
    throw AppError.badRequest('هذا المدرّس لا يقدّم هذا النوع من الاستشارات');
  }

  const slots = await computeAvailabilityForDayWithDuration(
    instructorId,
    date,
    off.durationMinutes,
  );
  return slots.map((s) => ({ start: s.start, end: s.end }));
}

/* ============= Availability Range (from..to) ============= */
export async function rangeSlotsService({
  instructorId,
  from,
  to,
  offeringId,
}: {
  instructorId: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  offeringId: string;
}) {
  const off = await ConsultationOffering.findById(offeringId).lean();
  if (!off || !off.isActive) throw AppError.notFound('العرض غير متاح');

  const start = dateInRiyadhToUTC(from, '00:00');
  const end = dateInRiyadhToUTC(to, '00:00');

  const out: Record<string, { start: Date; end: Date }[]> = {};
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const ymd = toRiyadhYMD(d);
    const list = await computeAvailabilityForDayWithDuration(
      instructorId,
      ymd,
      off.durationMinutes,
    );
    out[ymd] = list.map((s) => ({ start: s.start, end: s.end }));
  }
  return out;
}

/* ========= Availability Range calendar (from..to) ========= */
export async function calendarOverlayService({
  instructorId,
  from,
  to,
}: {
  instructorId: string;
  from: string; // YYYY-MM-DD (Riyadh)
  to: string; // YYYY-MM-DD (Riyadh)
}) {
  const inst = await InstructorProfile.findOne({ user: instructorId, isActive: true }).lean();
  if (!inst) throw AppError.notFound('المدرّس غير موجود/غير فعّال');

  const bufferMinutes = inst.bufferMinutes ?? env.CONSULTATION_BUFFER_MINUTES ?? 0;
  const minNoticeHours = inst.minNoticeHours ?? env.CONSULTATION_MIN_NOTICE_HOURS ?? 0;
  const maxAdvanceDays = inst.maxAdvanceDays ?? env.CONSULTATION_MAX_ADVANCE_DAYS ?? 30;
  const rescheduleWindowHours = inst.rescheduleWindowHours ?? 12;

  // const dayStart = dateInRiyadhToUTC(from, '00:00');
  // const dayEnd = dateInRiyadhToUTC(to, '23:59');

  const dayStart = ensureDate(dateInRiyadhToUTC(from, '00:00'), 'dayStart');
  const dayEnd = ensureDate(dateInRiyadhToUTC(to, '23:59'), 'dayEnd');

  // Exceptions داخل المدى (نقارن يوم/شهر/سنة على Riyadh midnight)
  const exceptions = (inst.exceptions || [])
    .map((e) => {
      const ymd = toRiyadhYMD(e.date);
      return {
        dateYMD: ymd,
        closed: !!e.closed,
        slots: e.slots?.length ? e.slots : undefined,
      };
    })
    .filter((e) => e.dateYMD >= from && e.dateYMD <= to);

  // Busy: bookings + holds
  const [bookings, holds] = await Promise.all([
    ConsultationBooking.find({
      instructor: instructorId,
      status: { $in: ['confirmed', 'completed', 'refunded'] },
      start: { $lt: dayEnd },
      end: { $gt: dayStart },
    })
      .select('start end status')
      .lean(),
    ConsultationHold.find({
      instructor: instructorId,
      status: 'holding',
      expiresAt: { $gt: new Date() },
      start: { $lt: dayEnd },
      end: { $gt: dayStart },
    })
      .select('start end expiresAt')
      .lean(),
  ]);

  const busy = [
    ...bookings.map((b) => ({
      kind: 'booking' as const,
      status: b.status,
      start: b.start,
      end: b.end,
    })),
    ...holds.map((h) => ({
      kind: 'hold' as const,
      start: h.start,
      end: h.end,
      expiresAt: h.expiresAt,
    })),
  ];

  return {
    timezone: inst.timezone || 'Asia/Riyadh',
    rules: { bufferMinutes, minNoticeHours, maxAdvanceDays, rescheduleWindowHours },
    weekly: inst.weekly || [],
    exceptions,
    busy,
  };
}

/* ============= Hold + Payment ============= */
export async function createHoldAndPaymentService({
  userId,
  instructorId,
  offeringId,
  date,
  startHHMM,
  applicant,
  idempotencyKey,
}: {
  userId?: string;
  instructorId: string;
  offeringId: string;
  date: string;
  startHHMM: string;
  applicant: {
    fullName: string;
    email: string;
    whatsapp: string;
    issueDescription?: string;
    acceptedTerms: boolean;
  };
  idempotencyKey?: string;
}) {
  // Idempotency
  if (idempotencyKey) {
    const cached = await getIfExists<HoldPaymentResult>(idempotencyKey);
    if (cached) return cached;
  }

  const inst = await InstructorProfile.findOne({ user: instructorId, isActive: true }).lean();
  if (!inst) throw AppError.notFound('المدرّس غير موجود/غير فعّال');

  const off = await ConsultationOffering.findById(offeringId).lean();
  if (!off || !off.isActive) throw AppError.notFound('العرض غير متاح');

  if (!inst.supportedTypes.includes(off.type)) {
    throw AppError.badRequest('هذا المدرّس لا يقدّم هذا النوع');
  }

  const start = dateInRiyadhToUTC(date, startHHMM);
  const end = new Date(start.getTime() + off.durationMinutes * 60 * 1000);

  // Guard: لا تتجاوز أقصى فترة حجز مسبق
  const maxAdvanceDays = inst.maxAdvanceDays ?? env.CONSULTATION_MAX_ADVANCE_DAYS ?? 30;
  const todayRiyadhStart = dateInRiyadhToUTC(toRiyadhYMD(new Date()), '00:00');
  if (start.getTime() - todayRiyadhStart.getTime() > maxAdvanceDays * 24 * 3600 * 1000) {
    throw AppError.badRequest('موعد أبعد من الحد الأقصى المسموح به للحجز المسبق');
  }

  // تأكيد أن السلوت مازال متاح (بدون استدعاء availabilityService لتقليل roundtrips)
  const todays = await computeAvailabilityForDayWithDuration(
    instructorId,
    date,
    off.durationMinutes,
  );
  const found = todays.some((s) => s.start.getTime() === start.getTime());
  if (!found) throw AppError.badRequest('السلوت المختار لم يعد متاحًا');

  const vat = Math.round(((env.VAT_PERCENT ?? 0) / 100) * off.priceHalalas);
  const grand = off.priceHalalas + vat;

  const hold = await ConsultationHold.create({
    user: userId ? new Types.ObjectId(userId) : undefined,
    instructor: new Types.ObjectId(instructorId),
    offering: new Types.ObjectId(offeringId),
    start,
    end,
    applicant: {
      fullName: applicant.fullName,
      email: applicant.email,
      whatsapp: applicant.whatsapp,
      issueDescription: applicant.issueDescription,
      acceptedTerms: !!applicant.acceptedTerms,
    },
    status: 'holding',
    expiresAt: new Date(
      Date.now() + (env.CONSULTATION_HOLD_TTL_MINUTES ?? HOLD_TTL_MINUTES) * 60 * 1000,
    ),
    payment: {
      provider: 'moyasar',
      amountHalalas: grand,
      currency: 'SAR',
      vatHalalas: vat,
    },
    idempotencyKey,
  });

  const pay = await createMoyasarPayment({
    amountHalalas: grand,
    currency: 'SAR',
    description: `Consultation with instructor ${instructorId}`,
    metadata: {
      kind: 'consultation',
      holdId: String(hold._id),
      instructorId: String(instructorId),
      offeringId: String(offeringId),
      ...(userId ? { userId: String(userId) } : {}),
    },
    successUrl: env.MOYASAR_SUCCESS_URL,
    failUrl: env.MOYASAR_FAIL_URL,
  });

  hold.payment = {
    ...(hold.payment || { provider: 'moyasar', currency: 'SAR' }),
    paymentId: pay.paymentId,
    amountHalalas: grand,
  };
  await hold.save();

  const result = {
    hold: {
      id: String(hold._id),
      status: hold.status,
      expiresAt: hold.expiresAt,
    },
    payment: {
      provider: 'moyasar',
      paymentUrl: pay.paymentUrl,
      paymentId: pay.paymentId,
      currency: 'SAR',
      amount: fromHalalas(grand),
      amountHalalas: grand,
    },
    bookingPreview: {
      instructorId,
      offeringId,
      date,
      startHHMM,
      startUtc: start,
      endUtc: end,
      durationMinutes: off.durationMinutes,
    },
    totals: {
      price: fromHalalas(off.priceHalalas),
      vat: fromHalalas(vat),
      grandTotal: fromHalalas(grand),

      priceHalalas: off.priceHalalas,
      vatHalalas: vat,
      grandTotalHalalas: grand,
    },
  };

  if (idempotencyKey) await saveOnce(idempotencyKey, result, 24 * 60 * 60 * 1000);

  return result;
}

/* ============= Webhook: من Moyasar → تأكيد الحجز ============= */
export async function handleConsultationWebhook(payload: MoyasarWebhookPayload) {
  const { id: paymentId, status, amount, currency, metadata } = payload as any;

  // ابحث عن الـ hold المرتبط بالدفع
  let hold = await ConsultationHold.findOne({ 'payment.paymentId': paymentId });
  if (!hold && metadata?.holdId) hold = await ConsultationHold.findById(metadata.holdId);
  if (!hold) throw AppError.notFound('Hold not found for this payment');

  // ✅ Idempotency قوي: لو الـ booking اتعمل قبل كده بنفس paymentId
  const existingBooking = await ConsultationBooking.findOne({
    'payment.paymentId': paymentId,
  }).lean();

  if (existingBooking) {
    // لو حصل crash قبل ما نحدّث hold → نحدّثه دلوقتي
    if (hold.status !== 'paid') {
      hold.status = 'paid';
      await hold.save();
    }
    return { ok: true };
  }

  // لو الـ hold أصلاً متعلَّم إنه paid نعتبرها idempotent
  if (hold.status === 'paid') return { ok: true };

  if (status === 'paid') {
    // تأكد أن الـ hold لم ينتهِ
    if (hold.expiresAt <= new Date()) {
      hold.status = 'expired';
      await hold.save();
      return { ok: false, reason: 'Hold expired' };
    }

    // منع تضارب نادر: نفس الـ slot محجوز قبل ما نكمل
    const clash = await ConsultationBooking.findOne({
      instructor: hold.instructor,
      start: { $lt: hold.end },
      end: { $gt: hold.start },
      status: { $in: ['confirmed', 'completed', 'refunded'] }, // لو قررت refund يمنع
    }).lean();

    if (clash) {
      hold.status = 'failed';
      await hold.save();
      return { ok: false, reason: 'Slot already booked' };
    }

    const off = await ConsultationOffering.findById(hold.offering).lean();
    if (!off) throw AppError.notFound('Offering not found');

    const expectedVat = Math.round(((env.VAT_PERCENT ?? 0) / 100) * off.priceHalalas);
    const expectedGrand = off.priceHalalas + expectedVat;

    // ✅ طابق المبلغ والعملة
    if (amount !== expectedGrand || (currency && currency !== 'SAR')) {
      hold.status = 'failed';
      await hold.save();
      return { ok: false, reason: 'Amount/currency mismatch' };
    }

    const inst = await InstructorProfile.findOne({ user: hold.instructor }).lean();

    // 📝 إنشاء الحجز الفعلي
    const booking = await ConsultationBooking.create({
      user: hold.user,
      instructor: hold.instructor,
      offering: {
        type: off.type,
        title: off.title,
        durationMinutes: off.durationMinutes,
        priceHalalas: off.priceHalalas,
      },
      start: hold.start,
      end: hold.end,
      applicant: {
        fullName: hold.applicant.fullName,
        email: hold.applicant.email,
        whatsapp: hold.applicant.whatsapp,
        issueDescription: hold.applicant.issueDescription,
      },
      meetingUrl: inst?.meetingUrl,
      status: 'confirmed',
      totals: {
        priceHalalas: off.priceHalalas,
        vatHalalas: expectedVat,
        grandTotalHalalas: expectedGrand,
      },
      payment: {
        provider: 'moyasar',
        paymentId,
        currency: 'SAR',
        paidAt: new Date(),
        raw: payload,
      },
    });

    // تحديث حالة الـ hold
    hold.status = 'paid';
    await hold.save();

    // 🧾 إنشاء Order خاص بالاستشارة (لو عندنا user مربوط بـ hold)
    await createOrderForConsultationPaid({
      userId: hold.user ? String(hold.user) : undefined,
      bookingId: String(booking._id),
      offeringTitle: off.title,
      priceHalalas: off.priceHalalas,
      vatHalalas: expectedVat,
      grandTotalHalalas: expectedGrand,
      paymentId,
      payload,
    });

    return { ok: true };
  }

  if (status === 'failed') {
    hold.status = 'failed';
    await hold.save();
    return { ok: true };
  }

  return { ok: false };
}

/* ============= حجوزاتي/حجز واحد ============= */
export async function listMyConsultationsService(userId: string, page = 1, limit = 10) {
  const p = Math.max(1, page | 0);
  const l = Math.min(100, Math.max(1, limit | 0));
  const skip = (p - 1) * l;

  const [items, total] = await Promise.all([
    ConsultationBooking.find({ user: userId }).sort({ start: -1 }).skip(skip).limit(l).lean(),
    ConsultationBooking.countDocuments({ user: userId }),
  ]);

  const pages = Math.max(1, Math.ceil(total / l));
  return {
    items: items.map(bookingToPublicDTO),
    meta: { total, page: p, limit: l, pages, hasNextPage: p < pages, hasPrevPage: p > 1 },
  };
}

export async function getMyConsultationService(userId: string, id: string) {
  const b: any = await ConsultationBooking.findById(id).lean();
  if (!b || String(b.user) !== String(userId)) throw AppError.notFound('Not found');

  return bookingToPublicDTO(b);
}

/* ============= إعادة الجدولة ============= */
export async function rescheduleConsultationService(
  userId: string,
  id: string,
  newStartIso: string,
) {
  const b = await ConsultationBooking.findById(id);
  if (!b || String(b.user) !== String(userId)) throw AppError.notFound('Not found');
  if (b.status !== 'confirmed')
    throw AppError.badRequest('Only confirmed bookings can be rescheduled');

  const inst = await InstructorProfile.findOne({ user: b.instructor }).lean();
  const windowH = inst?.rescheduleWindowHours ?? 12;

  // يجب تقديم الطلب قبل X ساعات من الموعد القديم
  const now = new Date();
  if (b.start.getTime() - now.getTime() < windowH * 3600 * 1000) {
    throw AppError.badRequest('Reschedule window has passed');
  }

  // لازم التاريخ يبقى محدد timezone (Z أو offset)
  if (!newStartIso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(newStartIso)) {
    throw AppError.badRequest('newStartAt must include timezone (Z or +hh:mm)');
  }

  const newStart = parseISO(newStartIso);
  const newEnd = addMinutes(newStart, b.offering.durationMinutes);

  // تحقق التوفر للموعد الجديد
  const dateStr = toRiyadhYMD(newStart);
  const freeSlots = await computeAvailabilityForDayWithDuration(
    String(b.instructor),
    dateStr,
    b.offering.durationMinutes,
  );
  const exists = freeSlots.some((s) => s.start.getTime() === newStart.getTime());
  if (!exists) throw AppError.badRequest('New slot is not available');

  // عدّل
  b.start = newStart;
  b.end = newEnd;
  await b.save();

  const fresh = ConsultationBooking.findById(b._id).lean();
  return bookingToPublicDTO(fresh);
}

/* ============= الإلغاء ============= */
export async function cancelConsultationService(userId: string, id: string) {
  const b = await ConsultationBooking.findById(id);
  if (!b || String(b.user) !== String(userId)) throw AppError.notFound('Not found');

  if (b.status !== 'confirmed')
    throw AppError.badRequest('Only confirmed bookings can be cancelled');

  const windowH = DEFAULT_CANCEL_WINDOW_HOURS;
  const now = new Date();
  const withinWindow = b.start.getTime() - now.getTime() >= windowH * 3600 * 1000;

  b.status = 'cancelled';
  await b.save();

  // (لاحقاً) لو withinWindow=true نطلق Refund عبر مزوّد الدفع
  return { cancelled: true, eligibleForRefund: withinWindow };
}

/* ============= سلوتس على مدى زمني (واجهة خارجية) ============= */
export async function rangeSlotsPublicService(
  instructorId: string,
  from: string,
  to: string,
  offeringId: string,
) {
  return rangeSlotsService({ instructorId, from, to, offeringId });
}
