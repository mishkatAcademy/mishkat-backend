// مجرد بداية الشغل الأساسي في version II إن شاء الله
import mongoose, { Schema, Document } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  appliesTo: ('course' | 'book' | 'consultation' | 'research' | 'all')[];
  maxUsage: number;
  usedCount: number;
  isActive: boolean;
  expiresAt: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: { type: Number, required: true },
    appliesTo: {
      type: [String],
      enum: ['course', 'book', 'consultation', 'research', 'all'],
      default: ['all'],
    },
    maxUsage: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<ICoupon>('Coupon', CouponSchema);
