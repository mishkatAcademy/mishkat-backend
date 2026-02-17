import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAddress extends Document {
  user: Types.ObjectId;
  label?: 'home' | 'work' | 'other';
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  notes?: string;

  isDefault: boolean;
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // ⚡ لتسريع الاستعلام حسب المستخدم
    },
    label: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
    recipientName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    isDefault: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

/**
 * ✅ قيود وفهارس مهمّة:
 * - عنوان افتراضي واحد نشط لكل مستخدم:
 *   unique مع partialFilterExpression على isDefault:true و isDeleted:false
 * - فهرس مركّب لتسريع القوائم
 */
addressSchema.index(
  { user: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true, isDeleted: false } },
);
addressSchema.index({ user: 1, isDeleted: 1, createdAt: -1 });

const Address = mongoose.model<IAddress>('Address', addressSchema);
export default Address;
