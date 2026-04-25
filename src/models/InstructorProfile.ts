// src/models/InstructorProfile.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import User from './User';

export type LocalizedText = { ar?: string; en?: string };

export interface DailyTimeRange {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface WeeklySlot {
  day: number; // 0..6 (0=السبت) ← ثابت عبر النظام
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface AvailabilityException {
  // خلي بالك جربت ال midnight ومكانش بيظبط في التحويلات
  date: Date; // تاريخ اليوم (12 ظهرا UTC أو normalized)
  closed?: boolean; // true = اليوم مقفول بالكامل
  slots?: DailyTimeRange[]; // فترات محددة لهذا اليوم
}

export type SupportedConsultationType = 'academic' | 'social' | 'coaching';

export interface IInstructorProfile extends Document {
  user: Types.ObjectId;
  displayName?: LocalizedText;
  headline?: LocalizedText;
  bio?: LocalizedText;
  academicDegree?: LocalizedText;
  experiences?: {
    title?: LocalizedText;
    organization?: LocalizedText;
    startDate?: Date;
    endDate?: Date;
    description?: LocalizedText;
    location?: LocalizedText;
    untilYear?: number;
  }[];
  certifications?: { title?: LocalizedText; issuer?: LocalizedText; year?: number }[];
  supportedTypes: SupportedConsultationType[];
  timezone: string;
  bufferMinutes: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  rescheduleWindowHours: number;
  weekly: WeeklySlot[];
  exceptions?: AvailabilityException[];
  meetingMethod?: 'manual';
  meetingUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/* ========= Sub-schemas ========= */

const LocalizedTextSchema = new Schema<LocalizedText>(
  { ar: { type: String, trim: true }, en: { type: String, trim: true } },
  { _id: false },
);

const DailyTimeRangeSchema = new Schema<DailyTimeRange>(
  {
    start: { type: String, required: true, trim: true }, // HH:mm
    end: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const WeeklySlotSchema = new Schema<WeeklySlot>({
  day: { type: Number, required: true, min: 0, max: 6 },
  start: { type: String, required: true, trim: true },
  end: { type: String, required: true, trim: true },
});

const AvailabilityExceptionSchema = new Schema<AvailabilityException>({
  date: { type: Date, required: true },
  closed: { type: Boolean, default: false },
  slots: { type: [DailyTimeRangeSchema], default: undefined },
});

/* ========= Helpers ========= */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
function hasOverlaps(ranges: DailyTimeRange[]): boolean {
  if (!ranges?.length) return false;
  const sorted = [...ranges]
    .map((r) => ({ s: toMin(r.start), e: toMin(r.end) }))
    .sort((a, b) => a.s - b.s);
  for (let i = 0; i < sorted.length; i++) {
    const { s, e } = sorted[i];
    if (!(Number.isFinite(s) && Number.isFinite(e))) return true;
    if (s >= e) return true;
    if (i > 0 && s < sorted[i - 1].e) return true; // overlap
  }
  return false;
}

/* ========= Main Schema ========= */

const InstructorProfileSchema = new Schema<IInstructorProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    displayName: { type: LocalizedTextSchema },
    headline: { type: LocalizedTextSchema },

    bio: { type: LocalizedTextSchema },
    academicDegree: { type: LocalizedTextSchema },
    experiences: [
      new Schema(
        {
          title: { type: LocalizedTextSchema },
          organization: { type: LocalizedTextSchema },
          startDate: Date,
          endDate: Date,
          description: { type: LocalizedTextSchema },
          location: { type: LocalizedTextSchema },
          untilYear: { type: Number, min: 1900, max: 2100 },
        },
        { _id: false },
      ),
    ],
    certifications: [
      new Schema(
        {
          title: { type: LocalizedTextSchema },
          issuer: { type: LocalizedTextSchema },
          year: { type: Number, min: 1900, max: 2100 },
        },
        { _id: false },
      ),
    ],

    supportedTypes: {
      type: [String],
      enum: ['academic', 'social', 'coaching'],
      required: true,
      default: ['academic'],
      index: true,
    },

    timezone: { type: String, default: 'Asia/Riyadh' },

    bufferMinutes: { type: Number, default: 10, min: 0, max: 180 },
    minNoticeHours: { type: Number, default: 24, min: 0, max: 240 },
    maxAdvanceDays: { type: Number, default: 30, min: 1, max: 365 },
    rescheduleWindowHours: { type: Number, default: 12, min: 0, max: 240 },

    weekly: { type: [WeeklySlotSchema], default: [] },
    exceptions: { type: [AvailabilityExceptionSchema], default: undefined },

    meetingMethod: { type: String, enum: ['manual'], default: 'manual' },
    meetingUrl: { type: String, trim: true },

    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret) {
        ret.id = String(ret.user);
        delete ret._id;
      },
    },
    toObject: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret) {
        ret.id = String(ret.user);
        delete ret._id;
      },
    },
  },
);

/* ========= Validators ========= */

InstructorProfileSchema.path('timezone').validate(function (tz: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Invalid IANA time zone');

InstructorProfileSchema.path('weekly').validate(function (slots: WeeklySlot[]) {
  for (const s of slots || []) {
    if (!HHMM.test(s.start) || !HHMM.test(s.end)) return false;
    if (s.day < 0 || s.day > 6) return false;
  }
  const byDay: Record<number, DailyTimeRange[]> = {};
  for (const s of slots || []) {
    (byDay[s.day] ??= []).push({ start: s.start, end: s.end });
  }
  return Object.values(byDay).every((ranges) => !hasOverlaps(ranges));
}, 'Invalid weekly slot(s): check day/start/end and overlaps');

InstructorProfileSchema.path('exceptions').validate(function (
  exps: AvailabilityException[] | undefined,
) {
  if (!exps) return true;
  for (const e of exps) {
    if (!e.date) return false;
    if (e.slots) {
      for (const r of e.slots) {
        if (!HHMM.test(r.start) || !HHMM.test(r.end)) return false;
      }
      if (hasOverlaps(e.slots)) return false;
    }
  }
  return true;
}, 'Invalid exception slots or overlaps');

/* ========= Guards ========= */
InstructorProfileSchema.pre('validate', async function (next) {
  try {
    if (this.isNew || this.isModified('user')) {
      const exists = await User.exists({ _id: this.user, role: 'instructor', isDeleted: false });
      if (!exists) return next(new Error('User must exist with role="instructor"'));
    }
    if (this.isActive && this.meetingMethod === 'manual' && !this.meetingUrl) {
      // اختياري: اعتبرها تحذير/تخطّي. لو عايزها إجبارية:
      // return next(new Error('meetingUrl is required when meetingMethod="manual" and profile is active'));
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

InstructorProfileSchema.virtual('image').get(function (this: IInstructorProfile) {
  if (this.user && (this.user as any).avatarUrl) {
    return (this.user as any).avatarUrl;
  }
  return null;
});

/* ========= Useful Indexes ========= */
InstructorProfileSchema.index({ isActive: 1, supportedTypes: 1 });

export default mongoose.model<IInstructorProfile>('InstructorProfile', InstructorProfileSchema);
