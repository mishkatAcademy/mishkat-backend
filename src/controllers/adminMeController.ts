// src/controllers/adminMeController.ts
import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok } from '../utils/response';
import { adminUpdateMeService, adminChangePasswordService } from '../services/adminMeService';

export const adminUpdateMeCtrl = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id.toString();

  const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
  const avatarFile = files.avatar?.[0];

  const body = (req.validated?.body as any) ?? req.body;

  const result = await adminUpdateMeService(
    adminId,
    { firstName: body.firstName, lastName: body.lastName },
    avatarFile,
  );

  return ok(res, result);
});

export const adminChangePasswordCtrl = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id.toString();
  const body = (req.validated?.body as any) ?? req.body;

  const result = await adminChangePasswordService(adminId, body);
  return ok(res, result);
});
