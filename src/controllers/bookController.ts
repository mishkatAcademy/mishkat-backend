// src/contollers/bookController.ts
import type { Request, Response, Express } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok, created } from '../utils/response';
import { AppError } from '../utils/AppError';

import {
  createBook,
  listBooks,
  listBooksAdmin,
  getBook,
  getBookBySlug,
  getBookAdmin,
  updateBook,
  softDeleteBook,
  restoreBook,
  getHomepageBooks,
  getBooksWithCategories,
  createBookWithUploads,
  updateBookWithUploads,
} from '../services/bookService';

function parseJSONField<T>(raw: any, fieldName: string): T | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string') return undefined;

  const s = raw.trim();
  if (!s) return undefined;

  try {
    return JSON.parse(s) as T;
  } catch {
    throw AppError.badRequest(`حقل ${fieldName} يجب أن يكون JSON صالح`);
  }
}

function parseBool(raw: any): boolean | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
}

function parseNumber(raw: any): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

// ✅ Create (JSON)
export const createBookCtrl = catchAsync(async (req: Request, res: Response) => {
  const book = await createBook(req.validated?.body as any);
  return created(res, { book });
});

// ✅ Create (multipart: cover/pdf)
// export const createBookUploadCtrl = catchAsync(async (req: Request, res: Response) => {
//   const body = (req.body ?? {}) as any;
//   const filesMap = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
//   const files = {
//     cover: filesMap.cover?.[0],
//     pdf: filesMap.pdf?.[0],
//   };
//   const book = await createBookWithUploads(body, files);
//   return created(res, { book });
// });

export const createBookUploadCtrl = catchAsync(async (req: Request, res: Response) => {
  const raw = (req.body ?? {}) as any;

  // ✅ parse JSON fields
  const title = parseJSONField<{ ar?: string; en?: string }>(raw.title, 'title');
  const description = parseJSONField<{ ar?: string; en?: string }>(raw.description, 'description');
  const author = parseJSONField<{ ar?: string; en?: string }>(raw.author, 'author');
  const publisher = parseJSONField<{ ar?: string; en?: string }>(raw.publisher, 'publisher');

  // ✅ categories as JSON array
  const categories = parseJSONField<string[]>(raw.categories, 'categories');

  // ✅ coerce primitives (form-data => string)
  const body = {
    ...raw,
    title,
    description,
    author,
    publisher,
    categories,

    language: raw.language,
    price: parseNumber(raw.price),
    salesPrice: raw.salesPrice === '' ? undefined : parseNumber(raw.salesPrice),
    isDigital: parseBool(raw.isDigital),
    showInHomepage: parseBool(raw.showInHomepage),

    pages: parseNumber(raw.pages),
    stock: raw.stock === '' ? undefined : parseNumber(raw.stock),

    publishDate: raw.publishDate ? new Date(raw.publishDate) : undefined,

    isbn: raw.isbn,
    pdfUrl: raw.pdfUrl,
    image: raw.image,
  };

  // ✅ basic required guards
  if (!body.title) throw AppError.badRequest('title مطلوب');
  if (!body.author) throw AppError.badRequest('author مطلوب');
  if (typeof body.price !== 'number') throw AppError.badRequest('price مطلوب ويجب أن يكون رقمًا');

  const filesMap = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  const files = { cover: filesMap.cover?.[0], pdf: filesMap.pdf?.[0] };

  const book = await createBookWithUploads(body as any, files);
  return created(res, { book });
});

// 📚 List
export const listBooksCtrl = catchAsync(async (req: Request, res: Response) => {
  const result = await listBooks(req.validated?.query as any);
  return ok(res, { items: result.items }, result.meta);
});

// 📚 List (Admin)
export const listBooksAdminCtrl = catchAsync(async (req: Request, res: Response) => {
  const result = await listBooksAdmin(req.validated?.query as any);
  return ok(res, { items: result.items }, result.meta);
});

// 📄 Get by ID
export const getBookCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  const result = await getBook(String(id));
  return ok(res, result);
});

// 📄 Get by SLUG
export const getBookBySlugCtrl = catchAsync(async (req: Request, res: Response) => {
  const { slug } = (req.validated?.params as { slug: string }) ?? req.params;
  const result = await getBookBySlug(String(slug));
  return ok(res, result);
});

// 📄 Get by ID (Admin)
export const getBookAdminCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  const book = await getBookAdmin(String(id));
  return ok(res, { book });
});

// ✏️ Update (JSON)
export const updateBookCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  const updates = (req.validated?.body as any) ?? req.body;
  const book = await updateBook(String(id), updates);
  return ok(res, { book });
});

// ✏️ Update (multipart: cover/pdf)
// export const updateBookUploadCtrl = catchAsync(async (req: Request, res: Response) => {
//   const { id } = (req.validated?.params as { id: string }) ?? req.params;
//   const body = (req.body ?? {}) as any;
//   const filesMap = (req.files ?? {}) as Record<string, Express.Multer.File[]>;

//   const files = {
//     cover: filesMap.cover?.[0],
//     pdf: filesMap.pdf?.[0],
//   };

//   const book = await updateBookWithUploads(String(id), body, files);
//   return ok(res, { book });
// });
export const updateBookUploadCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  const raw = (req.body ?? {}) as any;

  // ✅ parse JSON fields (كلهم اختياري في update)
  const body = {
    ...raw,
    title: parseJSONField<{ ar?: string; en?: string }>(raw.title, 'title'),
    description: parseJSONField<{ ar?: string; en?: string }>(raw.description, 'description'),
    author: parseJSONField<{ ar?: string; en?: string }>(raw.author, 'author'),
    publisher: parseJSONField<{ ar?: string; en?: string }>(raw.publisher, 'publisher'),
    categories: parseJSONField<string[]>(raw.categories, 'categories'),

    // ✅ coerce primitives
    price: parseNumber(raw.price),
    salesPrice:
      raw.salesPrice === ''
        ? null
        : raw.salesPrice != null
          ? parseNumber(raw.salesPrice)
          : undefined,
    isDigital: parseBool(raw.isDigital),
    showInHomepage: parseBool(raw.showInHomepage),
    pages: parseNumber(raw.pages),
    stock: raw.stock === '' ? null : raw.stock != null ? parseNumber(raw.stock) : undefined,

    publishDate: raw.publishDate ? new Date(raw.publishDate) : undefined,
  };

  const filesMap = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  const files = {
    cover: filesMap.cover?.[0],
    pdf: filesMap.pdf?.[0],
  };

  const book = await updateBookWithUploads(String(id), body as any, files);
  return ok(res, { book });
});

// 🗑️ Soft delete
export const deleteBookCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  await softDeleteBook(String(id));
  return ok(res, { deleted: true });
});

// ♻️ Restore
export const restoreBookCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  await restoreBook(String(id));
  return ok(res, { restored: true });
});

// 🏠 Homepage
export const homepageBooksCtrl = catchAsync(async (req: Request, res: Response) => {
  const items = await getHomepageBooks(req.validated?.query as any);
  return ok(res, { books: items });
});

// 📦 With categories
export const booksWithCategoriesCtrl = catchAsync(async (req: Request, res: Response) => {
  const result = await getBooksWithCategories(req.validated?.query as any);
  return ok(res, { books: result.books, categories: result.categories }, result.meta);
});
