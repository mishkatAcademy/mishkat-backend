import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok, created, noContent } from '../utils/response';
import AppError from '../utils/AppError';
import {
  listMyAddressesService,
  createAddressService,
  updateAddressService,
  deleteAddressService,
  getMyAddressService,
  setDefaultAddressService,
} from '../services/addressService';

/*
| العملية                  |                    الوصف                                           |
| ------------------------ | ---------------------------------------------------------------     |
| `getMyAddresses`         | جلب كل العناوين المرتبطة بالمستخدم الحالي                        |
| `createAddress`          | إضافة عنوان جديد للمستخدم الحالي                                  |
| `updateAddress`          | تعديل عنوان معين (للمستخدم الحالي فقط)                            |
| `deleteAddress`          | حذف عنوان (soft delete أو فعلي) للمستخدم الحالي                   |
| `setDefaultAddress`      | تحديث العنوان الإفتراضي للمستخدم الحالي                           |
| `getAddressById`         | جلب عنوان واحد حسب الـ ID (مع التحقق من ملكية العنوان للمستخدم) |
*/

/** GET /addresses */
export const listMyAddresses = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { page, limit, sortBy } = (req.validated?.query || {}) as {
    page?: number;
    limit?: number;
    sortBy?: string;
  };

  const result = await listMyAddressesService(userId, { page, limit, sortBy });
  return ok(res, result.data, result.meta);
});

/** POST /addresses */
export const createAddress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const doc = await createAddressService(userId, req.validated!.body as any);
  return created(res, doc);
});

/** GET /addresses/:id */
export const getMyAddress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.validated!.params as { id: string };
  const doc = await getMyAddressService(userId, id);
  return ok(res, doc);
});

/** PATCH /addresses/:id */
export const updateAddress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.validated!.params as { id: string };
  const doc = await updateAddressService(userId, id, req.validated!.body as any);
  return ok(res, doc);
});

/** PATCH /addresses/:id/default */
export const setDefaultAddress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.validated!.params as { id: string };
  const doc = await setDefaultAddressService(userId, id);
  return ok(res, doc);
});

/** DELETE /addresses/:id */
export const deleteAddress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.validated!.params as { id: string };
  await deleteAddressService(userId, id);
  return ok(res, { success: true, message: 'تم حذف العنوان بنجاح' });
});
