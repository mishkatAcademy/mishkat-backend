// src/routes/bookRoutes.ts
import { Router } from 'express';
import {
  createBookCtrl,
  listBooksCtrl,
  listBooksAdminCtrl,
  getBookCtrl,
  getBookAdminCtrl,
  updateBookCtrl,
  deleteBookCtrl,
  restoreBookCtrl,
  homepageBooksCtrl,
  booksWithCategoriesCtrl,
  // 👇 جديدة لو ضفت الكونترولرات دي
  createBookUploadCtrl,
  updateBookUploadCtrl,
} from '../controllers/bookController';

import { validateRequest, validateQuery, validateRequestBody } from '../middlewares/validate';

import {
  createBookSchema,
  updateBookSchema,
  bookIdParamsSchema,
  bookQuerySchema,
  homepageBooksQuerySchema,
} from '../validations/book.schema';

import { protect, isAdmin } from '../middlewares/authMiddleware';
import { searchMiddleware } from '../middlewares/searchMiddleware';
import Book from '../models/Book';

// Multer (Disk) لرفع الغلاف/الـ PDF
import { uploadBookAssetsDisk } from '../middlewares/upload.disk';

const router = Router();

/** 🟢 Public: home + catalog (+ search) */

// ✅ GET home books
router.get('/home', validateQuery(homepageBooksQuerySchema), homepageBooksCtrl);

// ✅ GET all books + categories that have books
router.get('/with-categories', validateQuery(bookQuerySchema), booksWithCategoriesCtrl);

// ✅ Optional quick search (لازم قبل `/:id`)
router.get(
  '/search',
  validateQuery(bookQuerySchema),
  // ملاحظة: تأكد إن الـ middleware بيختم الرد، أو أضف handler بعدها يرجّع res.locals.result
  searchMiddleware({
    model: Book,
    fields: [
      'slug',
      'title.ar',
      'title.en',
      'author.ar',
      'author.en',
      'description.ar',
      'description.en',
      'isbn',
    ] as any,
    defaultFilters: { isDeleted: false },
  }),
);

// ✅ GET all books (قائمة عامة)
router.get('/', validateQuery(bookQuerySchema), listBooksCtrl);

// ✅ GET single book by ID
router.get('/:id', validateRequest({ params: bookIdParamsSchema }), getBookCtrl);

/** 🔐 Admin: create/update/delete/restore */
router.use(protect, isAdmin);

// ✅ Admin: GET all books (full details)
router.get('/admin', validateQuery(bookQuerySchema), listBooksAdminCtrl);

// ✅ GET single book by ID (Admin)
router.get('/admin/:id', validateRequest({ params: bookIdParamsSchema }), getBookAdminCtrl);

// ➕ Create (JSON only)
router.post('/', validateRequestBody(createBookSchema), createBookCtrl);

// ➕ Create with uploads (cover/pdf) — multipart/form-data
router.post('/upload', uploadBookAssetsDisk, createBookUploadCtrl);

// ✏️ Update (JSON only)
router.patch(
  '/:id',
  validateRequest({ params: bookIdParamsSchema, body: updateBookSchema }),
  updateBookCtrl,
);

// ✏️ Update with uploads (cover/pdf)
router.patch(
  '/:id/upload',
  validateRequest({ params: bookIdParamsSchema }),
  uploadBookAssetsDisk,
  updateBookUploadCtrl,
);

// 🗑️ Soft delete
router.delete('/:id', validateRequest({ params: bookIdParamsSchema }), deleteBookCtrl);

// ♻️ Restore
router.patch('/:id/restore', validateRequest({ params: bookIdParamsSchema }), restoreBookCtrl);

export default router;
