// src/contollers/bookController.ts
import type { Request, Response, Express } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok, created } from '../utils/response';
import {
  createBook,
  listBooks,
  listBooksAdmin,
  getBook,
  getBookAdmin,
  updateBook,
  softDeleteBook,
  restoreBook,
  getHomepageBooks,
  getBooksWithCategories,
  createBookWithUploads,
  updateBookWithUploads,
} from '../services/bookService';

// ✅ Create (JSON)
export const createBookCtrl = catchAsync(async (req: Request, res: Response) => {
  const book = await createBook(req.validated?.body as any);
  return created(res, { book });
});

// ✅ Create (multipart: cover/pdf)
export const createBookUploadCtrl = catchAsync(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as any;
  const filesMap = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  const files = {
    cover: filesMap.cover?.[0],
    pdf: filesMap.pdf?.[0],
  };
  const book = await createBookWithUploads(body, files);
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
  const book = await getBook(String(id));
  return ok(res, { book });
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
export const updateBookUploadCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  const body = (req.body ?? {}) as any;
  const filesMap = (req.files ?? {}) as Record<string, Express.Multer.File[]>;

  const files = {
    cover: filesMap.cover?.[0],
    pdf: filesMap.pdf?.[0],
  };

  const book = await updateBookWithUploads(String(id), body, files);
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
