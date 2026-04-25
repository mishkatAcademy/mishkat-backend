// src/services/libraryService.ts
import { Types } from 'mongoose';
import Order from '../models/Order';
import Book from '../models/Book';
import AppError from '../utils/AppError';
import { fromHalalas } from '../utils/money';
import { makeSignedBookUrl } from '../utils/secureLinks';

export async function listMyBooksService(userId: string, page = 1, limit = 10) {
  const p = Math.max(1, page | 0);
  const l = Math.min(100, Math.max(1, limit | 0));
  const skip = (p - 1) * l;

  const uid = new Types.ObjectId(userId);

  const pipeline: any[] = [
    {
      $match: {
        user: uid,
        status: { $in: ['paid', 'fulfilled'] },
        'payment.status': 'paid',
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.type': 'Book' } },

    { $sort: { createdAt: -1 } },

    {
      $group: {
        _id: '$items.refId', // bookId
        ownedQuantity: { $sum: '$items.quantity' },

        lastPurchasedAt: { $first: '$createdAt' },
        lastOrderId: { $first: '$_id' },

        lastSnapshot: { $first: '$items.snapshot' },
        lastUnitPriceHalalas: { $first: '$items.unitPriceHalalas' },
        lastLineTotalHalalas: { $first: '$items.lineTotalHalalas' },
        lastQtyInOrder: { $first: '$items.quantity' },
      },
    },

    // join with books
    {
      $lookup: {
        from: 'books',
        localField: '_id',
        foreignField: '_id',
        as: 'book',
      },
    },
    { $unwind: { path: '$book', preserveNullAndEmptyArrays: true } },

    {
      $addFields: {
        bookId: { $toString: '$_id' },
        isAvailable: {
          $cond: [
            { $or: [{ $eq: ['$book', null] }, { $eq: ['$book.isDeleted', true] }] },
            false,
            true,
          ],
        },

        currentPriceSAR: {
          $cond: [
            { $and: [{ $ne: ['$book', null] }, { $ne: ['$book.priceHalallas', null] }] },
            { $divide: ['$book.priceHalallas', 100] },
            null,
          ],
        },
        currentSalesPriceSAR: {
          $cond: [
            { $and: [{ $ne: ['$book', null] }, { $ne: ['$book.salesPriceHalallas', null] }] },
            { $divide: ['$book.salesPriceHalallas', 100] },
            null,
          ],
        },
        currentEffectivePriceSAR: {
          $cond: [
            { $ne: ['$book', null] },
            {
              $divide: [{ $ifNull: ['$book.salesPriceHalallas', '$book.priceHalallas'] }, 100],
            },
            null,
          ],
        },
      },
    },

    { $sort: { lastPurchasedAt: -1 } },

    {
      $facet: {
        items: [{ $skip: skip }, { $limit: l }],
        meta: [{ $count: 'total' }],
      },
    },
    {
      $addFields: {
        total: { $ifNull: [{ $arrayElemAt: ['$meta.total', 0] }, 0] },
      },
    },
    { $project: { meta: 0 } },
  ];

  const agg = await Order.aggregate(pipeline);
  const row = agg?.[0] || { items: [], total: 0 };

  const total = row.total || 0;
  const pages = Math.max(1, Math.ceil(total / l));

  const items = (row.items || []).map((x: any) => ({
    bookId: x.bookId,
    ownedQuantity: x.ownedQuantity,

    lastPurchasedAt: x.lastPurchasedAt,
    lastOrderId: String(x.lastOrderId),

    snapshot: x.lastSnapshot,

    pricing: {
      currency: 'SAR' as const,
      unitPrice:
        typeof x.lastUnitPriceHalalas === 'number' ? fromHalalas(x.lastUnitPriceHalalas) : 0,
      unitPriceHalalas: x.lastUnitPriceHalalas,

      qtyInLastOrder: x.lastQtyInOrder ?? 1,

      lineTotal:
        typeof x.lastLineTotalHalalas === 'number' ? fromHalalas(x.lastLineTotalHalalas) : 0,
      lineTotalHalalas: x.lastLineTotalHalalas,
    },

    book: x.book
      ? {
          id: String(x.book._id),
          title: x.book.title,
          slug: x.book.slug,
          image: x.book.image,
          isDigital: x.book.isDigital,

          currentPrice: x.currentPriceSAR,
          currentSalesPrice: x.currentSalesPriceSAR,
          currentEffectivePrice: x.currentEffectivePriceSAR,
        }
      : null,

    isAvailable: x.isAvailable,
  }));

  return {
    items,
    meta: {
      total,
      page: p,
      limit: l,
      pages,
      hasNextPage: p < pages,
      hasPrevPage: p > 1,
    },
  };
}

export async function getMyBookByIdService(userId: string, bookId: string) {
  if (!Types.ObjectId.isValid(bookId)) throw AppError.badRequest('Invalid id');

  const uid = new Types.ObjectId(userId);
  const bid = new Types.ObjectId(bookId);

  const lastOrder = await Order.findOne({
    user: uid,
    status: { $in: ['paid', 'fulfilled'] },
    'payment.status': 'paid',
    items: { $elemMatch: { type: 'Book', refId: bid } },
  })
    .sort({ createdAt: -1 })
    .select('_id createdAt items')
    .lean();

  if (!lastOrder) throw AppError.forbidden('You do not own this book');

  const item = (lastOrder as any).items.find(
    (x: any) => x.type === 'Book' && String(x.refId) === String(bid),
  );

  const qtyAgg = await Order.aggregate([
    {
      $match: {
        user: uid,
        status: { $in: ['paid', 'fulfilled'] },
        'payment.status': 'paid',
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.type': 'Book', 'items.refId': bid } },
    { $group: { _id: '$items.refId', ownedQuantity: { $sum: '$items.quantity' } } },
  ]);

  const ownedQuantity = qtyAgg?.[0]?.ownedQuantity ?? item?.quantity ?? 1;

  return {
    ownership: {
      ownedQuantity,
      lastOrderId: String((lastOrder as any)._id),
      lastPurchasedAt: (lastOrder as any).createdAt,
      snapshot: item?.snapshot,
      pricing: {
        currency: 'SAR' as const,
        unitPrice:
          typeof item?.unitPriceHalalas === 'number' ? fromHalalas(item.unitPriceHalalas) : 0,
        unitPriceHalalas: item?.unitPriceHalalas,
        quantity: item?.quantity ?? 1,
        lineTotal:
          typeof item?.lineTotalHalalas === 'number' ? fromHalalas(item.lineTotalHalalas) : 0,
        lineTotalHalalas: item?.lineTotalHalalas,
      },
    },
  };
}

export async function getMyBookReadUrlService(userId: string, bookId: string) {
  if (!Types.ObjectId.isValid(bookId)) throw AppError.badRequest('Invalid id');

  const uid = new Types.ObjectId(userId);
  const bid = new Types.ObjectId(bookId);

  const owns = await Order.exists({
    user: uid,
    status: { $in: ['paid', 'fulfilled'] },
    'payment.status': 'paid',
    items: { $elemMatch: { type: 'Book', refId: bid } },
  });

  if (!owns) throw AppError.forbidden('You do not own this book');

  const book = await Book.findById(bid).select('isDeleted isDigital pdfRelPath pdfUrl').lean();
  if (!book || (book as any).isDeleted) throw AppError.notFound('Book not found');

  if (!(book as any).isDigital) throw AppError.badRequest('This book is not digital');

  const pdfRelPath = (book as any).pdfRelPath as string | undefined;
  if (!pdfRelPath) {
    throw AppError.badRequest('pdfRelPath is missing for this book');
  }

  const signed = makeSignedBookUrl(pdfRelPath);

  return {
    bookId: String(bid),
    readUrl: signed.readUrl,
    expiresAt: signed.expiresAt,
  };
}
