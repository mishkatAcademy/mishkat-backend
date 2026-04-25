// src/routes/categoryRoutes.ts
import { Router } from 'express';
import {
  createCategoryCtrl,
  listCategoriesCtrl,
  getCategoryCtrl,
  updateCategoryCtrl,
  deleteCategoryCtrl,
  restoreCategoryCtrl,
} from '../controllers/categoryController';
import { validateRequest, validateQuery, validateRequestBody } from '../middlewares/validate';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamsSchema,
  categoryQuerySchema,
} from '../validations/category.schema';
import { protect, isAdmin } from '../middlewares/authMiddleware';

const router = Router();

// ✅ عامة
router.get('/', validateQuery(categoryQuerySchema), listCategoriesCtrl);
router.get('/:id', validateRequest({ params: categoryIdParamsSchema }), getCategoryCtrl);

// 🔐 الإدارة
router.use(protect, isAdmin);

router.post('/', validateRequestBody(createCategorySchema), createCategoryCtrl);

router.patch(
  '/:id',
  validateRequest({ params: categoryIdParamsSchema, body: updateCategorySchema }),
  updateCategoryCtrl,
);

router.delete('/:id', validateRequest({ params: categoryIdParamsSchema }), deleteCategoryCtrl);
router.patch(
  '/:id/restore',
  validateRequest({ params: categoryIdParamsSchema }),
  restoreCategoryCtrl,
);

export default router;
