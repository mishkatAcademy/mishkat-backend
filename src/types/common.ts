// src/types/common.ts
import type { Types } from 'mongoose';

/** نوع عام للـ IDs (string أو ObjectId) */
export type Id = string | Types.ObjectId;

/** إضافة createdAt / updatedAt لأي نوع */
export type WithTimestamps<T = unknown> = T & {
  createdAt?: Date;
  updatedAt?: Date;
};

/** نتيجة خدمة بسيطة: ok / error */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export type Nullable<T> = T | null;
export type Undefinable<T> = T | undefined;

/** فلاتر عامة (للسيرش وغيره) */
export interface QueryFilters {
  search?: string;
  isDeleted?: boolean;
  [key: string]: unknown;
}

/** ميتا عامة لأي ملف بنخزّنه على السيرفر (local storage) */
export interface FileMeta {
  url: string; // رابط عام لو الملف public (أو رابط الـ download endpoint لو protected)
  relPath: string; // المسار النسبي تحت uploads/... نستخدمه للحذف أو sendFile
  filename?: string;
  mime?: string | null;
  size?: number;
}

/* ================= Pagination Helpers ================= */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/** دالة مساعدة لبناء ميتا الترقيم */
export function buildMeta(total: number, page: number = 1, limit: number = 10): PaginationMeta {
  const safePage = Math.max(1, page || 1);
  const safeLimit = Math.max(1, limit || 10);
  const pages = Math.max(1, Math.ceil(total / safeLimit));

  return {
    page: safePage,
    limit: safeLimit,
    total,
    pages,
    hasNext: safePage < pages,
    hasPrev: safePage > 1,
  };
}
