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
  instructorAddWeeklyItem,
  instructorDeleteWeeklyItem,
  instructorUpdateWeeklyItem,
  instructorSetDayOff,
  instructorSetOffRange,
  instructorAddSlotsToDay,
  instructorRehydrateMyWeekly,
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

/* ========================= NEW endpoints ========================= */
/** (1) POST /instructors/me/weekly/items */
export const addWeeklyItemCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const body = (req.validated?.body as any) ?? req.body;
  const profile = await instructorAddWeeklyItem(userId, body);
  return created(res, { profile });
});

/** (2) DELETE /instructors/me/weekly/items/:itemId */
export const deleteWeeklyItemCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const { itemId } = (req.validated?.params as any) ?? req.params;
  const profile = await instructorDeleteWeeklyItem(userId, String(itemId));
  return ok(res, { profile });
});

/** (3) PATCH /instructors/me/weekly/items/:itemId */
export const updateWeeklyItemCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const { itemId } = (req.validated?.params as any) ?? req.params;
  const body = (req.validated?.body as any) ?? req.body;
  const profile = await instructorUpdateWeeklyItem(userId, String(itemId), body);
  return ok(res, { profile });
});

/** (4) POST /instructors/me/exceptions/:dateYMD/off */
export const setDayOffCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const { dateYMD } = (req.validated?.params as any) ?? req.params;
  const profile = await instructorSetDayOff(userId, String(dateYMD));
  return ok(res, { profile });
});

/** (6) POST /instructors/me/exceptions/off-range */
export const setOffRangeCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const body = (req.validated?.body as any) ?? req.body;
  const profile = await instructorSetOffRange(userId, body.from, body.to);
  return ok(res, { profile });
});

/** (7) POST /instructors/me/exceptions/:dateYMD/slots */
export const addSlotsToDayCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const { dateYMD } = (req.validated?.params as any) ?? req.params;
  const body = (req.validated?.body as any) ?? req.body;
  const profile = await instructorAddSlotsToDay(userId, String(dateYMD), body.slots);
  return ok(res, { profile });
});

/* ========================= Admin endpoints ========================= */
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

/* دالة مؤقتة لإضافة id لعناصر ال weekly القديمة */
export const rehydrateMyWeeklyCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id?.toString()!;
  const profile = await instructorRehydrateMyWeekly(userId);
  return ok(res, { profile });
});
