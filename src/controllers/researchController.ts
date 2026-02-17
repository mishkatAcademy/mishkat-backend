// src/controllers/researchController.ts
import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ok, created } from '../utils/response';
import {
  createResearchRequestService,
  listMyResearchRequestsService,
  getMyResearchRequestService,
  adminListResearchRequestsService,
  adminGetResearchRequestService,
  adminUpdateResearchRequestService,
  downloadMyResearchAttachmentService,
} from '../services/researchService';
import type { Role } from '../types';

export const downloadMyResearchAttachmentCtrl = catchAsync(async (req, res) => {
  const requester = {
    userId: req.user!.id.toString(),
    role: req.user!.role as Role,
  };

  const { id, attachmentId } = req.params;

  const { abs, att } = await downloadMyResearchAttachmentService(requester, id, attachmentId);

  const filename = att.originalName || 'file';
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );

  if (att.mimeType) res.setHeader('Content-Type', att.mimeType);

  return res.download(abs);
});

/** POST /research/requests (user) */
export const createResearchCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id.toString();
  // const files = (req.files as Express.Multer.File[]) || [];
  const files = ((req.files as Record<string, Express.Multer.File[]>)?.files ??
    []) as Express.Multer.File[];
  const body = req.validated?.body || req.body;

  const doc = await createResearchRequestService({ userId, body, files });
  return created(res, { request: doc });
});

/** GET /me/research (user) */
export const listMyResearchCtrl = catchAsync(async (req: Request, res: Response) => {
  // تأكيد المصادقة
  const userId = req.user?.id;
  // خُد القيم من validated.query لو موجودة، وإلا ارجع لـ req.query
  const vq =
    (req.validated?.query as Partial<{ page: number | string; limit: number | string }>) ?? {};
  const rawPage = vq.page ?? (req.query as any)?.page;
  const rawLimit = vq.limit ?? (req.query as any)?.limit;

  // تحويلات آمنة + حدود منطقية
  const toPosInt = (val: unknown, def: number) => {
    const n = typeof val === 'string' ? parseInt(val, 10) : Number(val);
    return Number.isFinite(n) && n > 0 ? n : def;
  };

  const page = toPosInt(rawPage, 1);
  let limit = toPosInt(rawLimit, 10);
  if (limit > 100) limit = 100; // سقف معقول

  const result = await listMyResearchRequestsService(String(userId), page, limit);
  return ok(res, result.items, result.meta);
});

/** GET /me/research/:id (user) */
export const getMyResearchCtrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id.toString();
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  const doc = await getMyResearchRequestService(userId, id);
  return ok(res, { request: doc });
});

/** ============ Admin ============ */

/** GET /research (admin) */
export const adminListResearchCtrl = catchAsync(async (req: Request, res: Response) => {
  const q = req.validated?.query as any;
  const result = await adminListResearchRequestsService(q);
  return ok(res, result.items, result.meta);
});

/** GET /research/:id (admin) */
export const adminGetResearchCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  const doc = await adminGetResearchRequestService(id);
  return ok(res, { request: doc });
});

/** PATCH /research/:id (admin) */
export const adminUpdateResearchCtrl = catchAsync(async (req: Request, res: Response) => {
  const { id } = (req.validated?.params as { id: string }) ?? req.params;
  const body = req.validated?.body || req.body;
  const doc = await adminUpdateResearchRequestService(id, body);
  return ok(res, { request: doc });
});
