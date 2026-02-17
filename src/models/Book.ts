// src/models/Book.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import slugify from 'slugify';

/** 👈 تمثيل نص محلّي (عربي/إنجليزي) */
export type LocalizedText = {
  ar?: string;
  en?: string;
};

export interface IBook extends Document {
  // نصوص محلّية
  title: LocalizedText;
  slug: string;
  description?: LocalizedText;

  author: LocalizedText;
  publisher?: LocalizedText;

  language: 'ar' | 'en';

  image?: string;
  imageRelPath?: string;

  // الأسعار (بالهللة)
  priceHalallas: number;
  salesPriceHalallas?: number | null;

  // رقمي/ورقي
  isDigital: boolean;

  // ⚠️ back-compat؛ الأفضل لاحقًا subdoc pdf{url,relPath,...}
  pdfUrl?: string;
  pdfRelPath?: string;

  stock?: number | null;

  // تصنيفات + ميتاداتا
  categories?: Types.ObjectId[];
  showInHomepage: boolean;

  // تقييمات
  avgRating: number;
  ratingsCount: number;

  // نشر وطباعة
  pages?: number;
  publishDate?: Date;
  isbn?: string;

  // إدارة
  soldCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Virtuals (عرض)
  priceSAR?: number;
  salesPriceSAR?: number | null;
  effectivePriceHalallas?: number;
  effectivePriceSAR?: number;
  isOnSale?: boolean;
  isInStock?: boolean;
}

/* ----------------- Helpers: get updated values in validators ----------------- */
function getUpdated<T>(doc: any, path: string, fallback: T): T {
  if (doc && typeof doc.getUpdate === 'function') {
    const u = doc.getUpdate() || {};
    const set = u.$set || u;
    return (set?.[path] ?? fallback) as T;
  }
  return (doc?.[path] ?? fallback) as T;
}

/** سكيمة للنصوص المحلية (بدون _id) */
const LocalizedSchema = new Schema<LocalizedText>(
  {
    ar: { type: String, trim: true },
    en: { type: String, trim: true },
  },
  { _id: false },
);

const BookSchema = new Schema<IBook>(
  {
    // ========= نصوص محلّية =========
    title: {
      type: LocalizedSchema,
      required: true,
      validate: {
        validator(v: LocalizedText) {
          return Boolean(v && ((v.ar && v.ar.trim()) || (v.en && v.en.trim())));
        },
        message: 'يجب إدخال عنوان بالعربية أو بالإنجليزية.',
      },
    },

    // لو عايز ثبات URL: فعّل immutable: true
    slug: { type: String, required: true /*, immutable: true*/ },

    description: { type: LocalizedSchema },

    author: {
      type: LocalizedSchema,
      required: true,
      validate: {
        validator(v: LocalizedText) {
          return Boolean(v && ((v.ar && v.ar.trim()) || (v.en && v.en.trim())));
        },
        message: 'يجب إدخال اسم المؤلف بالعربية أو بالإنجليزية.',
      },
    },

    publisher: { type: LocalizedSchema },

    language: { type: String, enum: ['ar', 'en'], default: 'ar' },

    image: {
      type: String,
      set: (v: string) => (typeof v === 'string' ? v.trim() : v),
    },
    imageRelPath: { type: String }, // لإدارة الملفات محليًا

    // ========= الأسعار (بالهللة) =========
    priceHalallas: {
      type: Number,
      required: true,
      min: [0, 'السعر لا يمكن أن يكون سالبًا'],
      validate: {
        validator(v: number) {
          return Number.isInteger(v);
        },
        message: 'priceHalallas يجب أن يكون عددًا صحيحًا (هللة)',
      },
    },
    salesPriceHalallas: {
      type: Number,
      default: null,
      validate: {
        validator(this: any, v: number | null) {
          if (v == null) return true;
          const price = getUpdated<number>(this, 'priceHalallas', this.priceHalallas);
          return Number.isInteger(v) && v >= 0 && v <= price;
        },
        message: 'سعر التخفيض يجب أن يكون صحيحًا وأقل من/يساوي السعر',
      },
    },

    // ========= رقمي/ورقي =========
    isDigital: { type: Boolean, default: true },

    pdfUrl: {
      type: String,
      set: (v: string) => (typeof v === 'string' ? v.trim() : v),
      validate: {
        validator(this: any, value?: string) {
          const isDigital = getUpdated<boolean>(this, 'isDigital', this.isDigital);
          if (!isDigital) return true; // الورقي: تجاهل
          // نسمح بـ .pdf مع أو بدون query string
          return typeof value === 'string' && /\.pdf($|\?)/i.test(value);
        },
        message: 'رابط PDF غير صالح أو مفقود للكتاب الرقمي',
      },
    },
    pdfRelPath: { type: String },

    stock: {
      type: Number,
      default(this: IBook) {
        return this.isDigital ? null : 0;
      },
      validate: {
        validator(this: any, v?: number | null) {
          const isDigital = getUpdated<boolean>(this, 'isDigital', this.isDigital);
          if (isDigital) return v == null; // الرقمي: لازم تكون null/غير موجودة
          return typeof v === 'number' && v >= 0;
        },
        message: 'Stock مطلوب ويجب أن يكون ≥ 0 للكتب الورقية، وممنوع للرقمية',
      },
    },

    // ========= تصنيفات + ميتاداتا =========
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category', index: true }],
    showInHomepage: { type: Boolean, default: false },

    // ========= تقييمات =========
    avgRating: { type: Number, default: 5, min: 0, max: 5 },
    ratingsCount: { type: Number, default: 0, min: 0 },

    // ========= نشر وطباعة =========
    pages: { type: Number, min: [1, 'يجب أن يحتوي الكتاب على صفحة واحدة على الأقل'] },
    publishDate: { type: Date },

    isbn: {
      type: String,
      set: (v: string) => (typeof v === 'string' ? v.trim() : v),
      validate: {
        validator(v?: string) {
          if (!v) return true; // اختياري
          // ISBN-10 أو ISBN-13: أرقام مع/بدون شرطات (تحقق بسيط)
          return /^(\d{10}|\d{13}|[\d-]{10,17})$/.test(v);
        },
        message: 'ISBN غير صالح',
      },
    },

    // ========= إدارة =========
    soldCount: { type: Number, default: 0, min: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        // لا تُرجع المسارات الداخلية للعميل
        delete ret.imageRelPath;
        delete ret.pdfRelPath;
        return ret;
      },
    },
    toObject: { virtuals: true },
    // versionKey: false, // لو حابب تلغي __v
  },
);

