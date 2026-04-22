// src/controllers/cartController.ts
import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok, created, noContent } from '../utils/response';
import {
  getCartService,
  addCartItemService,
  updateCartItemQuantityService,
  removeCartItemService,
  clearCartService,
} from '../services/cartService';

// GET /api/v1/cart
export const getCart = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const data = await getCartService(userId);
  return ok(res, data);
});

// POST /api/v1/cart/items
export const addCartItem = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const item = await addCartItemService({ userId, ...req.body });
  return created(res, { item });
});

// PATCH /api/v1/cart/items/:id
export const updateCartItemQty = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id: cartItemId } = (req.validated?.params as { id: string }) ?? req.params;
  const { quantity } = (req.validated?.body as { quantity: number }) ?? req.body;
  const item = await updateCartItemQuantityService({
    userId: String(userId),
    cartItemId: String(cartItemId),
    quantity: Number(quantity),
  });
  return ok(res, { item });
});

// DELETE /api/v1/cart/items/:id
export const removeCartItem = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id: cartItemId } = (req.validated?.params as { id: string }) ?? req.params;
  await removeCartItemService({ userId: String(userId), cartItemId: String(cartItemId) });
  return ok(res, { deleted: true });
  // or return noContent(res);
});

// DELETE /api/v1/cart
export const clearCart = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  await clearCartService(userId);
  return ok(res, { cleared: true });
});
