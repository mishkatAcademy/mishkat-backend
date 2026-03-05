// src/services/instructorService.ts
import User from '../models/User';
import InstructorProfile from '../models/InstructorProfile';
import AppError from '../utils/AppError';
import { pick } from '../utils/pick';
import { toRiyadhYMD } from '../utils/time';
import { dateInRiyadhToUTC } from '../utils/timeSlots';

import { addDays } from 'date-fns';

type SupportedType = 'academic' | 'social' | 'coaching';
type Localized = { ar?: string; en?: string };

type CreateInput = {
  userId: string;
  displayName?: Localized;
  headline?: Localized;
  bio?: Localized;
  academicDegree?: Localized;
  experiences?: {
    title?: Localized;
    organization?: Localized;
    startDate?: Date;
    endDate?: Date;
    description?: Localized;
    location?: Localized;
    untilYear?: number;
  }[];
  certifications?: { title?: Localized; issuer?: Localized; year?: number }[];
  supportedTypes?: SupportedType[];
  timezone?: string;
  bufferMinutes?: number;
  minNoticeHours?: number;
  maxAdvanceDays?: number;
  rescheduleWindowHours?: number;
  weekly?: { day: number; start: string; end: string }[];
  exceptions?: { date: Date; closed?: boolean; slots?: { start: string; end: string }[] }[];
  meetingMethod?: 'manual';
  meetingUrl?: string;
  isActive?: boolean;
};

type UpdateInput = Partial<Omit<CreateInput, 'userId'>>;

// helpers للدمج/التحقق
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

function normalizeRanges(ranges: { start: string; end: string }[]) {
  const cleaned = (ranges || [])
    .map((r) => ({ start: String(r.start).trim(), end: String(r.end).trim() }))
    .filter((r) => r.start < r.end);

  cleaned.sort((a, b) => toMin(a.start) - toMin(b.start));

  // dedupe exact
  const out: { start: string; end: string }[] = [];
  for (const r of cleaned) {
    const last = out[out.length - 1];
    if (last && last.start === r.start && last.end === r.end) continue;
    out.push(r);
  }
  return out;
}

