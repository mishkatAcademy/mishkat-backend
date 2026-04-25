// // src/routes/orderRoutes.ts
import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware';
import { validateRequest, validateRequestBody } from '../middlewares/validate';
import { createOrderBodySchema, idParamSchema, listQuerySchema } from '../validations/order.schema';
import { idempotencyHeaderSchema } from '../validations/common.headers';
import {
  createOrderCtrl,
  listMyOrdersCtrl,
  getMyOrderCtrl,
  moyasarWebhookCtrl,
} from '../controllers/orderController';

const router = Router();

router.post('/webhook/moyasar', moyasarWebhookCtrl);

// لازم تسجيل الدخول
router.use(protect);

// إنشاء طلب من الكارت
router.post(
  '/',
  validateRequest({ headers: idempotencyHeaderSchema, body: createOrderBodySchema }),
  createOrderCtrl,
);

// طلباتي
router.get('/', validateRequest({ query: listQuerySchema }), listMyOrdersCtrl);

// طلب واحد
router.get('/:id', validateRequest({ params: idParamSchema }), getMyOrderCtrl);

export default router;
