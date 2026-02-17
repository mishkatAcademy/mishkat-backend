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

/**
 * PATCH /admin/me
 * multipart/form-data:
 *  - avatar (file) optional
 *  - firstName optional
 *  - lastName optional
 */
router.patch(
  '/me',
  uploadAvatarDisk, // ✅ لازم قبل validate
  validateRequestBody(adminUpdateMeBodySchema),
  adminUpdateMeCtrl,
);

router.post(
  '/me/change-password',
  validateRequestBody(adminChangePasswordBodySchema),
  adminChangePasswordCtrl,
);

export default router;
