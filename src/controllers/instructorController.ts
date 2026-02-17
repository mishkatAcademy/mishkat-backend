// src/controllers/instructorController.ts
import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok, created } from '../utils/response';
import {
  adminCreateInstructorProfile,
  adminUpdateInstructorProfile,
  instructorUpdateMyProfile,
  getInstructorProfileByUserId,
  getMyInstructorProfile,
  listInstructorsAdmin,
  adminSetInstructorActive,
  instructorReplaceMyWeekly,
  instructorUpsertMyException,
  instructorDeleteMyException,
} from '../services/instructorService';

/** Instructor (self): GET /instructors/me */
export const getMyInstructorProfileCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const profile = await getMyInstructorProfile(userId);
  return ok(res, { profile });
});

/** Instructor (self): PATCH /instructors/me */
export const updateMyInstructorProfileCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const profile = await instructorUpdateMyProfile(userId, (req.validated?.body as any) ?? req.body);
  return ok(res, { profile });
});

/** Instructor (self): PUT /instructors/me/weekly */
export const updateMyWeeklyCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const { weekly } = (req.validated?.body as any) ?? req.body;
  const profile = await instructorReplaceMyWeekly(userId, weekly);
  return ok(res, { profile });
});

/** Instructor (self): PUT /instructors/me/exceptions/:dateYMD */
export const upsertMyExceptionCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const { dateYMD } = (req.validated?.params as any) ?? req.params;
  const body = (req.validated?.body as any) ?? req.body;

  const profile = await instructorUpsertMyException(userId, String(dateYMD), body);
  return ok(res, { profile });
});

/** Instructor (self): DELETE /instructors/me/exceptions/:dateYMD */
export const deleteMyExceptionCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const { dateYMD } = (req.validated?.params as any) ?? req.params;

  const profile = await instructorDeleteMyException(userId, String(dateYMD));
  return ok(res, { profile });
});

/** Admin: POST /instructors */
export const adminCreateInstructorCtrl = catchAsync(async (req: Request, res: Response) => {
  const profile = await adminCreateInstructorProfile(req.validated?.body as any);
  return created(res, { profile });
});

/** Admin: GET /instructors */
export const listInstructorsAdminCtrl = catchAsync(async (req: Request, res: Response) => {
  const result = await listInstructorsAdmin(req.validated?.query as any);
  return ok(res, result.items, result.meta);
});

/** Admin: GET /instructors/:userId */
export const getInstructorProfileCtrl = catchAsync(async (req: Request, res: Response) => {
  const { userId } = (req.validated?.params as { userId: string }) ?? req.params;
  const profile = await getInstructorProfileByUserId(String(userId));
  return ok(res, { profile });
});

/** Admin: PATCH /instructors/:userId */
export const adminUpdateInstructorCtrl = catchAsync(async (req: Request, res: Response) => {
  const { userId } = (req.validated?.params as { userId: string }) ?? req.params;
  const updates = (req.validated?.body as any) ?? req.body;
  const profile = await adminUpdateInstructorProfile(String(userId), updates);
  return ok(res, { profile });
});

/** Admin: PATCH /instructors/:userId/activate */
export const activateInstructorCtrl = catchAsync(async (req: Request, res: Response) => {
  const { userId } = (req.validated?.params as { userId: string }) ?? req.params;
  const profile = await adminSetInstructorActive(String(userId), true);
  return ok(res, { profile, message: 'Activated' });
});

/** Admin: PATCH /instructors/:userId/deactivate */
export const deactivateInstructorCtrl = catchAsync(async (req: Request, res: Response) => {
  const { userId } = (req.validated?.params as { userId: string }) ?? req.params;
  const profile = await adminSetInstructorActive(String(userId), false);
  return ok(res, { profile, message: 'Deactivated' });
});
