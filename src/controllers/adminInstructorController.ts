// src/controllers/adminInstructorController.ts
import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { created } from '../utils/response';
import { adminCreateInstructorService } from '../services/adminInstructorService';

export const adminCreateInstructorCtrl = catchAsync(async (req: Request, res: Response) => {
  const body = (req.validated?.body ?? req.body) as any;
  const prof = await adminCreateInstructorService(body);
  return created(res, { instructor: prof });
});
