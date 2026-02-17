// src/models/ConsultationHold.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ApplicantSnapshot {
  fullName: string;
  email: string;
  whatsapp: string;
  issueDescription?: string;
  acceptedTerms?: boolean;
}

export interface IConsultationHold extends Document {
  user?: Types.ObjectId;
  instructor: Types.ObjectId;
  offering: Types.ObjectId;

  start: Date; // UTC
  end: Date; // UTC

  applicant: ApplicantSnapshot;

  status: 'holding' | 'paid' | 'failed' | 'expired';
  expiresAt: Date; // TTL

  payment?: {
    provider: 'moyasar';
    paymentId?: string;
    amountHalalas?: number;
    currency?: 'SAR';
    vatHalalas?: number;
  };

  idempotencyKey?: string;

  createdAt: Date;
  updatedAt: Date;
}

const ApplicantSchema = new Schema<ApplicantSnapshot>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    whatsapp: { type: String, required: true, trim: true },
    issueDescription: { type: String },
    acceptedTerms: { type: Boolean, default: false },
  },
  { _id: false },
);

const ConsultationHoldSchema = new Schema<IConsultationHold>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    offering: {
      type: Schema.Types.ObjectId,
      ref: 'ConsultationOffering',
      required: true,
      index: true,
    },

    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true, index: true },

    applicant: { type: ApplicantSchema, required: true },

    status: {
      type: String,
      enum: ['holding', 'paid', 'failed', 'expired'],
      default: 'holding',
      index: true,
    },

    expiresAt: { type: Date, required: true }, // TTL

    payment: {
      provider: { type: String, enum: ['moyasar'], default: 'moyasar' },
      paymentId: { type: String, index: true, sparse: true },
      amountHalalas: { type: Number, min: 0 },
      currency: { type: String, enum: ['SAR'], default: 'SAR' },
      vatHalalas: { type: Number, min: 0 },
    },

    idempotencyKey: { type: String, index: true, sparse: true },
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

// ✅ end > start
ConsultationHoldSchema.path('end').validate(function (this: IConsultationHold, v: Date) {
  return this.start && v && v.getTime() > this.start.getTime();
}, 'end must be greater than start');

// ⏳ TTL على expiresAt
ConsultationHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ⛔️ منع حجز نفس الـslot أثناء holding فقط
ConsultationHoldSchema.index(
  { instructor: 1, start: 1, end: 1 },
  { unique: true, partialFilterExpression: { status: 'holding' } },
);

// ConsultationHoldSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export default mongoose.model<IConsultationHold>('ConsultationHold', ConsultationHoldSchema);
