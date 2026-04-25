// src/routes/userRoutes.ts
import express from 'express';
import User from '../models/User';
import {
  getMyProfile,
  updateMyProfile,
  deleteMyAccount,
  changePassword,
  getAllUsers,
  getUserById,
  updateUserRole,
  deactivateUser,
  reactivateUser,
} from '../controllers/userController';

import { protect, isAdmin } from '../middlewares/authMiddleware';
import { searchMiddleware } from '../middlewares/searchMiddleware';

import {
  updateProfileSchema,
  updateUserRoleSchema,
  changePasswordSchema,
  userIdParamsSchema,
  userSearchQuerySchema,
} from '../validations/user.schema';

import { validateRequestBody, validateRequestParams, validateQuery } from '../middlewares/validate';
import { uploadAvatarDisk } from '../middlewares/upload.disk';

const router = express.Router();

/** 🧑‍💻 مستخدم مسجّل فقط */
router.use(protect);

// 🧾 الحصول على ملفي الشخصي
router.get('/me', getMyProfile);

// ✏️ تعديل بياناتي (الاسم + الأفاتار)
// أولاً: استقبل الملف (إن وجد) → بعدين validate body → بعدين controller
router.patch('/me', uploadAvatarDisk, validateRequestBody(updateProfileSchema), updateMyProfile);

// ✏️ تغيير كلمة المرور
router.patch('/me/change-password', validateRequestBody(changePasswordSchema), changePassword);

// 🗑 حذف حسابي
router.delete('/me', deleteMyAccount);

// 👑 الأدمن فقط
router.use(isAdmin);

router.get('/', getAllUsers);

// 🔎 مثال سيرش
// GET /users/search?searchTerm=kareem&role=instructor&page=1&limit=5&sortBy=createdAt&order=desc
router.get(
  '/search',
  validateQuery(userSearchQuerySchema),
  searchMiddleware({
    model: User,
    fields: ['firstName', 'lastName', 'email'],
    defaultFilters: { isDeleted: false },
  }),
);

router.get('/:id', validateRequestParams(userIdParamsSchema), getUserById);

router.patch(
  '/:id/role',
  validateRequestParams(userIdParamsSchema),
  validateRequestBody(updateUserRoleSchema),
  updateUserRole,
);

router.patch('/admin/deactivate/:id', validateRequestParams(userIdParamsSchema), deactivateUser);

router.patch('/admin/reactivate/:id', validateRequestParams(userIdParamsSchema), reactivateUser);

export default router;
