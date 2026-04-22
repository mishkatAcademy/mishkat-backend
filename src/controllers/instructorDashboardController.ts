// src/controllers/instructorDashboardController.ts
import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import AppError from '../utils/AppError';
import { ok } from '../utils/response';
import {
  listMyInstructorConsultationsService,
  listMySupportedOfferingsService,
} from '../services/instructorDashboardService';

export const listMyInstructorConsultationsCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString();
  if (!userId) throw AppError.unauthorized('Unauthorized');

  const q = (req.validated?.query as any) ?? req.query;

  const result = await listMyInstructorConsultationsService(userId, q);
  return ok(res, { items: result.items }, result.meta);
});

export const listMySupportedOfferingsCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString();
  if (!userId) throw AppError.unauthorized('Unauthorized');

  const activeOnly = (req.validated?.query as any)?.activeOnly ?? true;

  const result = await listMySupportedOfferingsService(userId, Boolean(activeOnly));
  return ok(res, { items: result.items });
});
