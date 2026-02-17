// src/models/ConsultationBooking.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { ConsultationType, LocalizedText } from './ConsultationOffering';

export interface BookingApplicantSnapshot {
  fullName: string;
  email: string;
  whatsapp: string;
  issueDescription?: string;
}

export interface OfferingSnapshot {
  type: ConsultationType;
  title: LocalizedText;
  durationMinutes: number;
  priceHalalas: number;
}

export interface IConsultationBooking extends Document {
  user?: Types.ObjectId;
  instructor: Types.ObjectId;
  offering: OfferingSnapshot; // snapshot وقت الحجز
  start: Date; // UTC
  end: Date; // UTC
  applicant: BookingApplicantSnapshot;
  meetingUrl?: string;
  status: 'confirmed' | 'cancelled' | 'refunded' | 'completed';
  totals: {
    priceHalalas: number;
    vatHalalas: number;
    grandTotalHalalas: number;
  };
  payment: {
    provider: 'moyasar';
    paymentId: string;
    currency: 'SAR';
    paidAt?: Date;
    raw?: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const LocalizedTextSchema = new Schema<LocalizedText>(
  { ar: { type: String, trim: true }, en: { type: String, trim: true } },
  { _id: false },
);

const OfferingSnapshotSchema = new Schema<OfferingSnapshot>(
  {
    type: { type: String, enum: ['academic', 'social', 'coaching'], required: true },
    title: { type: LocalizedTextSchema, required: true },
    durationMinutes: { type: Number, required: true, min: 10, max: 240 },
    priceHalalas: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const ApplicantSchema = new Schema<BookingApplicantSnapshot>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    whatsapp: { type: String, required: true, trim: true },
    issueDescription: { type: String },
  },
  { _id: false },
);

const ConsultationBookingSchema = new Schema<IConsultationBooking>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    offering: { type: OfferingSnapshotSchema, required: true },

    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true, index: true },

    applicant: { type: ApplicantSchema, required: true },

    meetingUrl: { type: String },

    status: {
      type: String,
      enum: ['confirmed', 'cancelled', 'refunded', 'completed'],
      default: 'confirmed',
      index: true,
    },

    totals: {
      priceHalalas: { type: Number, required: true, min: 0 },
      vatHalalas: { type: Number, required: true, min: 0 },
      grandTotalHalalas: { type: Number, required: true, min: 0 },
    },

    payment: {
      provider: { type: String, enum: ['moyasar'], required: true },
      paymentId: { type: String, required: true, unique: true, index: true },
      currency: { type: String, enum: ['SAR'], default: 'SAR' },
      paidAt: Date,
      raw: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
      },
    },
    toObject: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
      },
    },
  },
);

// ✅ صلاحية الوقت: end > start
ConsultationBookingSchema.path('end').validate(function (this: IConsultationBooking, v: Date) {
  return this.start && v && v.getTime() > this.start.getTime();
}, 'end must be greater than start');

// 🔎 فهارس مفيدة
ConsultationBookingSchema.index({ instructor: 1, status: 1, start: 1 });

// ⛔️ منع double-booking لنفس start/end (يُستثنى cancelled)
ConsultationBookingSchema.index(
  { instructor: 1, start: 1, end: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['confirmed', 'completed'] } },
  },
);

export default mongoose.model<IConsultationBooking>(
  'ConsultationBooking',
  ConsultationBookingSchema,
);
