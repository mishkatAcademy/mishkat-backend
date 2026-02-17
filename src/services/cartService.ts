// src/services/cartService.ts
import { Types } from 'mongoose';
import AppError from '../utils/AppError';
import CartItem from '../models/CartItem';

// موديلات العناصر
import Book from '../models/Book';
import Course from '../models/Course';
import ConsultationOffering from '../models/ConsultationOffering';
import ConsultationHold from '../models/ConsultationHold';
// import Research from '../models/ResearchRequest';

const MAX_QTY_PHYSICAL_BOOK = 20 as const;

// Helpers
type Localized = { ar?: string; en?: string };
const pickLocalized = (obj?: Localized): Localized => ({
  ar: obj?.ar?.trim() || undefined,
  en: obj?.en?.trim() || undefined,
});

function unitPriceFromDoc(doc: any) {
  // نتوقع حقول halalas (حسب تعديلات الكتب) وإلا fallback لو لسه قديم
  const price =
    typeof doc.priceHalalas === 'number' ? doc.priceHalalas : Math.round((doc.price || 0) * 100);
  const sale =
    typeof doc.salesPriceHalalas === 'number'
      ? doc.salesPriceHalalas
      : doc.salesPrice
        ? Math.round(doc.salesPrice * 100)
        : undefined;
  return { priceHalalas: price, salesPriceHalalas: sale };
}

function ensureEnoughStock(book: any, desiredQty: number) {
  // book.isDigital === false => لازم stock كافي
  if (book.isDigital) return;
  const stock: number = Number(book.stock ?? 0);
  if (Number.isNaN(stock) || stock < desiredQty) {
    throw AppError.badRequest('الكمية المطلوبة غير متاحة في المخزون');
  }
}

function isFixedQuantity(type: string, doc: any): boolean {
  // Book: لو رقمي → ثابت 1؛ غير كده الأنواع التانية كلها ثابت 1
  if (type === 'Book') return !!doc.isDigital;
  return true; // Course / ConsultationHold
}

function buildSnapshotFromDoc(itemType: 'Book' | 'Course', doc: any) {
  const { priceHalalas, salesPriceHalalas } = unitPriceFromDoc(doc);
  return {
    title: pickLocalized(doc.title),
    slug: doc.slug ?? String(doc._id),
    image: doc.image ?? doc.coverUrl,
    priceHalalas,
    salesPriceHalalas,
    currency: 'SAR' as const,
  };
}

async function buildSnapshotFromHold(hold: any) {
  const off = await ConsultationOffering.findById(hold.offering).lean();
  if (!off || !off.isActive) throw AppError.badRequest('Offering غير متاح');

  return {
    title: pickLocalized(off.title),
    slug: String(off._id),
    image: undefined,
    priceHalalas: off.priceHalalas,
    salesPriceHalalas: undefined,
    currency: 'SAR' as const,

    holdId: String(hold._id),
    offeringId: String(off._id),
    instructorId: String(hold.instructor),
    start: hold.start,
    end: hold.end,
    durationMinutes: off.durationMinutes,
    consultationType: off.type,
    expiresAt: hold.expiresAt, // ✅ هنا
  };
}

const modelMap: Record<string, any> = {
  Book,
  Course,
  ConsultationHold,
};

// ========== Services ==========

export async function getCartService(userId: string) {
  await CartItem.updateMany(
    {
      user: userId,
      itemType: 'ConsultationHold',
      isDeleted: false,
      'snapshot.end': { $lte: new Date() },
    },
    { $set: { isDeleted: true } },
  );

  const items = await CartItem.find({ user: userId, isDeleted: false })
    .sort({ addedAt: -1 })
    .lean();

  let itemsCount = 0;
  let subtotalHalalas = 0;

  for (const it of items) {
    const unit = (it.snapshot.salesPriceHalalas ?? it.snapshot.priceHalalas) || 0;
    const qty = it.quantity || 1;
    itemsCount += qty;
    subtotalHalalas += unit * qty;
  }

  return {
    items,
    totals: {
      currency: 'SAR' as const,
      itemsCount,
      subtotalHalalas,
    },
  };
}

