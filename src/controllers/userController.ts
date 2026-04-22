// src/controllers/userController.ts
import { Request, Response, NextFunction } from 'express';
import type { Express } from 'express'; // ✅ علشان Express.Multer.File
import catchAsync from '../utils/catchAsync';
import { ok, noContent } from '../utils/response';
import { AppError } from '../utils/AppError';
import { clearAuthCookies } from '../utils/setAuthCookies';
import User from '../models/User';

import {
  updateMyProfileService,
  changePasswordService,
  getAllUsersService,
  getUserByIdService,
  updateUserRoleService,
  deactivateUserService,
  reactivateUserService,
} from '../services/userService';

/*
| الوظيفة              | الوصف                                                   |
| -------------------- | ------------------------------------------------------- |
| getMyProfile         | جلب بياناتي                                            |
| updateMyProfile      | تعديل اسمي/صورتي                                       |
| deleteMyAccount      | حذف (soft delete)                                      |

| getAllUsers          | (أدمن) جلب كل المستخدمين                               |
| getUserById          | (أدمن) جلب مستخدم محدد                                 |
| updateUserRole       | (أدمن) تغيير الدور                                     |

| changePassword       | تغيير كلمة المرور                                       |
| deactivateUser       | (أدمن) تعطيل مستخدم                                    |
| reactivateUser       | (أدمن) إعادة تفعيل مستخدم                              |
*/

// 🧍‍♂️ Get current user profile
export const getMyProfile = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw AppError.unauthorized('غير مصرح: المستخدم غير معرّف');

  const user = await getUserByIdService(userId);
  return ok(res, { user });
});

// ✏️ Update user profile (name or avatar)
export const updateMyProfile = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) throw AppError.unauthorized('غير مصرح: المستخدم غير معرّف');

    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    const avatarFile = files.avatar?.[0];

    const payload = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      avatar: req.body.avatar,
    };

    const user = await updateMyProfileService({ userId, payload, avatarFile });
    return ok(res, { user });
  },
);

// ✅ Soft delete (حذف حسابي)
export const deleteMyAccount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw AppError.unauthorized('غير مصرح: المستخدم غير معرّف');

  const me = await User.findById(userId).select('role isDeleted');
  if (!me) throw AppError.notFound('المستخدم غير موجود');
  if (me.role === 'admin') throw AppError.forbidden('لا يمكن حذف حساب الأدمن');

  // ⛳️ idempotent soft delete
  if (!me.isDeleted) {
    await deactivateUserService(userId);
    // TODO: (إلغاء holds/تفريغ cart/إغلاق طلبات غير مدفوعة...) جسب رغبة العميل
  }

  clearAuthCookies(res);

  // 204 No Content
  return noContent(res);
});

// 🔒 تغيير كلمة المرور
export const changePassword = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) throw AppError.unauthorized('غير مصرح: المستخدم غير معرّف');

    const { currentPassword, newPassword } = req.body;
    await changePasswordService(userId, currentPassword, newPassword);

    return ok(res, { message: 'تم تغيير كلمة المرور بنجاح ✅' });
  },
);

// 👑 Get all users (admin only)
export const getAllUsers = catchAsync(async (_req: Request, res: Response) => {
  const users = await getAllUsersService();
  return ok(res, { users }, { count: users.length });
});

// 🔎 Get single user by ID (admin only)
export const getUserById = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  const user = await getUserByIdService(id);
  return ok(res, { user });
});

// ⚙️ Update user role (admin only)
export const updateUserRole = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = (req.validated?.params as { id: string }) ?? req.params;
    const { role } = req.body;
    const user = await updateUserRoleService(id, role);
    return ok(res, { user, message: 'تم تحديث الدور بنجاح' });
  },
);

// 🚫 Deactivate user (admin only)
export const deactivateUser = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = (req.validated?.params as { id: string }) ?? req.params;
    await deactivateUserService(id);
    return ok(res, { message: 'تم تعطيل الحساب بنجاح ✅' });
  },
);

// ✅ Reactivate user (admin only)
export const reactivateUser = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = (req.validated?.params as { id: string }) ?? req.params;
    await reactivateUserService(id);
    return ok(res, { message: 'تم تفعيل الحساب بنجاح ✅' });
  },
);
