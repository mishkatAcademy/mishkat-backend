// src/routes/adminRoutes.ts
import { Router } from 'express';
import { protect, isAdmin } from '../middlewares/authMiddleware';
import { validateRequestBody } from '../middlewares/validate';

import { adminUpdateMeCtrl, adminChangePasswordCtrl } from '../controllers/adminMeController';
import {
  adminUpdateMeBodySchema,
  adminChangePasswordBodySchema,
} from '../validations/adminMe.schema';

import { uploadAvatarDisk } from '../middlewares/upload.disk';

const router = Router();

router.use(protect, isAdmin);

router.patch(
  '/me',
  uploadAvatarDisk,
  validateRequestBody(adminUpdateMeBodySchema),
  adminUpdateMeCtrl,
);

router.patch(
  '/me/change-password',
  validateRequestBody(adminChangePasswordBodySchema),
  adminChangePasswordCtrl,
);

export default router;