export async function addCartItemService(input: {
  userId: string;
  itemType: 'Book' | 'Course' | 'ConsultationHold';
  itemRef: string;
  quantity?: number;
}) {
  const { userId, itemType, itemRef } = input;
  let { quantity = 1 } = input;

  const Model = modelMap[itemType];
  if (!Model) throw AppError.badRequest('نوع العنصر غير مدعوم حالياً');

  // 1) doc
  const doc = await Model.findById(itemRef).lean();
  if (!doc) throw AppError.notFound('العنصر غير موجود');

  // ✅ soft-delete only for models that have it
  if (itemType !== 'ConsultationHold' && doc.isDeleted) {
    throw AppError.notFound('العنصر غير موجود');
  }

  // ✅ ConsultationHold guards
  if (itemType === 'ConsultationHold') {
    if (doc.status !== 'holding') throw AppError.badRequest('Hold غير صالح');
    if (doc.expiresAt && new Date(doc.expiresAt) <= new Date()) {
      throw AppError.badRequest('Hold انتهى');
    }
    // لو الـ hold مربوط بمستخدم، لازم هو نفسه
    if (doc.user && String(doc.user) !== String(userId)) {
      throw AppError.forbidden('هذا الـ Hold لا يخص هذا المستخدم');
    }
    // كمية ثابتة
    quantity = 1;
  }

  // 2) fixed quantity
  const fixed = isFixedQuantity(itemType, doc);
  if (fixed) quantity = 1;

  // 3) physical book stock
  if (!fixed && itemType === 'Book' && !doc.isDigital) {
    if (quantity > MAX_QTY_PHYSICAL_BOOK) quantity = MAX_QTY_PHYSICAL_BOOK;
    ensureEnoughStock(doc, quantity);
  }

  // 4) existing?
  const existing = await CartItem.findOne({ user: userId, itemType, itemRef, isDeleted: false });

  //  ✅ snapshot
  const snapshot =
    itemType === 'ConsultationHold'
      ? await buildSnapshotFromHold(doc)
      : buildSnapshotFromDoc(itemType, doc);

  if (existing) {
    if (fixed) return existing.toJSON();

    const desired = Math.min(existing.quantity + quantity, MAX_QTY_PHYSICAL_BOOK);
    ensureEnoughStock(doc, desired);

    existing.quantity = desired;
    existing.snapshot = snapshot;
    await existing.save();
    return existing.toJSON();
  }

  // 5) عنصر جديد
  const created = await CartItem.create({
    user: userId,
    itemType,
    itemRef,
    quantity,
    snapshot,
  });

  return created.toJSON();
}

export async function updateCartItemQuantityService(input: {
  userId: string;
  cartItemId: string;
  quantity: number;
}) {
  const { userId, cartItemId, quantity } = input;

  const item = await CartItem.findOne({ _id: cartItemId, user: userId, isDeleted: false });
  if (!item) throw AppError.notFound('العنصر غير موجود في سلة التسوق');

  // الأنواع غير الورقية = كمية ثابتة 1
  if (item.itemType !== 'Book') {
    throw AppError.badRequest('لا يمكن تعديل الكمية لهذا النوع');
  }

  // لازم نجيب الكتاب علشان نعرف isDigital/stock/الأسعار الحالية (لتحديث snapshot)
  const book = await Book.findById(item.itemRef).lean();
  if (!book || book.isDeleted) throw AppError.notFound('العنصر غير متاح');

  if (book.isDigital) {
    throw AppError.badRequest('هذا الكتاب رقمي والكمية ثابتة = 1');
  }

  const desired = Math.min(Math.max(1, quantity), MAX_QTY_PHYSICAL_BOOK);
  ensureEnoughStock(book, desired);

  const { priceHalalas, salesPriceHalalas } = unitPriceFromDoc(book);
  item.quantity = desired;
  item.snapshot = {
    ...item.snapshot,
    title: pickLocalized(book.title),
    slug: book.slug,
    image: book.image,
    priceHalalas,
    salesPriceHalalas,
  };
  await item.save();

  return item.toJSON();
}

export async function removeCartItemService(input: { userId: string; cartItemId: string }) {
  const { userId, cartItemId } = input;
  const item = await CartItem.findOne({ _id: cartItemId, user: userId, isDeleted: false });
  if (!item) throw AppError.notFound('العنصر غير موجود في سلة التسوق');

  item.isDeleted = true;
  await item.save();
}

export async function clearCartService(userId: string) {
  await CartItem.updateMany({ user: userId, isDeleted: false }, { $set: { isDeleted: true } });
}
