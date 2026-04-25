// src/models/ResearchRequest.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export type Specialization = 'خدمة اجتماعية' | 'علم اجتماع' | 'علم نفس' | 'تربية خاصة';

export type ResearchNature =
  | 'بحث أكاديمي مقرر'
  | 'بحث ماجستير'
  | 'بحث دكتوراه'
  | 'بحث ترقية'
  | 'بحث للنشر في مجلة علمية';

export type RequestedService =
  | 'توفير مصادر ودراسات'
  | 'اقتراح عناوين لموضوعات البحث'
  | 'عمل خطة البحث'
  | 'اقتراح محاور للإطار النظري وتقسيمات البحث'
  | 'عمل فصل محدد في البحث'
  | 'عمل البحث كاملا';

export type ResearchStatus =
  | 'new' // تم الاستلام
  | 'in_review' // تحت المراجعة/التقييم
  | 'in_progress' // جاري التنفيذ
  | 'completed' // تم التسليم/الإنهاء
  | 'cancelled'; // أُلغي

export interface Attachment {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number; // bytes
  relativePath: string;
  url: string;
}

export interface IResearchRequest extends Document {
  user: Types.ObjectId;

  specialization: Specialization;
  nature: ResearchNature;
  serviceType: RequestedService;

  name: string;
  whatsapp: string;
  email: string;

  researchTitle: string;
  description?: string;

  proposedDueDate: string;

  attachments: Attachment[];

  status: ResearchStatus;
  adminNotes?: string;

  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<Attachment>(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    relativePath: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: true },
);

const ResearchRequestSchema = new Schema<IResearchRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    specialization: {
      type: String,
      enum: ['خدمة اجتماعية', 'علم اجتماع', 'علم نفس', 'تربية خاصة'],
      required: true,
      index: true,
    },
    nature: {
      type: String,
      enum: [
        'بحث أكاديمي مقرر',
        'بحث ماجستير',
        'بحث دكتوراه',
        'بحث ترقية',
        'بحث للنشر في مجلة علمية',
      ],
      required: true,
      index: true,
    },
    serviceType: {
      type: String,
      enum: [
        'توفير مصادر ودراسات',
        'اقتراح عناوين لموضوعات البحث',
        'عمل خطة البحث',
        'اقتراح محاور للإطار النظري وتقسيمات البحث',
        'عمل فصل محدد في البحث',
        'عمل البحث كاملا',
      ],
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },
    whatsapp: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },

    researchTitle: { type: String, required: true, trim: true },
    description: { type: String },

    proposedDueDate: { type: String, required: true },

    attachments: { type: [AttachmentSchema], default: [] },

    status: {
      type: String,
      enum: ['new', 'in_review', 'in_progress', 'completed', 'cancelled'],
      default: 'new',
      index: true,
    },
    adminNotes: { type: String },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;

        if (Array.isArray(ret.attachments)) {
          ret.attachments = ret.attachments.map((a: any) => ({
            id: String(a._id),
            originalName: a.originalName,
            storedName: a.storedName,
            mimeType: a.mimeType,
            size: a.size,
            relativePath: a.relativePath,
            url: a.url,
          }));
        }
      },
    },
  },
);

ResearchRequestSchema.index({ createdAt: -1 });

export default mongoose.model<IResearchRequest>('ResearchRequest', ResearchRequestSchema);