function ensureNoOverlaps(ranges: { start: string; end: string }[]) {
  const sorted = [...ranges].sort((a, b) => toMin(a.start) - toMin(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (toMin(sorted[i].start) < toMin(sorted[i - 1].end)) {
      throw AppError.badRequest('Time ranges overlap');
    }
  }
}

function allowedUpdateKeysAdmin(): (keyof UpdateInput)[] {
  return [
    'displayName',
    'headline',
    'bio',
    'academicDegree',
    'experiences',
    'certifications',
    'supportedTypes',
    'timezone',
    'bufferMinutes',
    'minNoticeHours',
    'maxAdvanceDays',
    'rescheduleWindowHours',
    'weekly',
    'exceptions',
    'meetingMethod',
    'meetingUrl',
    'isActive',
  ];
}

function allowedUpdateKeysSelf(): (keyof UpdateInput)[] {
  // المدرّس لا يغيّر isActive بنفسه
  return allowedUpdateKeysAdmin().filter((k) => k !== 'isActive');
}

function parseSort(sortStr?: string): Record<string, 1 | -1> {
  const out: Record<string, 1 | -1> = {};
  const s = (sortStr || '').trim();
  if (!s) return { createdAt: -1 };
  for (const part of s.split(',')) {
    const [field, dir] = part.split(':').map((x) => x.trim());
    if (!field) continue;
    out[field] = dir?.toLowerCase() === 'asc' ? 1 : -1;
  }
  return out;
}

/** Helper: شكل العرض النهائي للـ Instructor (avatarUrl من User) */
function bestLocalizedText(v?: Localized, fallback?: string) {
  const ar = v?.ar?.trim();
  const en = v?.en?.trim();
  return ar || en || fallback?.trim() || undefined;
}

function toInstructorDTO(p: any, opts?: { includeUser?: boolean }) {
  const includeUser = !!opts?.includeUser;

  const user = p.user && typeof p.user === 'object' ? p.user : undefined;
  const fullNameFromUser = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  const displayNameObj = p.displayName as Localized | undefined;

  const base: any = {
    id: String(p._id),
    userId: String(user?._id ?? p.user),

    // ✅ بنرجّع object كما هو (LocalizedText)
    displayName: displayNameObj,
    headline: p.headline,
    bio: p.bio,
    academicDegree: p.academicDegree,
    experiences: p.experiences,
    certifications: p.certifications,

    displayNameText: bestLocalizedText(displayNameObj, fullNameFromUser),

    avatarUrl: user?.avatarUrl,
    supportedTypes: p.supportedTypes,
    timezone: p.timezone,
    bufferMinutes: p.bufferMinutes,
    minNoticeHours: p.minNoticeHours,
    maxAdvanceDays: p.maxAdvanceDays,
    rescheduleWindowHours: p.rescheduleWindowHours,
    weekly: p.weekly,
    exceptions: p.exceptions,
    meetingMethod: p.meetingMethod,
    meetingUrl: p.meetingUrl,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };

  if (includeUser) {
    base.user = user
      ? {
          id: String(user._id),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          isDeleted: user.isDeleted,
        }
      : undefined;
  }

  return base;
}

function normalizeExceptions(ex?: any[]) {
  if (!ex?.length) return ex;
  return ex.map((e) => {
    const ymd = toRiyadhYMD(e.date);
    return {
      ...e,
      date: dateInRiyadhToUTC(ymd, '00:00'),
    };
  });
}

/** Admin: create profile for instructor user */
export async function adminCreateInstructorProfile(input: CreateInput) {
  const user = await User.findById(input.userId).select('role isDeleted').lean();
  if (!user || user.isDeleted) throw AppError.notFound('User not found');
  if (user.role !== 'instructor') throw AppError.badRequest('User is not an instructor');

  const existing = await InstructorProfile.findOne({ user: input.userId }).lean();
  if (existing) throw AppError.conflict('Profile already exists for this user');

  const doc = await InstructorProfile.create({
    user: input.userId,
    displayName: input.displayName,
    bio: input.bio,
    academicDegree: input.academicDegree,
    experiences: input.experiences,
    supportedTypes: input.supportedTypes ?? ['academic'],
    timezone: input.timezone ?? 'Asia/Riyadh',
    bufferMinutes: input.bufferMinutes ?? 10,
    minNoticeHours: input.minNoticeHours ?? 24,
    maxAdvanceDays: input.maxAdvanceDays ?? 30,
    rescheduleWindowHours: input.rescheduleWindowHours ?? 12,
    weekly: input.weekly ?? [],
    // exceptions: input.exceptions,
    exceptions: normalizeExceptions(input.exceptions),
    meetingMethod: input.meetingMethod ?? 'manual',
    meetingUrl: input.meetingUrl,
    isActive: input.isActive ?? true,
  });

  // رجّع DTO مع user/avatarUrl
  const populated = await doc.populate({
    path: 'user',
    select: 'firstName lastName email role avatarUrl isDeleted',
  });
  return toInstructorDTO(populated.toObject(), { includeUser: true });
}

/** Admin: update any instructor profile */
export async function adminUpdateInstructorProfile(userId: string, updates: UpdateInput) {
  const prof = await InstructorProfile.findOne({ user: userId });
  if (!prof) throw AppError.notFound('Instructor profile not found');

  const safe = pick(updates, allowedUpdateKeysAdmin());

  if ('exceptions' in safe) {
    safe.exceptions = normalizeExceptions(safe.exceptions as any);
  }

  Object.assign(prof, safe);
  await prof.save();

  const populated = await prof.populate({
    path: 'user',
    select: 'firstName lastName email role avatarUrl isDeleted',
  });
  return toInstructorDTO(populated.toObject(), { includeUser: true });
}

/** Self: update my own profile */
export async function instructorUpdateMyProfile(userId: string, updates: UpdateInput) {
  const prof = await InstructorProfile.findOne({ user: userId });
  if (!prof) throw AppError.notFound('Instructor profile not found');

  const safe = pick(updates, allowedUpdateKeysSelf());

  if ('exceptions' in safe) {
    safe.exceptions = normalizeExceptions(safe.exceptions as any);
  }

  Object.assign(prof, safe);
  await prof.save();

  const populated = await prof.populate({
    path: 'user',
    select: 'firstName lastName email role avatarUrl isDeleted',
  });
  return toInstructorDTO(populated.toObject(), { includeUser: true });
}

/** Self: get my profile */
export async function getMyInstructorProfile(userId: string) {
  const prof = await InstructorProfile.findOne({ user: userId })
    .populate({ path: 'user', select: 'firstName lastName email role avatarUrl isDeleted' })
    .lean();
  if (!prof) throw AppError.notFound('Instructor profile not found');
  return toInstructorDTO(prof, { includeUser: true });
}

/** Admin: get profile by :userId */
export async function getInstructorProfileByUserId(userId: string) {
  const prof = await InstructorProfile.findOne({ user: userId })
    .populate({ path: 'user', select: 'firstName lastName email role avatarUrl isDeleted' })
    .lean();
  if (!prof) throw AppError.notFound('Instructor profile not found');
  return toInstructorDTO(prof, { includeUser: true });
}

/** Admin: list profiles with filters/pagination */
export async function listInstructorsAdmin(input: {
  page?: number;
  limit?: number;
  type?: SupportedType;
  activeOnly?: boolean;
  search?: string;
  sort?: string; // "createdAt:desc,displayName:asc"
}) {
  const page = Math.max(1, input.page || 1);
  const limit = Math.min(100, Math.max(1, input.limit || 10));
  const skip = (page - 1) * limit;

  const q: any = {};
  if (input.activeOnly !== false) q.isActive = true;
  if (input.type) q.supportedTypes = input.type;

  if (input.search && input.search.trim()) {
    const safe = input.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const r = new RegExp(safe, 'i');
    q.$or = [
      { 'displayName.ar': r },
      { 'displayName.en': r },
      { 'headline.ar': r },
      { 'headline.en': r },
      { 'bio.ar': r },
      { 'bio.en': r },
      { 'academicDegree.ar': r },
      { 'academicDegree.en': r },
      { 'experiences.title.ar': r },
      { 'experiences.title.en': r },
      { 'experiences.organization.ar': r },
      { 'experiences.organization.en': r },
    ] as any;
  }

  const sort = parseSort(input.sort);

  const [items, total] = await Promise.all([
    InstructorProfile.find(q)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'user', select: 'firstName lastName email role avatarUrl isDeleted' })
      .lean(),
    InstructorProfile.countDocuments(q),
  ]);

  const data = items.map((p: any) => toInstructorDTO(p, { includeUser: true }));

  const pages = Math.max(1, Math.ceil(total / limit));
  return {
    items: data,
    meta: {
      total,
      page,
      limit,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    },
  };
}

