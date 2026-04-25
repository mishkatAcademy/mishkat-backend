// src/routes/researchRoutes.ts
import { Router } from 'express';
import { protect, isAdmin } from '../middlewares/authMiddleware';
import { validateRequest, validateRequestBody, validateQuery } from '../middlewares/validate';
import {
  createResearchBodySchema,
  myListQuerySchema,
  idParamSchema,
  adminListQuerySchema,
  adminUpdateBodySchema,
  attachmentParamsSchema,
} from '../validations/research.schema';
import {
  createResearchCtrl,
  listMyResearchCtrl,
  getMyResearchCtrl,
  adminListResearchCtrl,
  adminGetResearchCtrl,
  adminUpdateResearchCtrl,
  downloadMyResearchAttachmentCtrl,
} from '../controllers/researchController';
import { uploadResearchFilesDisk } from '../middlewares/upload.disk';

const router = Router();

/** ============ مستخدم ============ */
// إنشاء طلب (multipart/form-data)
router.post(
  '/requests',
  protect,
  uploadResearchFilesDisk, // ✅ multer first (multipart)
  validateRequestBody(createResearchBodySchema),
  createResearchCtrl,
);

// طلباتي
router.get(
  '/me/research',
  protect,
  validateRequest({ query: myListQuerySchema }),
  listMyResearchCtrl,
);

// طلب واحد لي
router.get(
  '/me/research/:id',
  protect,
  validateRequest({ params: idParamSchema }),
  getMyResearchCtrl,
);

router.get(
  '/me/research/:id/attachments/:attachmentId/download',
  protect,
  validateRequest({ params: attachmentParamsSchema }),
  downloadMyResearchAttachmentCtrl,
);

/** ============ أدمن ============ */
router.use(protect, isAdmin);

// لستة كل الطلبات مع فلاتر
router.get('/', validateRequest({ query: adminListQuerySchema }), adminListResearchCtrl);

// تفاصيل طلب
router.get('/:id', validateRequest({ params: idParamSchema }), adminGetResearchCtrl);

// تحديث حالة/ملاحظات
router.patch(
  '/:id',
  validateRequest({ params: idParamSchema, body: adminUpdateBodySchema }),
  adminUpdateResearchCtrl,
);

export default router;
