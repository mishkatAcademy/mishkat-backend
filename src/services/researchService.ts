// src/services/researchService.ts
import { isBefore } from 'date-fns';
import type { FilterQuery } from 'mongoose';
import ResearchRequest, { IResearchRequest, ResearchStatus } from '../models/ResearchRequest';
import AppError from '../utils/AppError';
import { moveDiskFileToUploads, deleteLocalByRelPath } from './localFiles.disk';
import { toRiyadhYMD } from '../utils/time';

import path from 'path';
import { getAbsolutePath } from '../services/localFiles.disk';
import type { Role } from '../types';

type CreateInput = {
  userId: string;
  body: {
    specialization: IResearchRequest['specialization'];
    nature: IResearchRequest['nature'];
    serviceType: IResearchRequest['serviceType'];
    name: string;
    whatsapp: string;
    email: string;
    researchTitle: string;
    description?: string;
    proposedDueDate: string; // YYYY-MM-DD
  };
  files: Express.Multer.File[];
};

export async function downloadMyResearchAttachmentService(
  requester: { userId: string; role: Role },
  researchId: string,
  attachmentId: string,
) {
  const doc = await ResearchRequest.findById(researchId).lean();
  if (!doc || doc.isDeleted) throw AppError.notFound('طلب غير موجود');
  if (String(doc.user) !== String(requester.userId)) throw AppError.forbidden('ليس طلبك');

  const isOwner = String(doc.user) === String(requester.userId);
  const isPrivileged = requester.role === 'admin' || requester.role === 'instructor';

  if (!isOwner && !isPrivileged) {
    throw AppError.forbidden('ليس لديك صلاحية تحميل هذا الملف');
  }

  const att = (doc.attachments || []).find((a: any) => String(a._id) === attachmentId);
  if (!att) throw AppError.notFound('ملف غير موجود');

  const abs = getAbsolutePath(att.relativePath);
  return { abs, att };
}

export async function createResearchRequestService({ userId, body, files }: CreateInput) {
  // ✅ السماح بتاريخ اليوم (توقيت الرياض) ومنع الماضي
  const todayYMD = toRiyadhYMD(new Date());
  if (body.proposedDueDate < todayYMD) {
    throw AppError.badRequest('تاريخ التسليم المقترح لا يمكن أن يكون في الماضي');
  }

  // ✅ انقل الملفات من uploads_tmp → uploads النهائي
  const moved: { relPath: string }[] = [];
  try {
    const stored = await Promise.all(
      (files || []).map((f) => moveDiskFileToUploads(f, `research/${userId}`)),
    );

    const attachments = stored.map((s, idx) => ({
      originalName: files[idx].originalname,
      storedName: s.filename,
      mimeType: files[idx].mimetype,
      size: s.size,
      relativePath: s.relPath, // ✅ ده اللي يتحفظ في DB
      // (اختياري) url: s.url
    }));

    moved.push(...stored.map((s) => ({ relPath: s.relPath })));

    const doc = await ResearchRequest.create({
      user: userId,
      specialization: body.specialization,
      nature: body.nature,
      serviceType: body.serviceType,
      name: body.name,
      whatsapp: body.whatsapp,
      email: body.email,
      researchTitle: body.researchTitle,
      description: body.description,
      proposedDueDate: body.proposedDueDate,
      attachments: stored.map((s, idx) => ({
        originalName: files[idx].originalname,
        storedName: s.filename,
        mimeType: files[idx].mimetype,
        size: s.size,
        relativePath: s.relPath,
        url: 'pending', // مؤقت
      })),
      status: 'new',
    });

    doc.attachments = doc.attachments.map((a: any) => ({
      ...a.toObject(),
      url: `/api/v1/research/me/research/${doc._id}/attachments/${a._id}/download`,
    }));

    await doc.save();
    return doc.toJSON();
  } catch (err) {
    // ✅ Rollback: لو نقلنا ملفات وبعدين حصل error في DB
    await Promise.all(moved.map((m) => deleteLocalByRelPath(m.relPath)));
    throw err;
  }
}

/** طلباتي */
export async function listMyResearchRequestsService(userId: string, page = 1, limit = 10) {
  const safePage = Math.max(1, page | 0);
  const safeLimit = Math.min(100, Math.max(1, limit | 0));
  const skip = (safePage - 1) * safeLimit;

  const q = { user: userId, isDeleted: false };

  const [items, total] = await Promise.all([
    ResearchRequest.find(q).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    ResearchRequest.countDocuments(q),
  ]);

  const pages = Math.max(1, Math.ceil(total / safeLimit));
  return {
    items,
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      pages,
      hasNextPage: safePage < pages,
      hasPrevPage: safePage > 1,
    },
  };
}

export async function getMyResearchRequestService(userId: string, id: string) {
  const doc = await ResearchRequest.findById(id).lean();
  if (!doc || doc.isDeleted) throw AppError.notFound('طلب غير موجود');
  if (String(doc.user) !== String(userId)) throw AppError.forbidden('ليس طلبك');
  return doc;
}

/** للإدمن: لستة مع فلاتر اختيارية */
export async function adminListResearchRequestsService(params: {
  page?: number;
  limit?: number;
  status?: ResearchStatus;
  specialization?: IResearchRequest['specialization'];
  nature?: IResearchRequest['nature'];
  serviceType?: IResearchRequest['serviceType'];
  search?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  const q: FilterQuery<IResearchRequest> = { isDeleted: false };

  if (params.status) q.status = params.status;
  if (params.specialization) q.specialization = params.specialization;
  if (params.nature) q.nature = params.nature;
  if (params.serviceType) q.serviceType = params.serviceType;

  if (params.search) {
    const r = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [{ name: r }, { email: r }, { researchTitle: r }];
  }

  // فلترة بالتواريخ (createdAt)
  if (params.from || params.to) {
    q.createdAt = {};
    if (params.from) q.createdAt.$gte = new Date(params.from + 'T00:00:00Z');
    if (params.to) q.createdAt.$lte = new Date(params.to + 'T23:59:59Z');
  }

  const [items, total] = await Promise.all([
    ResearchRequest.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ResearchRequest.countDocuments(q),
  ]);

  const pages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    meta: { total, page, limit, pages, hasNextPage: page < pages, hasPrevPage: page > 1 },
  };
}

export async function adminGetResearchRequestService(id: string) {
  const doc = await ResearchRequest.findById(id).lean();
  if (!doc || doc.isDeleted) throw AppError.notFound('طلب غير موجود');
  return doc;
}

export async function adminUpdateResearchRequestService(
  id: string,
  updates: { status?: ResearchStatus; adminNotes?: string },
) {
  const doc = await ResearchRequest.findById(id);
  if (!doc || doc.isDeleted) throw AppError.notFound('طلب غير موجود');

  if (typeof updates.status !== 'undefined') doc.status = updates.status;
  if (typeof updates.adminNotes !== 'undefined') doc.adminNotes = updates.adminNotes;

  await doc.save();
  return doc.toJSON();
}
