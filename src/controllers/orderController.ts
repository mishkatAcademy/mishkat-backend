// src/controllers/orderController.ts
import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok, created } from '../utils/response';
import {
  createOrderFromCart,
  handleMoyasarWebhook,
  listMyOrders,
  getMyOrder,
} from '../services/orderService';
import AppError from '../utils/AppError';

export const createOrderCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id.toString();

  const idempotencyKey = (req.validated?.headers as any)?.['idempotency-key'] as string | undefined;

  const { cartItemId, addressId, notes, paymentMethod } = req.validated?.body ?? req.body ?? {};
  if (paymentMethod !== 'moyasar') throw AppError.badRequest('Unsupported payment method');

  const { order, paymentUrl } = await createOrderFromCart(userId, {
    cartItemId,
    addressId,
    notes,
    idempotencyKey,
  });

  return created(res, { order, paymentUrl });
});

export const listMyOrdersCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw AppError.unauthorized('غير مصرح: المستخدم غير معرّف');

  const { page: qPage, limit: qLimit } =
    (req.validated?.query as { page?: number | string; limit?: number | string }) ?? {};

  const page = Math.max(1, Number(qPage ?? 1));
  const limit = Math.max(1, Math.min(100, Number(qLimit ?? 10)));

  const result = await listMyOrders(userId, page, limit);

  return ok(res, result);
});

export const getMyOrderCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id.toString();

  const { id } = (req.validated?.params as { id: string }) ?? req.params;

  const order = await getMyOrder(userId, id);
  return ok(res, { order });
});

/** Webhook (public, no auth) */
export const moyasarWebhookCtrl = catchAsync(async (req: Request, res: Response) => {
  const result = await handleMoyasarWebhook(req.body);
  return ok(res, result);
});