/** Admin: activate/deactivate */
export async function adminSetInstructorActive(userId: string, active: boolean) {
  const prof = await InstructorProfile.findOne({ user: userId });
  if (!prof) throw AppError.notFound('Instructor profile not found');
  prof.isActive = !!active;
  await prof.save();

  const populated = await prof.populate({
    path: 'user',
    select: 'firstName lastName email role avatarUrl isDeleted',
  });
  return toInstructorDTO(populated.toObject(), { includeUser: true });
}

function normalizeExceptionDateFromYMD(dateYMD: string) {
  return dateInRiyadhToUTC(dateYMD, '00:00'); // UTC midnight that represents Riyadh day start
}

function sameExceptionDay(expDate: Date, dateYMD: string) {
  return toRiyadhYMD(expDate) === dateYMD;
}

/** Self: replace weekly بالكامل (أمان أعلى من PATCH العام) */
export async function instructorReplaceMyWeekly(
  userId: string,
  weekly: { day: number; start: string; end: string }[],
) {
  const prof = await InstructorProfile.findOne({ user: userId });
  if (!prof) throw AppError.notFound('Instructor profile not found');

  prof.weekly = weekly as any;
  await prof.save();

  const populated = await prof.populate({
    path: 'user',
    select: 'firstName lastName email role avatarUrl isDeleted',
  });

  return toInstructorDTO(populated.toObject(), { includeUser: true });
}

