// src/models/ConsultationOffering.ts
import mongoose, { Schema, Document } from 'mongoose';

export type ConsultationType = 'academic' | 'social' | 'coaching';
export type LocalizedText = { ar?: string; en?: string };

export interface IConsultationOffering extends Document {
  type: ConsultationType;
  title: LocalizedText;
  description?: LocalizedText;
  durationMinutes: number;
  priceHalalas: number;
  isActive: boolean;
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

const LocalizedTextSchema = new Schema<LocalizedText>(
  { ar: { type: String, trim: true }, en: { type: String, trim: true } },
  { _id: false },
);

const ConsultationOfferingSchema = new Schema<IConsultationOffering>(
  {
    type: { type: String, enum: ['academic', 'social', 'coaching'], required: true, index: true },
    title: { type: LocalizedTextSchema, required: true },
    description: { type: LocalizedTextSchema },
    durationMinutes: { type: Number, required: true, min: 10, max: 240 },
    priceHalalas: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator(v: number) {
          return Number.isInteger(v);
        },
        message: 'priceHalalas must be an integer (halalas)',
      },
    },

    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
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

// فهارس مفيدة (قوائم بالأنواع + الترتيب + الحالة)
ConsultationOfferingSchema.index({ type: 1, isActive: 1, order: 1 });
ConsultationOfferingSchema.index({ type: 1, durationMinutes: 1, isActive: 1 });

// (اختياري) فهرس نصي مبسّط للبحث بالعنوان
// ConsultationOfferingSchema.index({ 'title.ar': 'text', 'title.en': 'text' }, { default_language: 'none' });

ConsultationOfferingSchema.virtual('priceSAR').get(function (this: any) {
  return typeof this.priceHalalas === 'number' ? this.priceHalalas / 100 : undefined;
});

export default mongoose.model<IConsultationOffering>(
  'ConsultationOffering',
  ConsultationOfferingSchema,
);
