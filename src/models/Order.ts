// src/models/Order.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'paid_review'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'fulfilled';

export type OrderItemType = 'Book' | 'Course' | 'ConsultationHold' | 'ConsultationBooking';

export interface PaymentDiscrepancy {
  reason: 'pending' | 'amount_mismatch' | 'currency_mismatch' | 'logical_mismatch';
  expectedAmountHalalas: number;
  receivedAmountHalalas?: number;
  expectedCurrency: 'SAR';
  receivedCurrency?: string;
  deltaHalalas?: number; // received - expected
  details?: any;
}

export type PaymentWarningKind = 'stock_decrement_failed';

export interface PaymentWarning {
  kind: PaymentWarningKind;
  refId: string;
  qty: number;
  at: Date;
  message?: string;
}

export interface LocalizedText {
  ar?: string;
  en?: string;
}

export interface OrderItemSnapshot {
  title: LocalizedText;
  slug?: string;
  image?: string;
  // type-specific (نستخدمهم عشان الشحن والديجيتال)
  isDigital?: boolean; // للكتب والكورسات مثلاً

  cartItemId?: string;
  holdId?: string;
  bookingId?: string;
}

export interface OrderItem {
  _id: Types.ObjectId;
  type: OrderItemType;
  refId: Types.ObjectId; // المرجع الأصلي (Book/Course/...)
  quantity: number; // للديجيتال بنخليها 1
  unitPriceHalalas: number; // السعر وقت الشراء
  lineTotalHalalas: number; // = unit * qty
  requiresShipping: boolean; // true للكتب الورقية فقط
  snapshot: OrderItemSnapshot; // عشان نظهر بيانات وقت الشراء
}

export interface AddressSnapshot {
  label?: 'home' | 'work' | 'other';
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  notes?: string;
}

export interface PaymentInfo {
  provider: 'moyasar'; // لحد دلوقتي
  paymentId?: string; // id من مزود الدفع (unique)
  status: 'pending' | 'paid' | 'failed';
  amountHalalas: number; // المبلغ المطلوب دفعه
  currency: 'SAR';
  paidAt?: Date;
  raw?: any; // payload من الويبهوك
  discrepancy?: PaymentDiscrepancy;
  warnings?: PaymentWarning[];
}

export interface Totals {
  subtotalHalalas: number;
  shippingHalalas: number;
  vatHalalas: number;
  discountHalalas: number;
  grandTotalHalalas: number;
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  status: OrderStatus;
  currency: 'SAR';
  items: OrderItem[];

  // لقواعد الشحن والفوترة
  addressRef?: Types.ObjectId; // 👈 ربط اختياري بعنوان المستخدم وقت الشراء
  address?: AddressSnapshot; // 👈 السnapshot ثابتة

  totals: Totals;

  payment: PaymentInfo;

  notes?: string;

  // أي بيانات إضافية للوفاء/التسليم
  fulfillment?: {
    status: 'none' | 'pending' | 'shipped' | 'delivered';
    shippedAt?: Date;
    trackingNumber?: string;
    carrier?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const PaymentWarningSchema = new Schema(
  {
    kind: { type: String, enum: ['stock_decrement_failed'], required: true },
    refId: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    at: { type: Date, required: true },
    message: { type: String },
  },
  { _id: false },
);

const PaymentDiscrepancySchema = new Schema<PaymentDiscrepancy>(
  {
    reason: {
      type: String,
      enum: ['pending', 'amount_mismatch', 'currency_mismatch', 'logical_mismatch'],
      required: true,
    },
    expectedAmountHalalas: { type: Number, required: true, min: 0 },
    receivedAmountHalalas: { type: Number, min: 0 },
    expectedCurrency: { type: String, enum: ['SAR'], default: 'SAR', required: true },
    receivedCurrency: { type: String },
    deltaHalalas: { type: Number },
    details: Schema.Types.Mixed,
  },
  { _id: false },
);

const LocalizedTextSchema = new Schema<LocalizedText>(
  {
    ar: { type: String, trim: true },
    en: { type: String, trim: true },
  },
  { _id: false },
);

const OrderItemSnapshotSchema = new Schema<OrderItemSnapshot>(
  {
    title: { type: LocalizedTextSchema, required: true },
    slug: String,
    image: String,
    isDigital: Boolean,

    cartItemId: String,
    holdId: String,
    bookingId: String,
  },
  { _id: false },
);

const OrderItemSchema = new Schema<OrderItem>(
  {
    type: {
      type: String,
      enum: ['Book', 'Course', 'ConsultationHold', 'ConsultationBooking'],
      required: true,
    },
    refId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceHalalas: { type: Number, required: true, min: 0 },
    lineTotalHalalas: { type: Number, required: true, min: 0 },
    requiresShipping: { type: Boolean, required: true },
    snapshot: { type: OrderItemSnapshotSchema, required: true },
  },
  { _id: true },
);

const AddressSnapshotSchema = new Schema<AddressSnapshot>(
  {
    label: { type: String, enum: ['home', 'work', 'other'] },
    recipientName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: String,
    postalCode: String,
    country: { type: String, required: true },
    notes: String,
  },
  { _id: false },
);

const TotalsSchema = new Schema<Totals>(
  {
    subtotalHalalas: { type: Number, required: true, min: 0 },
    shippingHalalas: { type: Number, required: true, min: 0 },
    vatHalalas: { type: Number, required: true, min: 0 },
    discountHalalas: { type: Number, required: true, min: 0 },
    grandTotalHalalas: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PaymentInfoSchema = new Schema<PaymentInfo>(
  {
    provider: { type: String, enum: ['moyasar'], required: true },
    paymentId: { type: String, index: true, sparse: true, unique: true }, // يمنع تكرار نفس الدفع
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      required: true,
      default: 'pending',
    },
    amountHalalas: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['SAR'], required: true, default: 'SAR' },
    paidAt: Date,
    raw: Schema.Types.Mixed,
    discrepancy: { type: PaymentDiscrepancySchema, required: false },
    warnings: { type: [PaymentWarningSchema], default: [] },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: [
        'pending_payment',
        'paid',
        'paid_review',
        'failed',
        'cancelled',
        'refunded',
        'fulfilled',
      ],
      default: 'pending_payment',
      index: true,
    },
    currency: { type: String, enum: ['SAR'], default: 'SAR' },
    items: { type: [OrderItemSchema], required: true },
    addressRef: { type: Schema.Types.ObjectId, ref: 'Address' }, // optional
    address: { type: AddressSnapshotSchema, required: false },
    totals: { type: TotalsSchema, required: true },
    payment: { type: PaymentInfoSchema, required: true },
    notes: { type: String },
    fulfillment: {
      status: { type: String, enum: ['none', 'pending', 'shipped', 'delivered'], default: 'none' },
      shippedAt: Date,
      trackingNumber: String,
      carrier: String,
    },
  },
  { timestamps: true },
);

// فهارس مفيدة
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IOrder>('Order', OrderSchema);