/* ==================== فهارس مهمة ==================== */

// 1) slug فريد فقط على العناصر النشطة (يتماشى مع soft delete)
BookSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

// 2) ISBN فريد للكتب غير المحذوفة فقط، ومع قيمة غير فارغة
BookSchema.index(
  { isbn: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
      isbn: { $exists: true, $ne: null, $gt: '' },
    },
  },
);

// 3) شيوع الاستعلامات
BookSchema.index({ showInHomepage: 1, isDeleted: 1 });
BookSchema.index({ categories: 1, isDeleted: 1, createdAt: -1 });
BookSchema.index({ priceHalallas: 1 });
BookSchema.index({ createdAt: -1 });

// 4) (اختياري) بحث نصي بسيط
BookSchema.index(
  { 'title.ar': 'text', 'title.en': 'text', 'description.ar': 'text', 'description.en': 'text' },
  { default_language: 'none' },
);

/* ==================== Virtuals ==================== */

BookSchema.virtual('priceSAR').get(function (this: IBook) {
  return typeof this.priceHalallas === 'number' ? this.priceHalallas / 100 : undefined;
});

BookSchema.virtual('salesPriceSAR').get(function (this: IBook) {
  return typeof this.salesPriceHalallas === 'number' ? this.salesPriceHalallas / 100 : null;
});

BookSchema.virtual('effectivePriceHalallas').get(function (this: IBook) {
  return typeof this.salesPriceHalallas === 'number' && this.salesPriceHalallas >= 0
    ? this.salesPriceHalallas
    : this.priceHalallas;
});

BookSchema.virtual('effectivePriceSAR').get(function (this: IBook) {
  const h = (this as any).effectivePriceHalallas as number | undefined;
  return typeof h === 'number' ? h / 100 : undefined;
});

BookSchema.virtual('isOnSale').get(function (this: IBook) {
  return (
    typeof this.salesPriceHalallas === 'number' && this.salesPriceHalallas < this.priceHalallas
  );
});

BookSchema.virtual('isInStock').get(function (this: IBook) {
  return this.isDigital ? true : typeof this.stock === 'number' && this.stock > 0;
});

/* ==================== Hooks ==================== */

// Fallback لعمل slug لو لم يُمرّر (الخدمة أفضل مكان لضمان uniqueness)
BookSchema.pre('validate', function (next) {
  if (!this.slug && (this.title?.en || this.title?.ar)) {
    const base = (this.title?.en || this.title?.ar || '').trim();
    if (base) {
      this.slug = slugify(base, { lower: true, strict: true, locale: 'ar' });
    }
  }
  // تطبيع تلقائي: الكتاب الرقمي => stock=null
  if (this.isDigital) {
    this.stock = null as any;
  }
  next();
});

// تطبيع عند التحديث عبر findOneAndUpdate (مش بيمر على pre('validate'))
BookSchema.pre('findOneAndUpdate', function (next) {
  const u: any = this.getUpdate() || {};
  const $set = (u.$set = u.$set || {});
  const $unset = (u.$unset = u.$unset || {});
  if (typeof $set.isDigital === 'boolean') {
    if ($set.isDigital) {
      // رقمي
      $set.stock = null;
    } else {
      // ورقي
      $unset.pdfUrl = '';
      $unset.pdfRelPath = '';
      if ($set.stock == null && !('stock' in $unset)) $set.stock = 0;
    }
  }
  this.setUpdate(u);
  next();
});

export default mongoose.model<IBook>('Book', BookSchema);
