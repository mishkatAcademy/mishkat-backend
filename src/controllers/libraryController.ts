// src/controllers/libraryController.ts
import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok } from '../utils/response';
import AppError from '../utils/AppError';
import {
  listMyBooksService,
  getMyBookByIdService,
  getMyBookReadUrlService,
} from '../services/libraryService';

export const listMyBooksCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw AppError.unauthorized('Unauthorized');

  const { page = 1, limit = 10 } = (req.validated?.query as any) ?? req.query;

  const result = await listMyBooksService(String(userId), Number(page), Number(limit));

  // ✅ موحّد: data { items, meta }
  return ok(res, result);
});

export const getMyBookByIdCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString();
  if (!userId) throw AppError.unauthorized('Unauthorized');

  const { id } = (req.validated?.params as any) ?? req.params;

  const data = await getMyBookByIdService(userId, String(id));

  return ok(res, data); // data = { ownership: {...} }
});

export const getMyBookReadUrlCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString();
  if (!userId) throw AppError.unauthorized('Unauthorized');

  const { id } = req.params; // bookId
  const data = await getMyBookReadUrlService(userId, String(id));
  return ok(res, data);
});
