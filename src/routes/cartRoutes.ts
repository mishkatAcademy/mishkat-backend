// src/routes/cartRoutes.ts
import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware';
import { validateRequest, validateRequestBody } from '../middlewares/validate';
import {
  addCartItem,
  getCart,
  updateCartItemQty,
  removeCartItem,
  clearCart,
} from '../controllers/cartController';
import {
  addCartItemSchema,
  cartItemIdParamsSchema,
  updateCartQtySchema,
} from '../validations/cart.schema';

const router = Router();

// 🔒 كل مسارات الكارت للمستخدمين فقط
router.use(protect);

// GET /api/v1/cart
router.get('/', getCart);

// POST /api/v1/cart/items
router.post('/items', validateRequestBody(addCartItemSchema), addCartItem);

// PATCH /api/v1/cart/items/:id
router.patch(
  '/items/:id',
  validateRequest({ params: cartItemIdParamsSchema, body: updateCartQtySchema }),
  updateCartItemQty,
);

// DELETE /api/v1/cart/items/:id
router.delete('/items/:id', validateRequest({ params: cartItemIdParamsSchema }), removeCartItem);

// DELETE /api/v1/cart
router.delete('/', clearCart);

export default router;
