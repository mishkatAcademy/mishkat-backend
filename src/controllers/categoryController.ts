// src/controllers/categoryController.ts
import type { Request, Response } from 'express';
import type { z } from 'zod';
import catchAsync from '../utils/catchAsync';
import { ok, created, noContent } from '../utils/response';
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  softDeleteCategory,
  restoreCategory,
} from '../services/categoryService';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamsSchema,
  categoryQuerySchema,
} from '../validations/category.schema';

// ✨ Types inferred from Zod (اختياري لكن مفيد للتايبينج)
type CreateBody = z.infer<typeof createCategorySchema>;
type UpdateBody = z.infer<typeof updateCategorySchema>;
type IdParams = z.infer<typeof categoryIdParamsSchema>;
type ListQuery = z.infer<typeof categoryQuerySchema>;

/** ➕ إنشاء تصنيف جديد */
export const createCategoryCtrl = catchAsync(async (req: Request, res: Response) => {
  const body = (req.validated?.body as CreateBody) ?? req.body;
  const cat = await createCategory(body);
  return created(res, { category: cat });
});

/** 📚 قائمة التصنيفات (بفلاتر وباجينيشن) */
export const listCategoriesCtrl = catchAsync(async (req: Request, res: Response) => {
  const query = (req.validated?.query as ListQuery) ?? (req.query as any);
  const result = await listCategories(query);
  return ok(res, result.items, result.meta);
});

/** 📄 جلب تصنيف بالمعرّف */
export const getCategoryCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = ((req.validated?.params as IdParams) ?? req.params) as IdParams;
  const cat = await getCategory(String(id));
  return ok(res, { category: cat });
});

/** ✏️ تحديث تصنيف */
export const updateCategoryCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = ((req.validated?.params as IdParams) ?? req.params) as IdParams;
  const updates = ((req.validated?.body as UpdateBody) ?? req.body ?? {}) as UpdateBody;

  const cat = await updateCategory(String(id), updates);
  return ok(res, { category: cat });
});

/** 🗑️ حذف منطقي */
export const deleteCategoryCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = ((req.validated?.params as IdParams) ?? req.params) as IdParams;

  await softDeleteCategory(String(id));
  // خيار 1: 200 + body
  return ok(res, { deleted: true });
});

/** ♻️ استرجاع تصنيف محذوف */
export const restoreCategoryCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = ((req.validated?.params as IdParams) ?? req.params) as IdParams;

  await restoreCategory(String(id));
  return ok(res, { restored: true });
});