/** Self: upsert exception ليوم واحد */
export async function instructorUpsertMyException(
  userId: string,
  dateYMD: string,
  input: { closed?: boolean; slots?: { start: string; end: string }[] },
) {
  const prof = await InstructorProfile.findOne({ user: userId });
  if (!prof) throw AppError.notFound('Instructor profile not found');

  const normalizedDate = normalizeExceptionDateFromYMD(dateYMD);

  const exps = (prof.exceptions ?? []) as any[];

  const idx = exps.findIndex((e) => sameExceptionDay(e.date, dateYMD));

  const next = {
    date: normalizedDate,
    closed: !!input.closed,
    slots: input.closed ? undefined : input.slots, // لو closed=true نمسح slots
  };

  if (idx >= 0) exps[idx] = next;
  else exps.push(next);

  prof.exceptions = exps as any;
  await prof.save();

  const populated = await prof.populate({
    path: 'user',
    select: 'firstName lastName email role avatarUrl isDeleted',
  });

  return toInstructorDTO(populated.toObject(), { includeUser: true });
}

/** Self: delete exception ليوم واحد */
export async function instructorDeleteMyException(userId: string, dateYMD: string) {
  const prof = await InstructorProfile.findOne({ user: userId });
  if (!prof) throw AppError.notFound('Instructor profile not found');

  const exps = (prof.exceptions ?? []) as any[];
  prof.exceptions = exps.filter((e) => !sameExceptionDay(e.date, dateYMD)) as any;

  await prof.save();

  const populated = await prof.populate({
    path: 'user',
    select: 'firstName lastName email role avatarUrl isDeleted',
  });

  return toInstructorDTO(populated.toObject(), { includeUser: true });
}
/* new */
async function loadMyProfileDoc(userId: string) {
  const prof = await InstructorProfile.findOne({ user: userId });
  if (!prof) throw AppError.notFound('Instructor profile not found');
  return prof;
}

async function toDTOWithUser(prof: any) {
  const populated = await prof.populate({
    path: 'user',
    select: 'firstName lastName email role avatarUrl isDeleted',
  });
  return toInstructorDTO(populated.toObject(), { includeUser: true });
}

/* =========================================================
(1) Add weekly item
POST /instructors/me/weekly/items
========================================================= */
export async function instructorAddWeeklyItem(
  userId: string,
  item: { day: number; start: string; end: string },
) {
  const prof = await loadMyProfileDoc(userId);

  prof.weekly = [...(prof.weekly || []), item as any] as any;
  prof.markModified('weekly');
  await prof.save(); // model validation يمنع overlaps

  return toDTOWithUser(prof);
}

/* =========================================================
(2) Delete weekly item
DELETE /instructors/me/weekly/items/:itemId
========================================================= */
export async function instructorDeleteWeeklyItem(userId: string, itemId: string) {
  const prof = await loadMyProfileDoc(userId);

  const before = (prof.weekly || []) as any[];
  const after = before.filter((w) => String(w._id) !== String(itemId));
  if (after.length === before.length) throw AppError.notFound('Weekly item not found');

  prof.weekly = after as any;
  prof.markModified('weekly');
  await prof.save();

  return toDTOWithUser(prof);
}

/* =========================================================
(3) Update weekly item
PATCH /instructors/me/weekly/items/:itemId
========================================================= */
export async function instructorUpdateWeeklyItem(
  userId: string,
  itemId: string,
  patch: { day?: number; start?: string; end?: string },
) {
  const prof = await loadMyProfileDoc(userId);

  const weekly = (prof.weekly || []) as any[];
  const idx = weekly.findIndex((w) => String(w._id) === String(itemId));
  if (idx === -1) throw AppError.notFound('Weekly item not found');

  const cur = weekly[idx];

  const next = {
    ...(cur.toObject?.() ?? cur),
    ...(typeof patch.day === 'number' ? { day: patch.day } : {}),
    ...(typeof patch.start === 'string' ? { start: patch.start.trim() } : {}),
    ...(typeof patch.end === 'string' ? { end: patch.end.trim() } : {}),
  };

  if (next.start >= next.end) throw AppError.badRequest('start must be before end');

  weekly[idx] = next;
  prof.weekly = weekly as any;
  prof.markModified('weekly');
  await prof.save(); // model validation يمنع overlaps

  return toDTOWithUser(prof);
}

