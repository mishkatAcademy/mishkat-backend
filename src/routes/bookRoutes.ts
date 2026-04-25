// src/routes/bookRoutes.ts
import { Router } from 'express';
import {
  createBookCtrl,
  listBooksCtrl,
  listBooksAdminCtrl,
  getBookCtrl,
  getBookBySlugCtrl,
  getBookAdminCtrl,
  updateBookCtrl,
  deleteBookCtrl,
  restoreBookCtrl,
  homepageBooksCtrl,
  booksWithCategoriesCtrl,
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
import { uploadBookAssetsDisk } from '../middlewares/upload.disk';

const router = Router();

/** =========================
 * 🟢 Public static routes
 * ========================= */

// ✅ Home books
router.get('/home', validateQuery(homepageBooksQuerySchema), homepageBooksCtrl);

// ✅ Books + categories
router.get('/with-categories', validateQuery(bookQuerySchema), booksWithCategoriesCtrl);

// ✅ Quick search
router.get(
  '/search',
  validateQuery(bookQuerySchema),
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

// ✅ Public list
router.get('/', validateQuery(bookQuerySchema), listBooksCtrl);

// ✅ Public single by slug
router.get('/slug/:slug', getBookBySlugCtrl);

// ✅ Admin list
router.get('/admin', protect, isAdmin, validateQuery(bookQuerySchema), listBooksAdminCtrl);

// ✅ Admin get by id
router.get(
  '/admin/:id',
  protect,
  isAdmin,
  validateRequest({ params: bookIdParamsSchema }),
  getBookAdminCtrl,
);

// ➕ Create (JSON only)
router.post('/', protect, isAdmin, validateRequestBody(createBookSchema), createBookCtrl);

// ➕ Create with uploads
router.post('/upload', protect, isAdmin, uploadBookAssetsDisk, createBookUploadCtrl);

// ✏️ Update (JSON only)
router.patch(
  '/:id',
  protect,
  isAdmin,
  validateRequest({ params: bookIdParamsSchema, body: updateBookSchema }),
  updateBookCtrl,
);

// ✏️ Update with uploads
router.patch(
  '/:id/upload',
  protect,
  isAdmin,
  validateRequest({ params: bookIdParamsSchema }),
  uploadBookAssetsDisk,
  updateBookUploadCtrl,
);

// ♻️ Restore
router.patch(
  '/:id/restore',
  protect,
  isAdmin,
  validateRequest({ params: bookIdParamsSchema }),
  restoreBookCtrl,
);

// 🗑️ Soft delete
router.delete(
  '/:id',
  protect,
  isAdmin,
  validateRequest({ params: bookIdParamsSchema }),
  deleteBookCtrl,
);

// ✅ Public single by ID
router.get('/:id', validateRequest({ params: bookIdParamsSchema }), getBookCtrl);

export default router;
