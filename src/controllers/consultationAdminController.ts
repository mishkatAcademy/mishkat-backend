// src/controllers/consultationAdminController.ts
import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok } from '../utils/response';
import {
  adminListConsultationBookingsService,
  adminGetConsultationBookingByIdService,
} from '../services/consultationService';

export const adminListBookingsCtrl = catchAsync(async (req: Request, res: Response) => {
  const q = (req.validated?.query as any) ?? req.query;
  const result = await adminListConsultationBookingsService(q);
  return ok(res, result.items, result.meta);
});

export const adminGetBookingCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = (req.validated?.params as any) ?? req.params;
  const booking = await adminGetConsultationBookingByIdService(String(id));
  return ok(res, { booking });
});
