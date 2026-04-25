// src/models/CartItem.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export type CartItemType = 'Book' | 'Course' | 'ConsultationHold';

export interface LocalizedText {
  ar?: string;
  en?: string;
}

export interface CartSnapshot {
  title: LocalizedText;
  slug: string;
  image?: string;

  priceHalalas: number;
  salesPriceHalalas?: number;
  currency: 'SAR';

  // ✅ ConsultationHold only
  holdId?: string;
  offeringId?: string;
  instructorId?: string;
  start?: Date;
  end?: Date;
  durationMinutes?: number;
  consultationType?: 'academic' | 'social' | 'coaching';
  expiresAt?: Date;
}

export interface ICartItem extends Document {
  user: Types.ObjectId;
  itemType: CartItemType;
  itemRef: Types.ObjectId; // refPath -> Book/Course/Consultation/Research
  quantity: number; // 1 دائمًا لغير الكتاب الورقي
  addedAt: Date;
  snapshot: CartSnapshot; // ثابت لعرض السلة
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const CartSnapshotSchema = new Schema<CartSnapshot>(
  {
    title: {
      ar: { type: String, trim: true },
      en: { type: String, trim: true },
    },
    slug: { type: String, required: true, trim: true },
    image: { type: String, trim: true },

    priceHalalas: { type: Number, required: true, min: 0 },
    salesPriceHalalas: { type: Number, min: 0 },
    currency: { type: String, enum: ['SAR'], default: 'SAR', required: true },

    // ConsultationHold fields
    holdId: { type: String },
    offeringId: { type: String },
    instructorId: { type: String },
    start: { type: Date },
    end: { type: Date },
    durationMinutes: { type: Number, min: 10, max: 240 },
    consultationType: { type: String, enum: ['academic', 'social', 'coaching'] },
    expiresAt: { type: Date },
  },
  { _id: false },
);

const CartItemSchema = new Schema<ICartItem>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    itemRef: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    itemType: {
      type: String,
      enum: ['Book', 'Course', 'ConsultationHold'],
      required: true,
      index: true,
    },

    quantity: {
      type: Number,
      default: 1,
      min: [1, 'الكمية يجب أن تكون 1 أو أكثر'],
    },

    addedAt: { type: Date, default: Date.now },

    snapshot: { type: CartSnapshotSchema, required: true },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

CartItemSchema.path('snapshot').validate(function (this: ICartItem, snap: any) {
  if (this.itemType !== 'ConsultationHold') return true;

  if (!snap?.holdId || !snap?.offeringId || !snap?.instructorId) return false;
  if (!snap?.start || !snap?.end || !snap?.expiresAt) return false;

  if (new Date(snap.expiresAt).getTime() <= Date.now()) return false;

  return true;
}, 'Invalid consultation snapshot');

CartItemSchema.index(
  { user: 1, itemType: 1, itemRef: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

CartItemSchema.pre('validate', function (next) {
  if (this.quantity < 1) this.quantity = 1;
  next();
});

const CartItem = mongoose.model<ICartItem>('CartItem', CartItemSchema);
export default CartItem;