/* =========================================================
(4) Make a day off (closed=true)
POST /instructors/me/exceptions/:dateYMD/off
========================================================= */
export async function instructorSetDayOff(userId: string, dateYMD: string) {
  const prof = await loadMyProfileDoc(userId);

  const normalizedDate = dateInRiyadhToUTC(dateYMD, '00:00');
  const exps = (prof.exceptions ?? []) as any[];

  const idx = exps.findIndex((e) => toRiyadhYMD(e.date) === dateYMD);

  const next = { date: normalizedDate, closed: true, slots: undefined };

  if (idx >= 0) exps[idx] = next;
  else exps.push(next);

  prof.exceptions = exps as any;
  prof.markModified('exceptions');
  await prof.save();

  return toDTOWithUser(prof);
}

/* =========================================================
(5) Add exception in day (slots or closed)
PUT /instructors/me/exceptions/:dateYMD
(موجود عندك بالفعل instructorUpsertMyException)
=> هنسيبه، لكن ده endpoint إضافي مختلف؟ لا — هنستخدم نفس الموجود
========================================================= */

/* =========================================================
(6) Add off days for range
// بيضيف مجموعة أيام متتالية أجازة من .... إلى
POST /instructors/me/exceptions/off-range
========================================================= */
export async function instructorSetOffRange(userId: string, from: string, to: string) {
  const prof = await loadMyProfileDoc(userId);

  const exps = (prof.exceptions ?? []) as any[];

  const startUTC = dateInRiyadhToUTC(from, '00:00');
  const endUTC = dateInRiyadhToUTC(to, '00:00');

  for (let d = new Date(startUTC); d <= endUTC; d = addDays(d, 1)) {
    const ymd = toRiyadhYMD(d);
    const normalizedDate = dateInRiyadhToUTC(ymd, '00:00');

    const idx = exps.findIndex((e) => toRiyadhYMD(e.date) === ymd);
    const next = { date: normalizedDate, closed: true, slots: undefined };

    if (idx >= 0) exps[idx] = next;
    else exps.push(next);
  }

  prof.exceptions = exps as any;
  prof.markModified('exceptions');
  await prof.save();

  return toDTOWithUser(prof);
}

/* =========================================================
(7) Add available time range(s) to a day (merge)
POST /instructors/me/exceptions/:dateYMD/slots
========================================================= */
export async function instructorAddSlotsToDay(
  userId: string,
  dateYMD: string,
  slotsInput: { start: string; end: string }[],
) {
  const prof = await loadMyProfileDoc(userId);

  const exps = (prof.exceptions ?? []) as any[];
  const normalizedDate = dateInRiyadhToUTC(dateYMD, '00:00');

  const idx = exps.findIndex((e) => toRiyadhYMD(e.date) === dateYMD);

  const incoming = normalizeRanges(slotsInput || []);
  if (!incoming.length) throw AppError.badRequest('No valid slots provided');

  if (idx >= 0) {
    const current = exps[idx];
    const currentSlots = current?.slots?.length ? normalizeRanges(current.slots) : [];
    const merged = normalizeRanges([...currentSlots, ...incoming]);
    ensureNoOverlaps(merged);

    exps[idx] = { date: normalizedDate, closed: false, slots: merged };
  } else {
    ensureNoOverlaps(incoming);
    exps.push({ date: normalizedDate, closed: false, slots: incoming });
  }

  prof.exceptions = exps as any;
  prof.markModified('exceptions');
  await prof.save();

  return toDTOWithUser(prof);
}

/* سيرفيس مؤقتة لإضافة id لعناصر ال weekly القديمة */
export async function instructorRehydrateMyWeekly(userId: string) {
  const prof = await InstructorProfile.findOne({ user: userId });
  if (!prof) throw AppError.notFound('Instructor profile not found');

  const weekly: any[] = (prof.weekly || []) as any[];
  const hasMissingIds = weekly.some((w) => !w?._id);

  if (!hasMissingIds) {
    const populated = await prof.populate({
      path: 'user',
      select: 'firstName lastName email role avatarUrl isDeleted',
    });
    return toInstructorDTO(populated.toObject(), { includeUser: true });
  }

  // ✅ force re-assign to trigger subdoc id creation
  prof.weekly = weekly.map((w) => ({ day: w.day, start: w.start, end: w.end })) as any;
  prof.markModified('weekly');
  await prof.save();

  const populated = await prof.populate({
    path: 'user',
    select: 'firstName lastName email role avatarUrl isDeleted',
  });
  return toInstructorDTO(populated.toObject(), { includeUser: true });
}
