// src/models/Category.ts
import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export type CategoryScope = 'book' | 'course';

export interface LocalizedText {
  ar?: string;
  en?: string;
}

export interface ICategory extends Document {
  title: LocalizedText;
  slug: string;
  description?: LocalizedText;
  image?: string;

  scopes: CategoryScope[]; // ['book'] | ['course'] | ['book','course']
  booksCount: number;
  coursesCount: number;

  order?: number;
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const LocalizedSchema = new Schema<LocalizedText>(
  {
    ar: { type: String, trim: true },
    en: { type: String, trim: true },
  },
  { _id: false },
);

const CategorySchema = new Schema<ICategory>(
  {
    title: { type: LocalizedSchema, required: true }, // التحقق الحقيقي في pre('validate')
    slug: { type: String, required: true, lowercase: true, trim: true },

    description: { type: LocalizedSchema },
    image: { type: String, trim: true },

    scopes: {
      type: [String],
      enum: ['book', 'course'],
      required: true,
      default: ['book', 'course'],
    },

    booksCount: { type: Number, default: 0, min: 0 },
    coursesCount: { type: Number, default: 0, min: 0 },

    order: { type: Number, default: 0 },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret: any) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.isDeleted;
      },
    },
    toObject: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret: any) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.isDeleted;
      },
    },
  },
);

/* ========== Validations & Hooks ========== */

// لازم عنوان بالعربي أو الإنجليزي على الأقل + scopes غير فاضية
CategorySchema.pre('validate', function (next) {
  try {
    const t = (this as ICategory).title || {};
    const hasAny =
      (typeof t.ar === 'string' && t.ar.trim().length > 0) ||
      (typeof t.en === 'string' && t.en.trim().length > 0);

    if (!hasAny) return next(new Error('Title is required in at least one language (ar or en).'));

    const scopes = (this as ICategory).scopes;
    if (!Array.isArray(scopes) || scopes.length === 0) {
      return next(new Error('At least one scope is required.'));
    }

    // تطبيع إضافي للـ slug (لو جالك من السيرفس مظبوط خلاص)
    if (typeof this.slug === 'string') {
      this.slug = this.slug.trim().toLowerCase();
      // اختياري: enforce pattern (لو بتستخدم slugify بحروف لاتينية)
      // if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(this.slug)) {
      //   return next(new Error('Invalid slug format.'));
      // }
    }

    next();
  } catch (err) {
    next(err as any);
  }
});

/* ========== Indexes ========== */

// slug فريد للعناصر غير المحذوفة (يتماشى مع soft-delete)
CategorySchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

// فهارس مساعدة للاستعلامات الشائعة
CategorySchema.index({ isDeleted: 1, scopes: 1, order: 1 });
CategorySchema.index({ isDeleted: 1, booksCount: -1 });
CategorySchema.index({ isDeleted: 1, coursesCount: -1 });

/* ========== Statics (typed) ========== */
export interface CategoryModel extends Model<ICategory> {
  incCount(id: Types.ObjectId | string, scope: CategoryScope, delta: 1 | -1): Promise<void>;
}

async function incCountImpl(
  this: Model<ICategory>,
  id: Types.ObjectId | string,
  scope: CategoryScope,
  delta: 1 | -1,
): Promise<void> {
  const field = scope === 'book' ? 'booksCount' : 'coursesCount';

  await this.updateOne({ _id: id, isDeleted: false }, { $inc: { [field]: delta } as any });

  // قصّ القيم السالبة لو حصل تسابق نادر
  await this.updateOne({ _id: id, [field]: { $lt: 0 } as any }, { $set: { [field]: 0 } });
}

// التعيين بشكل مُنضبط للـ typing
(CategorySchema.statics as unknown as CategoryModel).incCount = incCountImpl;

const Category = mongoose.model<ICategory, CategoryModel>('Category', CategorySchema);
export default Category;
