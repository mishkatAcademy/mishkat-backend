// src/services/bookService.ts
import type { Types } from 'mongoose';
import type { Express } from 'express';
import Book from '../models/Book';
import Category, { CategoryModel } from '../models/Category';
import { AppError } from '../utils/AppError';
import { toHalalas, fromHalalas } from '../utils/money';
import { slugFromLocalized, makeUniqueSlug } from '../utils/slug';
import { moveDiskFileToUploads, deleteLocalByRelPath } from './localFiles.disk';

type ObjectId = Types.ObjectId | string;
type SortDir = 1 | -1;

type CreateBookInput = {
  title: { ar?: string; en?: string };
  description?: { ar?: string; en?: string };
  author: { ar?: string; en?: string };
  publisher?: { ar?: string; en?: string };
  language?: 'ar' | 'en';
  image?: string;

  price: number;
  salesPrice?: number | null;

  isDigital?: boolean;
  pdfUrl?: string;
  stock?: number | null;

  categories?: string[];
  showInHomepage?: boolean;

  pages?: number;
  publishDate?: Date;
  isbn?: string;
};

type UpdateBookInput = Partial<CreateBookInput>;

type ListBooksInput = {
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
  search?: string;
  categories?: string[];
  language?: 'ar' | 'en';
  isDigital?: boolean;
  inStock?: boolean;
  showInHomepage?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
};

/* ------------ Helpers ------------ */
function parseSort(sortStr?: string): Record<string, SortDir> {
  const out: Record<string, SortDir> = {};
  const s = (sortStr || '').trim();
  if (!s) return { createdAt: -1 };

  for (const part of s.split(',')) {
    const [field, dir] = part.split(':').map((x) => x.trim());
    if (!field) continue;
    out[field] = dir?.toLowerCase() === 'asc' ? 1 : -1;
  }

  return out;
}

async function incBooksCount(catIds: ObjectId[] | undefined, delta: 1 | -1) {
  if (!catIds || !catIds.length) return;
  const Cat = Category as unknown as CategoryModel;
  await Promise.all(catIds.map((id) => Cat.incCount(String(id), 'book', delta)));
}

function buildBooksQuery(input: {
  includeDeleted?: boolean;
  language?: 'ar' | 'en';
  isDigital?: boolean;
  inStock?: boolean;
  showInHomepage?: boolean;
  minPrice?: number;
  maxPrice?: number;
  categories?: string[];
  search?: string;
}) {
  const base: any = {};
  const and: any[] = [];

  if (!input.includeDeleted) base.isDeleted = false;

  if (input.language) base.language = input.language;
  if (typeof input.isDigital === 'boolean') base.isDigital = input.isDigital;
  if (typeof input.showInHomepage === 'boolean') base.showInHomepage = input.showInHomepage;

  if (Array.isArray(input.categories) && input.categories.length) {
    base.categories = { $in: input.categories };
  }

  if (typeof input.minPrice === 'number' || typeof input.maxPrice === 'number') {
    const minH = typeof input.minPrice === 'number' ? toHalalas(input.minPrice) : undefined;
    const maxH = typeof input.maxPrice === 'number' ? toHalalas(input.maxPrice) : undefined;

    const conds: any[] = [];
    const effectiveExpr = { $ifNull: ['$salesPriceHalallas', '$priceHalallas'] };

    if (typeof minH === 'number') conds.push({ $gte: [effectiveExpr, minH] });
    if (typeof maxH === 'number') conds.push({ $lte: [effectiveExpr, maxH] });

    if (conds.length) and.push({ $expr: { $and: conds } });
  }

  if (input.inStock === true) {
    and.push({ $or: [{ isDigital: true }, { isDigital: false, stock: { $gt: 0 } }] });
  }

  if (input.search) {
    const safe = input.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const r = new RegExp(safe, 'i');

    and.push({
      $or: [
        { 'title.ar': r },
        { 'title.en': r },
        { 'author.ar': r },
        { 'author.en': r },
        { 'description.ar': r },
        { 'description.en': r },
        { slug: r },
        { isbn: r },
      ],
    });
  }

  return and.length ? { ...base, $and: and } : base;
}

function bookToPublicDTO(b: any) {
  return {
    id: b.id ?? String(b._id),
    title: b.title,
    slug: b.slug,
    description: b.description,
    author: b.author,
    publisher: b.publisher,
    language: b.language,

    image: b.image,

    price: fromHalalas(b.priceHalallas),
    salesPrice: typeof b.salesPriceHalallas === 'number' ? fromHalalas(b.salesPriceHalallas) : null,

    isDigital: b.isDigital,

    categories: (b.categories || []).map((x: any) => String(x)),

    showInHomepage: !!b.showInHomepage,

    avgRating: b.avgRating,
    ratingsCount: b.ratingsCount,

    pages: b.pages,
    publishDate: b.publishDate,
    isbn: b.isbn,

    isOnSale: b.isOnSale,
    isInStock: b.isInStock,
    effectivePriceSAR: b.effectivePriceSAR,
  };
}

