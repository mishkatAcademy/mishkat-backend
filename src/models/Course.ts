import mongoose, { Schema, Document, Types } from 'mongoose';
import slugify from 'slugify';

export interface ICourse extends Document {
  title: string;
  slug: string;
  description: string;
  price: number;
  isFree: boolean;
  image?: string;
  category: Types.ObjectId[];
  instructor: Types.ObjectId;
  status: 'draft' | 'published';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  avgRating: number;
  tags?: string[];
  duration?: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema: Schema = new Schema<ICourse>(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true },
    price: { type: Number, default: 0 },
    isFree: { type: Boolean, default: false },
    image: { type: String },

    category: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
      },
    ],
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    avgRating: { type: Number, default: 5 },
    tags: [{ type: String }],
    duration: { type: Number }, // بوحدة الدقائق
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

// توليد slug تلقائي قبل الحفظ
// CourseSchema.pre("save", function (next) {
//   if (this.isModified("title")) {
//     this.slug = slugify(this.title, { lower: true, strict: true });
//   }
//   next();
// });

export default mongoose.model<ICourse>('Course', CourseSchema);
