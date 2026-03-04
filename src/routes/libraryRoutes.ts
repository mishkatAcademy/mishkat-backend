// src/routes/libraryRoutes.ts
import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware';
import { validateRequest } from '../middlewares/validate';
import { listMyLibraryQuerySchema, bookIdParamSchema } from '../validations/library.schema';
import {
  listMyBooksCtrl,
  getMyBookByIdCtrl,
  getMyBookReadUrlCtrl,
} from '../controllers/libraryController';

const router = Router();

router.use(protect);

// GET /api/v1/library/books
router.get('/books', validateRequest({ query: listMyLibraryQuerySchema }), listMyBooksCtrl);

// GET /api/v1/library/books/:id
router.get('/books/:id', validateRequest({ params: bookIdParamSchema }), getMyBookByIdCtrl);

// GET /api/v1/library/books/:id/read
router.get('/books/:id/read', validateRequest({ params: bookIdParamSchema }), getMyBookReadUrlCtrl);

export default router;