async function getRelatedBooks(opts: { bookId: string; categoryId?: string; limit?: number }) {
  const limit = Math.min(20, Math.max(1, opts.limit ?? 4));
  const excludeIds = [opts.bookId];
  const picked: any[] = [];

  if (opts.categoryId && /^[a-fA-F0-9]{24}$/.test(opts.categoryId)) {
    const sameCat = await Book.find({
      isDeleted: false,
      _id: { $ne: opts.bookId },
      categories: opts.categoryId,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean({ virtuals: true });

    picked.push(...sameCat);
    excludeIds.push(...sameCat.map((b) => String(b._id)));
  }

  if (picked.length < limit) {
    const rest = await Book.find({
      isDeleted: false,
      _id: { $nin: excludeIds },
    })
      .sort({ createdAt: -1 })
      .limit(limit - picked.length)
      .lean({ virtuals: true });

    picked.push(...rest);
  }

  return picked.map(bookToPublicDTO);
}

/* ------------ Core Services ------------ */
export async function createBook(data: CreateBookInput) {
  const desired = slugFromLocalized(data.title);
  const slug = await makeUniqueSlug(Book, desired);

  const priceHalallas = toHalalas(data.price);
  const salesPriceHalallas =
    typeof data.salesPrice === 'number' ? toHalalas(data.salesPrice) : null;

  if (salesPriceHalallas != null && salesPriceHalallas > priceHalallas) {
    throw AppError.badRequest('سعر التخفيض يجب أن يكون أقل من أو يساوي السعر');
  }

  const isDigital = data.isDigital ?? true;
  const pdfUrl = isDigital ? data.pdfUrl : undefined;
  const stock = isDigital ? null : typeof data.stock === 'number' ? data.stock : 0;

  const doc = await Book.create({
    title: data.title,
    description: data.description,
    author: data.author,
    publisher: data.publisher,
    language: data.language ?? 'ar',
    image: data.image,

    priceHalallas,
    salesPriceHalallas,

    isDigital,
    pdfUrl,
    stock,

    categories: data.categories ?? [],
    showInHomepage: data.showInHomepage ?? false,

    pages: data.pages,
    publishDate: data.publishDate,
    isbn: data.isbn,

    slug,
  });

  await incBooksCount(doc.categories as ObjectId[], +1);
  return doc.toJSON();
}

export async function createBookWithUploads(
  data: CreateBookInput,
  files: { cover?: Express.Multer.File; pdf?: Express.Multer.File },
) {
  const desired = slugFromLocalized(data.title);
  const slug = await makeUniqueSlug(Book, desired);

  const priceHalallas = toHalalas(data.price);
  const salesPriceHalallas =
    typeof data.salesPrice === 'number' ? toHalalas(data.salesPrice) : null;

  if (salesPriceHalallas != null && salesPriceHalallas > priceHalallas) {
    throw AppError.badRequest('سعر التخفيض يجب أن يكون أقل من أو يساوي السعر');
  }

  let image: string | undefined;
  let imageRelPath: string | undefined;

  if (files.cover) {
    const saved = await moveDiskFileToUploads(files.cover, 'images/books');
    image = saved.url;
    imageRelPath = saved.relPath;
  } else if (data.image) {
    image = data.image;
  }

  const isDigital = data.isDigital ?? true;
  let pdfUrl: string | undefined;
  let pdfRelPath: string | undefined;

  if (isDigital) {
    if (files.pdf) {
      const saved = await moveDiskFileToUploads(files.pdf, 'files/books');
      pdfUrl = saved.url;
      pdfRelPath = saved.relPath;
    } else if (data.pdfUrl) {
      pdfUrl = data.pdfUrl;
    } else {
      throw AppError.badRequest('ملف PDF أو رابط PDF مطلوب للكتاب الرقمي');
    }
  }

  const stock = isDigital ? null : typeof data.stock === 'number' ? data.stock : 0;

  const doc = await Book.create({
    title: data.title,
    description: data.description,
    author: data.author,
    publisher: data.publisher,
    language: data.language ?? 'ar',

    image,
    imageRelPath,

    priceHalallas,
    salesPriceHalallas,

    isDigital,
    pdfUrl,
    pdfRelPath,
    stock,

    categories: data.categories ?? [],
    showInHomepage: data.showInHomepage ?? false,

    pages: data.pages,
    publishDate: data.publishDate,
    isbn: data.isbn,

    slug,
  });

  await incBooksCount(doc.categories as ObjectId[], +1);
  return doc.toJSON();
}

export async function listBooks(input: ListBooksInput) {
  const page = Math.max(1, input.page || 1);
  const limit = Math.min(100, Math.max(1, input.limit || 10));
  const skip = (page - 1) * limit;

  const q = buildBooksQuery(input);
  const sort = parseSort(input.sort);

  const [items, total] = await Promise.all([
    Book.find(q).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
    Book.countDocuments(q),
  ]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return {
    items: items.map(bookToPublicDTO),
    meta: { total, page, limit, pages, hasNextPage: page < pages, hasPrevPage: page > 1 },
  };
}

export async function listBooksAdmin(input: ListBooksInput) {
  const page = Math.max(1, input.page || 1);
  const limit = Math.min(100, Math.max(1, input.limit || 10));
  const skip = (page - 1) * limit;

  const q = buildBooksQuery({
    ...input,
    includeDeleted: input.includeDeleted ?? false,
  });

  const sort = parseSort(input.sort);

  const [items, total] = await Promise.all([
    Book.find(q).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
    Book.countDocuments(q),
  ]);

  const pages = Math.max(1, Math.ceil(total / limit));

  const adminItems = items.map((b: any) => ({
    ...b,
    price: fromHalalas(b.priceHalallas),
    salesPrice: typeof b.salesPriceHalallas === 'number' ? fromHalalas(b.salesPriceHalallas) : null,
    imageRelPath: b.imageRelPath,
    pdfRelPath: b.pdfRelPath,
  }));

  return {
    items: adminItems,
    meta: { total, page, limit, pages, hasNextPage: page < pages, hasPrevPage: page > 1 },
  };
}

export async function getBook(id: string) {
  const doc = await Book.findById(id).lean({ virtuals: true });
  if (!doc || doc.isDeleted) throw AppError.notFound('الكتاب غير موجود');

  const categoryId =
    Array.isArray(doc.categories) && doc.categories.length ? String(doc.categories[0]) : undefined;

  const relatedBooks = await getRelatedBooks({
    bookId: String(doc._id),
    categoryId,
    limit: 4,
  });

  return { book: bookToPublicDTO(doc), relatedBooks };
}

export async function getBookBySlug(bookSlug: string) {
  const slug = String(bookSlug || '')
    .trim()
    .toLowerCase();
  const doc = await Book.findOne({ slug, isDeleted: false }).lean({ virtuals: true });
  if (!doc) throw AppError.notFound('الكتاب غير موجود');

  const categoryId =
    Array.isArray(doc.categories) && doc.categories.length ? String(doc.categories[0]) : undefined;

  const relatedBooks = await getRelatedBooks({
    bookId: String(doc._id),
    categoryId,
    limit: 4,
  });

  return { book: bookToPublicDTO(doc), relatedBooks };
}

export async function getBookAdmin(id: string) {
  const doc = await Book.findById(id).lean({ virtuals: true });
  if (!doc) throw AppError.notFound('الكتاب غير موجود');

  return {
    ...doc,
    price: fromHalalas((doc as any).priceHalallas),
    salesPrice:
      typeof (doc as any).salesPriceHalallas === 'number'
        ? fromHalalas((doc as any).salesPriceHalallas)
        : null,
    imageRelPath: (doc as any).imageRelPath,
    pdfRelPath: (doc as any).pdfRelPath,
  };
}

export async function updateBook(id: string, data: UpdateBookInput) {
  const doc = await Book.findById(id);
  if (!doc || doc.isDeleted) throw AppError.notFound('الكتاب غير موجود');

  if (data.title) {
    const desired = slugFromLocalized(data.title);
    doc.slug = await makeUniqueSlug(Book, desired, {
      excludeId: String(doc._id),
      filter: { isDeleted: false },
    });
    doc.title = data.title;
  }

  if (typeof data.description !== 'undefined') doc.description = data.description;
  if (typeof data.author !== 'undefined') doc.author = data.author;
  if (typeof data.publisher !== 'undefined') doc.publisher = data.publisher;
  if (typeof data.language !== 'undefined') doc.language = data.language;
  if (typeof data.image !== 'undefined') doc.image = data.image;
  if (typeof data.showInHomepage === 'boolean') doc.showInHomepage = data.showInHomepage;
  if (typeof data.pages === 'number') doc.pages = data.pages;
  if (typeof data.publishDate !== 'undefined') doc.publishDate = data.publishDate;
  if (typeof data.isbn !== 'undefined') doc.isbn = data.isbn;

  if (typeof data.price === 'number') doc.priceHalallas = toHalalas(data.price);
  if (typeof data.salesPrice === 'number') doc.salesPriceHalallas = toHalalas(data.salesPrice);
  else if (data.salesPrice === null) doc.salesPriceHalallas = null;

  if (typeof doc.salesPriceHalallas === 'number' && doc.salesPriceHalallas > doc.priceHalallas) {
    throw AppError.badRequest('سعر التخفيض يجب أن يكون أقل من أو يساوي السعر');
  }

  if (typeof data.isDigital === 'boolean') {
    doc.isDigital = data.isDigital;
  }

  if (doc.isDigital) {
    if (typeof data.pdfUrl === 'string') {
      if (doc.pdfRelPath) {
        await deleteLocalByRelPath(doc.pdfRelPath);
      }
      doc.pdfUrl = data.pdfUrl;
      doc.pdfRelPath = undefined;
    }

    if (!doc.pdfUrl) throw AppError.badRequest('رابط PDF مطلوب للكتاب الرقمي');
    doc.stock = null;
  } else {
    if (typeof data.stock === 'number') doc.stock = data.stock;
    if (typeof doc.stock !== 'number') doc.stock = 0;

    if (doc.pdfRelPath) {
      await deleteLocalByRelPath(doc.pdfRelPath);
    }
    doc.pdfUrl = undefined as any;
    doc.pdfRelPath = undefined;
  }

  if (Array.isArray(data.categories)) {
    const before = (doc.categories || []).map((x) => String(x));
    const after = data.categories;
    const removed = before.filter((item) => !after.includes(item));
    const added = after.filter((item) => !before.includes(item));

    doc.categories = after as any;
    await Promise.all([incBooksCount(added, +1), incBooksCount(removed, -1)]);
  }

  await doc.save();
  return doc.toJSON();
}

export async function updateBookWithUploads(
  id: string,
  data: UpdateBookInput,
  files: { cover?: Express.Multer.File; pdf?: Express.Multer.File },
) {
  const doc = await Book.findById(id);
  if (!doc || doc.isDeleted) throw AppError.notFound('الكتاب غير موجود');

  if (data.title) {
    const desired = slugFromLocalized(data.title);
    doc.slug = await makeUniqueSlug(Book, desired, {
      excludeId: String(doc._id),
      filter: { isDeleted: false },
    });
    doc.title = data.title;
  }

  if (typeof data.description !== 'undefined') doc.description = data.description;
  if (typeof data.author !== 'undefined') doc.author = data.author;
  if (typeof data.publisher !== 'undefined') doc.publisher = data.publisher;
  if (typeof data.language !== 'undefined') doc.language = data.language;
  if (typeof data.showInHomepage === 'boolean') doc.showInHomepage = data.showInHomepage;
  if (typeof data.pages === 'number') doc.pages = data.pages;
  if (typeof data.publishDate !== 'undefined') doc.publishDate = data.publishDate;
  if (typeof data.isbn !== 'undefined') doc.isbn = data.isbn;

  if (typeof data.price === 'number') doc.priceHalallas = toHalalas(data.price);
  if (typeof data.salesPrice === 'number') doc.salesPriceHalallas = toHalalas(data.salesPrice);
  else if (data.salesPrice === null) doc.salesPriceHalallas = null;

  if (typeof doc.salesPriceHalallas === 'number' && doc.salesPriceHalallas > doc.priceHalallas) {
    throw AppError.badRequest('سعر التخفيض يجب أن يكون أقل من أو يساوي السعر');
  }

  if (files.cover) {
    const saved = await moveDiskFileToUploads(files.cover, 'images/books');
    if (doc.imageRelPath) {
      await deleteLocalByRelPath(doc.imageRelPath);
    }
    doc.image = saved.url;
    doc.imageRelPath = saved.relPath;
  } else if (typeof data.image === 'string') {
    doc.image = data.image;
  }

  if (typeof data.isDigital === 'boolean') {
    doc.isDigital = data.isDigital;
  }

  if (doc.isDigital) {
    if (files.pdf) {
      const saved = await moveDiskFileToUploads(files.pdf, 'files/books');
      if (doc.pdfRelPath) {
        await deleteLocalByRelPath(doc.pdfRelPath);
      }
      doc.pdfUrl = saved.url;
      doc.pdfRelPath = saved.relPath;
    } else if (typeof data.pdfUrl === 'string') {
      if (doc.pdfRelPath) {
        await deleteLocalByRelPath(doc.pdfRelPath);
      }
      doc.pdfUrl = data.pdfUrl;
      doc.pdfRelPath = undefined;
    }

    if (!doc.pdfUrl) throw AppError.badRequest('ملف PDF أو رابط PDF مطلوب للكتاب الرقمي');
    doc.stock = null;
  } else {
    if (typeof data.stock === 'number') doc.stock = data.stock;
    if (typeof doc.stock !== 'number') doc.stock = 0;

    if (doc.pdfRelPath) {
      await deleteLocalByRelPath(doc.pdfRelPath);
    }
    doc.pdfUrl = undefined as any;
    doc.pdfRelPath = undefined;
  }

  if (Array.isArray(data.categories)) {
    const before = (doc.categories || []).map((x) => String(x));
    const after = data.categories;
    const removed = before.filter((item) => !after.includes(item));
    const added = after.filter((item) => !before.includes(item));

    doc.categories = after as any;
    await Promise.all([incBooksCount(added, +1), incBooksCount(removed, -1)]);
  }

  await doc.save();
  return doc.toJSON();
}

export async function softDeleteBook(id: string) {
  const doc = await Book.findById(id);
  if (!doc || doc.isDeleted) throw AppError.notFound('الكتاب غير موجود أو محذوف');

  doc.isDeleted = true;
  await doc.save();

  await incBooksCount(doc.categories as ObjectId[], -1);
}

export async function restoreBook(id: string) {
  const doc = await Book.findById(id);
  if (!doc) throw AppError.notFound('الكتاب غير موجود');
  if (!doc.isDeleted) return;

  const desired = doc.slug || slugFromLocalized(doc.title);
  doc.slug = await makeUniqueSlug(Book, desired, {
    excludeId: String(doc._id),
    filter: { isDeleted: false },
  });

  doc.isDeleted = false;
  await doc.save();

  await incBooksCount(doc.categories as ObjectId[], +1);
}

export async function getHomepageBooks(input: {
  limit?: number;
  language?: 'ar' | 'en';
  isDigital?: boolean;
  inStock?: boolean;
}) {
  const limit = Math.min(50, Math.max(1, input.limit ?? 4));

  const q: any = { isDeleted: false, showInHomepage: true };
  if (input.language) q.language = input.language;
  if (typeof input.isDigital === 'boolean') q.isDigital = input.isDigital;

  if (input.inStock === true) {
    q.$or = [{ isDigital: true }, { isDigital: false, stock: { $gt: 0 } }];
  }

  const items = await Book.find(q).sort({ createdAt: -1 }).limit(limit).lean({ virtuals: true });
  return items.map(bookToPublicDTO);
}

export async function getBooksWithCategories(input: ListBooksInput) {
  const page = Math.max(1, input.page || 1);
  const limit = Math.min(100, Math.max(1, input.limit || 10));
  const skip = (page - 1) * limit;

  const q = buildBooksQuery(input);
  const sort = parseSort(input.sort);

  const qAllBooksForCats = buildBooksQuery({ ...input, categories: undefined });

  const [items, total, categories] = await Promise.all([
    Book.find(q).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
    Book.countDocuments(q),

    Book.aggregate([
      { $match: qAllBooksForCats },
      { $unwind: '$categories' },
      { $group: { _id: '$categories', booksCount: { $sum: 1 } } },
      {
        $lookup: {
          from: Category.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'cat',
        },
      },
      { $unwind: '$cat' },
      {
        $match: {
          'cat.isDeleted': false,
          'cat.scopes': { $in: ['book'] },
        },
      },
      { $sort: { 'cat.order': 1, 'cat.createdAt': -1 } },
      {
        $project: {
          _id: 0,
          id: { $toString: '$cat._id' },
          title: '$cat.title',
          slug: '$cat.slug',
          description: '$cat.description',
          image: '$cat.image',
          scopes: '$cat.scopes',
          order: '$cat.order',
          createdAt: '$cat.createdAt',
          updatedAt: '$cat.updatedAt',
          booksCount: '$booksCount',
        },
      },
    ]),
  ]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return {
    books: items.map(bookToPublicDTO),
    categories,
    meta: { total, page, limit, pages, hasNextPage: page < pages, hasPrevPage: page > 1 },
  };
}
// // src/services/bookService.ts
// import type { Types } from 'mongoose';
// import type { Express } from 'express';
// import Book from '../models/Book';
// import Category, { CategoryModel } from '../models/Category';
// import { AppError } from '../utils/AppError';
// import { toHalalas, fromHalalas } from '../utils/money';
// import { slugFromLocalized, makeUniqueSlug } from '../utils/slug';
// import { moveDiskFileToUploads, deleteLocalByRelPath } from './localFiles.disk';

// type ObjectId = Types.ObjectId | string;
// type SortDir = 1 | -1;

// type CreateBookInput = {
//   title: { ar?: string; en?: string };
//   description?: { ar?: string; en?: string };
//   author: { ar?: string; en?: string };
//   publisher?: { ar?: string; en?: string };
//   language?: 'ar' | 'en';
//   image?: string;

//   price: number;
//   salesPrice?: number;

//   isDigital?: boolean;
//   pdfUrl?: string;
//   stock?: number;

//   categories?: string[];
//   showInHomepage?: boolean;

//   pages?: number;
//   publishDate?: Date;
//   isbn?: string;
// };

// type UpdateBookInput = Partial<CreateBookInput>;

// type ListBooksInput = {
//   page?: number;
//   limit?: number;
//   includeDeleted?: boolean;
//   search?: string;
//   category?: string;
//   language?: 'ar' | 'en';
//   isDigital?: boolean;
//   inStock?: boolean;
//   showInHomepage?: boolean;
//   minPrice?: number;
//   maxPrice?: number;
//   sort?: string;
// };

// /* ------------ Helpers ------------ */
// function parseSort(sortStr?: string): Record<string, SortDir> {
//   const out: Record<string, SortDir> = {};
//   const s = (sortStr || '').trim();
//   if (!s) return { createdAt: -1 };
//   for (const part of s.split(',')) {
//     const [field, dir] = part.split(':').map((x) => x.trim());
//     if (!field) continue;
//     out[field] = dir?.toLowerCase() === 'asc' ? 1 : -1;
//   }
//   return out;
// }

// function parseCategoriesCSV(csv?: string): string[] | undefined {
//   if (!csv) return undefined;
//   return csv
//     .split(',')
//     .map((x) => x.trim())
//     .filter((x) => /^[a-fA-F0-9]{24}$/.test(x));
// }

// async function incBooksCount(catIds: ObjectId[] | undefined, delta: 1 | -1) {
//   if (!catIds || !catIds.length) return;
//   const Cat = Category as unknown as CategoryModel;
//   await Promise.all(catIds.map((id) => Cat.incCount(String(id), 'book', delta)));
// }

// function buildBooksQuery(input: {
//   includeDeleted?: boolean;
//   language?: 'ar' | 'en';
//   isDigital?: boolean;
//   inStock?: boolean;
//   showInHomepage?: boolean;
//   minPrice?: number;
//   maxPrice?: number;
//   category?: string;
//   search?: string;
// }) {
//   const base: any = {};
//   const and: any[] = [];

//   if (!input.includeDeleted) base.isDeleted = false;

//   if (input.language) base.language = input.language;
//   if (typeof input.isDigital === 'boolean') base.isDigital = input.isDigital;
//   if (typeof input.showInHomepage === 'boolean') base.showInHomepage = input.showInHomepage;

//   if (input.category && /^[a-fA-F0-9]{24}$/.test(input.category)) {
//     base.categories = input.category;
//   }

//   // ✅ فلترة السعر على السعر الفعّال: salesPriceHalallas إن وُجد، وإلا priceHalallas
//   if (typeof input.minPrice === 'number' || typeof input.maxPrice === 'number') {
//     const minH = typeof input.minPrice === 'number' ? toHalalas(input.minPrice) : undefined;
//     const maxH = typeof input.maxPrice === 'number' ? toHalalas(input.maxPrice) : undefined;

//     const conds: any[] = [];

//     const effectiveExpr = { $ifNull: ['$salesPriceHalallas', '$priceHalallas'] };

//     if (typeof minH === 'number') conds.push({ $gte: [effectiveExpr, minH] });
//     if (typeof maxH === 'number') conds.push({ $lte: [effectiveExpr, maxH] });

//     if (conds.length) and.push({ $expr: { $and: conds } });
//   }

//   // const categoryId = parseCategoriesCSV(input.category);
//   // if (categoryIds?.length) base.categories = { $in: categoryIds };

//   if (input.inStock === true) {
//     and.push({ $or: [{ isDigital: true }, { isDigital: false, stock: { $gt: 0 } }] });
//   }

//   if (input.search) {
//     const safe = input.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//     const r = new RegExp(safe, 'i');
//     and.push({
//       $or: [
//         { 'title.ar': r },
//         { 'title.en': r },
//         { 'author.ar': r },
//         { 'author.en': r },
//         { 'description.ar': r },
//         { 'description.en': r },
//         { slug: r },
//         { isbn: r },
//       ],
//     });
//   }

//   return and.length ? { ...base, $and: and } : base;
// }

// function bookToPublicDTO(b: any) {
//   return {
//     id: b.id ?? String(b._id),
//     title: b.title,
//     slug: b.slug,
//     description: b.description,
//     author: b.author,
//     publisher: b.publisher,
//     language: b.language,

//     image: b.image,

//     // ✅ أسعار فقط بالريال
//     price: fromHalalas(b.priceHalallas),
//     salesPrice: typeof b.salesPriceHalallas === 'number' ? fromHalalas(b.salesPriceHalallas) : null,

//     isDigital: b.isDigital,

//     // ❌ لا ترجع pdfUrl للـ public (مهم جدًا)
//     // pdfUrl: b.pdfUrl,

//     categories: (b.categories || []).map((x: any) => String(x)),

//     showInHomepage: !!b.showInHomepage,

//     avgRating: b.avgRating,
//     ratingsCount: b.ratingsCount,

//     pages: b.pages,
//     publishDate: b.publishDate,
//     isbn: b.isbn,

//     // ✅ public helpful virtuals (لو موجودة من lean({virtuals:true}))
//     isOnSale: b.isOnSale,
//     isInStock: b.isInStock,
//     effectivePriceSAR: b.effectivePriceSAR,
//   };
// }

// async function getRelatedBooks(opts: { bookId: string; categoryId?: string; limit?: number }) {
//   const limit = Math.min(20, Math.max(1, opts.limit ?? 4));
//   const excludeIds = [opts.bookId];

//   const picked: any[] = [];

//   // 1) نفس التصنيف (لو موجود)
//   if (opts.categoryId && /^[a-fA-F0-9]{24}$/.test(opts.categoryId)) {
//     const sameCat = await Book.find({
//       isDeleted: false,
//       _id: { $ne: opts.bookId },
//       categories: opts.categoryId, // array contains
//     })
//       .sort({ createdAt: -1 })
//       .limit(limit)
//       .lean({ virtuals: true });

//     picked.push(...sameCat);
//     excludeIds.push(...sameCat.map((b) => String(b._id)));
//   }

//   // 2) تكملة بكتب عامة
//   if (picked.length < limit) {
//     const rest = await Book.find({
//       isDeleted: false,
//       _id: { $nin: excludeIds },
//     })
//       .sort({ createdAt: -1 })
//       .limit(limit - picked.length)
//       .lean({ virtuals: true });

//     picked.push(...rest);
//   }

//   return picked.map(bookToPublicDTO);
// }

// /* ------------ Core Services (روابط فقط) ------------ */
// export async function createBook(data: CreateBookInput) {
//   const desired = slugFromLocalized(data.title);
//   const slug = await makeUniqueSlug(Book, desired);

//   const priceHalallas = toHalalas(data.price);
//   const salesPriceHalallas =
//     typeof data.salesPrice === 'number' ? toHalalas(data.salesPrice) : null;

//   if (salesPriceHalallas != null && salesPriceHalallas > priceHalallas) {
//     throw AppError.badRequest('سعر التخفيض يجب أن يكون أقل من أو يساوي السعر');
//   }

//   const isDigital = data.isDigital ?? true;
//   const pdfUrl = isDigital ? data.pdfUrl : undefined;
//   const stock = isDigital ? null : typeof data.stock === 'number' ? data.stock : 0;

//   const doc = await Book.create({
//     title: data.title,
//     description: data.description,
//     author: data.author,
//     publisher: data.publisher,
//     language: data.language ?? 'ar',
//     image: data.image,

//     priceHalallas,
//     salesPriceHalallas,

//     isDigital,
//     pdfUrl,
//     stock,

//     categories: data.categories ?? [],
//     showInHomepage: data.showInHomepage ?? false,

//     pages: data.pages,
//     publishDate: data.publishDate,
//     isbn: data.isbn,

//     slug,
//   });

//   await incBooksCount(doc.categories as ObjectId[], +1);
//   return doc.toJSON();
// }

// /** إنشاء كتاب (بدعم ملفات Multer: pdf, cover) */
// export async function createBookWithUploads(
//   data: CreateBookInput,
//   files: { cover?: Express.Multer.File; pdf?: Express.Multer.File },
// ) {
//   const desired = slugFromLocalized(data.title);
//   const slug = await makeUniqueSlug(Book, desired);

//   const priceHalallas = toHalalas(data.price);
//   const salesPriceHalallas =
//     typeof data.salesPrice === 'number' ? toHalalas(data.salesPrice) : null;
//   if (salesPriceHalallas != null && salesPriceHalallas > priceHalallas) {
//     throw AppError.badRequest('سعر التخفيض يجب أن يكون أقل من أو يساوي السعر');
//   }

//   // cover (اختياري)
//   let image: string | undefined;
//   let imageRelPath: string | undefined;
//   if (files.cover) {
//     const saved = await moveDiskFileToUploads(files.cover, 'images/books');
//     image = saved.url;
//     imageRelPath = saved.relPath;
//   } else if (data.image) {
//     image = data.image; // URL خارجي لو تحب
//   }

//   // pdf (للرقمي)
//   const isDigital = data.isDigital ?? true;
//   let pdfUrl: string | undefined;
//   let pdfRelPath: string | undefined;
//   if (isDigital) {
//     if (files.pdf) {
//       const saved = await moveDiskFileToUploads(files.pdf, 'files/books');
//       pdfUrl = saved.url;
//       pdfRelPath = saved.relPath;
//     } else if (data.pdfUrl) {
//       pdfUrl = data.pdfUrl; // URL خارجي
//     } else {
//       throw AppError.badRequest('ملف PDF أو رابط PDF مطلوب للكتاب الرقمي');
//     }
//   } else {
//     pdfUrl = undefined;
//     pdfRelPath = undefined;
//   }

//   const stock = isDigital ? null : typeof data.stock === 'number' ? data.stock : 0;

//   const doc = await Book.create({
//     title: data.title,
//     description: data.description,
//     author: data.author,
//     publisher: data.publisher,
//     language: data.language ?? 'ar',

//     image,
//     imageRelPath,

//     priceHalallas,
//     salesPriceHalallas,

//     isDigital,
//     pdfUrl,
//     pdfRelPath,
//     stock,

//     categories: data.categories ?? [],
//     showInHomepage: data.showInHomepage ?? false,

//     pages: data.pages,
//     publishDate: data.publishDate,
//     isbn: data.isbn,

//     slug,
//   });

//   await incBooksCount(doc.categories as ObjectId[], +1);
//   return doc.toJSON();
// }

// /** قائمة الكتب */
// export async function listBooks(input: ListBooksInput) {
//   const page = Math.max(1, input.page || 1);
//   const limit = Math.min(100, Math.max(1, input.limit || 10));
//   const skip = (page - 1) * limit;

//   const q = buildBooksQuery(input);
//   const sort = parseSort(input.sort);

//   const [items, total] = await Promise.all([
//     Book.find(q).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
//     Book.countDocuments(q),
//   ]);

//   const pages = Math.max(1, Math.ceil(total / limit));
//   return {
//     items: items.map(bookToPublicDTO),
//     meta: { total, page, limit, pages, hasNextPage: page < pages, hasPrevPage: page > 1 },
//   };
// }

// /** قائمة الكتب (الأدمن) */
// export async function listBooksAdmin(input: ListBooksInput) {
//   const page = Math.max(1, input.page || 1);
//   const limit = Math.min(100, Math.max(1, input.limit || 10));
//   const skip = (page - 1) * limit;

//   // ✅ للأدمن: لو includeDeleted=true -> يرجّع المحذوف كمان
//   const q = buildBooksQuery({ ...input, includeDeleted: !!input.includeDeleted });
//   const sort = parseSort(input.sort);

//   const [items, total] = await Promise.all([
//     Book.find(q).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
//     Book.countDocuments(q),
//   ]);

//   const pages = Math.max(1, Math.ceil(total / limit));

//   const adminItems = items.map((b: any) => ({
//     ...b,

//     // ✅ SAR friendly
//     price: fromHalalas(b.priceHalallas),
//     salesPrice: typeof b.salesPriceHalallas === 'number' ? fromHalalas(b.salesPriceHalallas) : null,

//     // ✅ relPaths للأدمن فقط
//     imageRelPath: b.imageRelPath,
//     pdfRelPath: b.pdfRelPath,
//   }));

//   return {
//     items: adminItems,
//     meta: { total, page, limit, pages, hasNextPage: page < pages, hasPrevPage: page > 1 },
//   };
// }

// /** جلب كتاب */
// // by ID
// export async function getBook(id: string) {
//   const doc = await Book.findById(id).lean({ virtuals: true });
//   if (!doc || doc.isDeleted) throw AppError.notFound('الكتاب غير موجود');

//   const categoryId =
//     Array.isArray(doc.categories) && doc.categories.length ? String(doc.categories[0]) : undefined;

//   const relatedBooks = await getRelatedBooks({
//     bookId: String(doc._id),
//     categoryId,
//     limit: 4,
//   });

//   // return doc;
//   return { book: bookToPublicDTO(doc), relatedBooks };
// }

// // by SLUG
// export async function getBookBySlug(bookSlug: string) {
//   const slug = String(bookSlug || '')
//     .trim()
//     .toLowerCase();
//   const doc = await Book.findOne({ slug: slug, isDeleted: false }).lean({ virtuals: true });
//   if (!doc) throw AppError.notFound('الكتاب غير موجود');

//   const categoryId =
//     Array.isArray(doc.categories) && doc.categories.length ? String(doc.categories[0]) : undefined;

//   const relatedBooks = await getRelatedBooks({
//     bookId: String(doc._id),
//     categoryId,
//     limit: 4,
//   });

//   // return doc;
//   return { book: bookToPublicDTO(doc), relatedBooks };
// }

// /** جلب كتاب (الأدمن) */
// export async function getBookAdmin(id: string) {
//   const doc = await Book.findById(id).lean({ virtuals: true });
//   if (!doc) throw AppError.notFound('الكتاب غير موجود');

//   // Admin DTO: رجّع relPaths كمان
//   return {
//     ...doc,

//     // أسعار SAR (زي public)
//     price: fromHalalas((doc as any).priceHalallas),
//     salesPrice:
//       typeof (doc as any).salesPriceHalallas === 'number'
//         ? fromHalalas((doc as any).salesPriceHalallas)
//         : null,

//     // ✅ relPaths للأدمن فقط (حتى لو schema.toJSON بيشيلها)
//     imageRelPath: (doc as any).imageRelPath,
//     pdfRelPath: (doc as any).pdfRelPath,
//   };
// }

// /** تحديث كتاب (روابط فقط) */
// export async function updateBook(id: string, data: UpdateBookInput) {
//   const doc = await Book.findById(id);
//   if (!doc || doc.isDeleted) throw AppError.notFound('الكتاب غير موجود');

//   if (data.title) {
//     const desired = slugFromLocalized(data.title);
//     doc.slug = await makeUniqueSlug(Book, desired, {
//       excludeId: String(doc._id),
//       filter: { isDeleted: false },
//     });
//     doc.title = data.title;
//   }

//   if (typeof data.description !== 'undefined') doc.description = data.description;
//   if (typeof data.author !== 'undefined') doc.author = data.author;
//   if (typeof data.publisher !== 'undefined') doc.publisher = data.publisher;
//   if (typeof data.language !== 'undefined') doc.language = data.language;
//   if (typeof data.image !== 'undefined') doc.image = data.image;
//   if (typeof data.showInHomepage === 'boolean') doc.showInHomepage = data.showInHomepage;
//   if (typeof data.pages === 'number') doc.pages = data.pages;
//   if (typeof data.publishDate !== 'undefined') doc.publishDate = data.publishDate;
//   if (typeof data.isbn !== 'undefined') doc.isbn = data.isbn;

//   if (typeof data.price === 'number') doc.priceHalallas = toHalalas(data.price);
//   if (typeof data.salesPrice === 'number') doc.salesPriceHalallas = toHalalas(data.salesPrice);
//   else if (data.salesPrice === null) doc.salesPriceHalallas = null;
//   if (typeof doc.salesPriceHalallas === 'number' && doc.salesPriceHalallas > doc.priceHalallas) {
//     throw AppError.badRequest('سعر التخفيض يجب أن يكون أقل من أو يساوي السعر');
//   }

//   if (typeof data.isDigital === 'boolean') {
//     doc.isDigital = data.isDigital;
//   }

//   if (doc.isDigital) {
//     if (typeof data.pdfUrl === 'string') {
//       if (doc.pdfRelPath) {
//         await deleteLocalByRelPath(doc.pdfRelPath);
//       }
//       doc.pdfUrl = data.pdfUrl;
//       doc.pdfRelPath = undefined;
//     }
//     if (!doc.pdfUrl) throw AppError.badRequest('رابط PDF مطلوب للكتاب الرقمي');
//     doc.stock = null;
//   } else {
//     if (typeof data.stock === 'number') doc.stock = data.stock;
//     if (typeof doc.stock !== 'number') doc.stock = 0;
//     // اختياري: تنظيف pdf عند التحويل لورقي (لو حابب)
//   }

//   if (Array.isArray(data.categories)) {
//     const before = (doc.categories || []).map((x) => String(x));
//     const after = data.categories;
//     const removed = before.filter((id) => !after.includes(id));
//     const added = after.filter((id) => !before.includes(id));
//     doc.categories = after as any;
//     await Promise.all([incBooksCount(added, +1), incBooksCount(removed, -1)]);
//   }

//   await doc.save();
//   return doc.toJSON();
// }

// /** تحديث كتاب (بدعم ملفات) */
// export async function updateBookWithUploads(
//   id: string,
//   data: UpdateBookInput,
//   files: { cover?: Express.Multer.File; pdf?: Express.Multer.File },
// ) {
//   const doc = await Book.findById(id);
//   if (!doc || doc.isDeleted) throw AppError.notFound('الكتاب غير موجود');

//   if (data.title) {
//     const desired = slugFromLocalized(data.title);
//     doc.slug = await makeUniqueSlug(Book, desired, {
//       excludeId: String(doc._id),
//       filter: { isDeleted: false },
//     });
//     doc.title = data.title;
//   }

//   if (typeof data.description !== 'undefined') doc.description = data.description;
//   if (typeof data.author !== 'undefined') doc.author = data.author;
//   if (typeof data.publisher !== 'undefined') doc.publisher = data.publisher;
//   if (typeof data.language !== 'undefined') doc.language = data.language;
//   if (typeof data.showInHomepage === 'boolean') doc.showInHomepage = data.showInHomepage;
//   if (typeof data.pages === 'number') doc.pages = data.pages;
//   if (typeof data.publishDate !== 'undefined') doc.publishDate = data.publishDate;
//   if (typeof data.isbn !== 'undefined') doc.isbn = data.isbn;

//   // الأسعار
//   if (typeof data.price === 'number') doc.priceHalallas = toHalalas(data.price);
//   if (typeof data.salesPrice === 'number') doc.salesPriceHalallas = toHalalas(data.salesPrice);
//   else if (data.salesPrice === null) doc.salesPriceHalallas = null;
//   if (typeof doc.salesPriceHalallas === 'number' && doc.salesPriceHalallas > doc.priceHalallas) {
//     throw AppError.badRequest('سعر التخفيض يجب أن يكون أقل من أو يساوي السعر');
//   }

//   // الغلاف
//   if (files.cover) {
//     const saved = await moveDiskFileToUploads(files.cover, 'images/books');
//     if (doc.imageRelPath) {
//       await deleteLocalByRelPath(doc.imageRelPath);
//     }
//     doc.image = saved.url;
//     doc.imageRelPath = saved.relPath;
//   } else if (typeof data.image === 'string') {
//     doc.image = data.image; // URL خارجي
//     // اختياري: doc.imageRelPath = undefined;
//   }

//   // طبيعة الكتاب
//   if (typeof data.isDigital === 'boolean') {
//     doc.isDigital = data.isDigital;
//   }

//   if (doc.isDigital) {
//     if (files.pdf) {
//       const saved = await moveDiskFileToUploads(files.pdf, 'files/books');
//       if (doc.pdfRelPath) {
//         await deleteLocalByRelPath(doc.pdfRelPath);
//       }
//       doc.pdfUrl = saved.url;
//       doc.pdfRelPath = saved.relPath;
//     } else if (typeof data.pdfUrl === 'string') {
//       if (doc.pdfRelPath) {
//         await deleteLocalByRelPath(doc.pdfRelPath);
//       }
//       doc.pdfUrl = data.pdfUrl;
//       doc.pdfRelPath = undefined;
//     }
//     if (!doc.pdfUrl) throw AppError.badRequest('ملف PDF أو رابط PDF مطلوب للكتاب الرقمي');
//     doc.stock = null;
//   } else {
//     if (typeof data.stock === 'number') doc.stock = data.stock;
//     if (typeof doc.stock !== 'number') doc.stock = 0;

//     // تنظيف PDF لو تحوّل لورقي
//     if (files.pdf || typeof data.pdfUrl === 'string') {
//       if (doc.pdfRelPath) {
//         await deleteLocalByRelPath(doc.pdfRelPath);
//       }
//       doc.pdfUrl = undefined as any;
//       doc.pdfRelPath = undefined;
//     }
//   }

//   // التصنيفات
//   if (Array.isArray(data.categories)) {
//     const before = (doc.categories || []).map((x) => String(x));
//     const after = data.categories;
//     const removed = before.filter((id) => !after.includes(id));
//     const added = after.filter((id) => !before.includes(id));
//     doc.categories = after as any;
//     await Promise.all([incBooksCount(added, +1), incBooksCount(removed, -1)]);
//   }

//   await doc.save();
//   return doc.toJSON();
// }

// /** حذف منطقي */
// export async function softDeleteBook(id: string) {
//   const doc = await Book.findById(id);
//   if (!doc || doc.isDeleted) throw AppError.notFound('الكتاب غير موجود أو محذوف');

//   doc.isDeleted = true;
//   await doc.save();

//   await incBooksCount(doc.categories as ObjectId[], -1);
// }

// /** استرجاع كتاب */
// export async function restoreBook(id: string) {
//   const doc = await Book.findById(id);
//   if (!doc) throw AppError.notFound('الكتاب غير موجود');
//   if (!doc.isDeleted) return;

//   const desired = doc.slug || slugFromLocalized(doc.title);
//   doc.slug = await makeUniqueSlug(Book, desired, {
//     excludeId: String(doc._id),
//     filter: { isDeleted: false },
//   });
//   doc.isDeleted = false;
//   await doc.save();

//   await incBooksCount(doc.categories as ObjectId[], +1);
// }

// /** كتب الصفحة الرئيسية */
// export async function getHomepageBooks(input: {
//   limit?: number;
//   language?: 'ar' | 'en';
//   isDigital?: boolean;
//   inStock?: boolean;
// }) {
//   const limit = Math.min(50, Math.max(1, input.limit ?? 4));

//   const q: any = { isDeleted: false, showInHomepage: true };
//   if (input.language) q.language = input.language;
//   if (typeof input.isDigital === 'boolean') q.isDigital = input.isDigital;
//   if (typeof input.isDigital === 'string') q.isDigital = input.isDigital === 'true' ? true : false;
//   if (input.inStock === true) {
//     q.$or = [{ isDigital: true }, { isDigital: false, stock: { $gt: 0 } }];
//     // هنا مش محتاج AND لأنّك أصلاً مثبت showInHomepage=true
//   }

//   const items = await Book.find(q).sort({ createdAt: -1 }).limit(limit).lean({ virtuals: true });
//   return items.map(bookToPublicDTO);
// }

// /** الكتب + التصنيفات غير الفارغة */
// export async function getBooksWithCategories(input: ListBooksInput & { category?: string }) {
//   const page = Math.max(1, input.page || 1);
//   const limit = Math.min(100, Math.max(1, input.limit || 10));
//   const skip = (page - 1) * limit;

//   // ✅ query للكتب (قد يحتوي category)
//   const q = buildBooksQuery(input);
//   const sort = parseSort(input.sort);

//   // ✅ query للتصنيفات "العامة" بدون category
//   const qAllBooksForCats = buildBooksQuery({ ...input, category: undefined });

//   // 1) books + total (زي ما عندك)
//   const [items, total, categories] = await Promise.all([
//     Book.find(q).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
//     Book.countDocuments(q),

//     // ✅ Categories that have books (general)
//     Book.aggregate([
//       { $match: qAllBooksForCats },
//       { $unwind: '$categories' },
//       { $group: { _id: '$categories', booksCount: { $sum: 1 } } },
//       {
//         $lookup: {
//           from: Category.collection.name,
//           localField: '_id',
//           foreignField: '_id',
//           as: 'cat',
//         },
//       },
//       { $unwind: '$cat' },
//       {
//         $match: {
//           'cat.isDeleted': false,
//           'cat.scopes': { $in: ['book'] },
//         },
//       },
//       { $sort: { 'cat.order': 1, 'cat.createdAt': -1 } },

//       {
//         $project: {
//           _id: 0,
//           id: { $toString: '$cat._id' },
//           title: '$cat.title',
//           slug: '$cat.slug',
//           description: '$cat.description',
//           image: '$cat.image',
//           scopes: '$cat.scopes',
//           order: '$cat.order',
//           createdAt: '$cat.createdAt',
//           updatedAt: '$cat.updatedAt',
//           booksCount: '$booksCount', // count عام حسب فلاتر العامة
//         },
//       },
//     ]),
//   ]);

//   const pages = Math.max(1, Math.ceil(total / limit));

//   return {
//     books: items.map(bookToPublicDTO),
//     categories,
//     meta: { total, page, limit, pages, hasNextPage: page < pages, hasPrevPage: page > 1 },
//   };
// }
