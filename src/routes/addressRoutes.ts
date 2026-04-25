import express from 'express';
import { protect } from '../middlewares/authMiddleware';
import {
  validateRequest,
  validateRequestBody,
  validateRequestParams,
  validateQuery,
} from '../middlewares/validate';

import {
  listMyAddresses,
  createAddress,
  getMyAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/addressController';

import {
  addressListQuerySchema,
  addressIdParamsSchema,
  createAddressSchema,
  updateAddressSchema,
  setDefaultAddressSchema,
} from '../validations/address.schema';

const router = express.Router();

// كل المسارات تتطلب تسجيل دخول
router.use(protect);

/** قائمة عناويني */
router.get('/', validateQuery(addressListQuerySchema), listMyAddresses);

/** إنشاء عنوان */
router.post('/', validateRequestBody(createAddressSchema), createAddress);

/** عنوان واحد */
router.get('/:id', validateRequestParams(addressIdParamsSchema), getMyAddress);

/** تحديث عنوان */
router.patch(
  '/:id',
  validateRequest({ params: addressIdParamsSchema, body: updateAddressSchema }),
  updateAddress,
);

/** تعيين كافتراضي */
router.patch('/:id/default', validateRequestParams(addressIdParamsSchema), setDefaultAddress);

/** حذف عنوان (Soft) */
router.delete('/:id', validateRequestParams(addressIdParamsSchema), deleteAddress);

export default router;
