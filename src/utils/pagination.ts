// src/utils/pagination.ts
import type { Request } from 'express';
import type { Document, Query } from 'mongoose';
import { buildMeta, type PaginatedResult } from '../types';

/* ------------------------------------------------------------------ */
/* Types & Helpers                                                     */
/* ------------------------------------------------------------------ */

type SortOrder = 1 | -1;
export type SortObject = Record<string, SortOrder>;

export interface PaginationOptions {
  /** الصفحة الافتراضية */
  defaultPage?: number; // default: 1
  /** الحد الافتراضي لعدد العناصر بالصفحة */
  defaultLimit?: number; // default: 10
  /** الحد الأقصى المسموح به */
  maxLimit?: number; // default: 100
  /** الفرز الافتراضي */
  defaultSort?: string | SortObject; // default: '-createdAt'
  /**
   * قائمة بيضاء لأسماء الحقول المسموح الفرز بها.
   * تُستخدم لكلٍ من sortBy / sort (عند تحليلها لسلسلة).
   */
  allowedSortBy?: string[];
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
  /** يسلَّم كما هو لـ Mongoose: string أو object */
  sort: string | SortObject;
}

/** مفاتيح خطرة نمنع استخدامها كحقول فرز (احترازًا) */
const FORBIDDEN_FIELDS = new Set(['__proto__', 'constructor', 'prototype']);

/** تحويل قيمة إلى عدد صحيح موجب (وإلا نرجع الافتراضي) */
const toPosInt = (v: unknown, def: number) => {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

/** تنظيف اسم الحقل مع منع المفاتيح الخطرة */
const safeField = (name: string) => {
  const f = name.trim();
  if (!f || FORBIDDEN_FIELDS.has(f)) return null;
  return f;
};

/**
 * يحلّل صيغة sort النصية مثل: "-createdAt,price"
 * ويراعي allowedSortBy إن وُجدت.
 * يرجّع SortObject إن أمكن، وإلا يعيد النص كما هو.
 */
function parseSortString(input: string, allowedSortBy?: string[]): string | SortObject {
  const parts = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!parts.length) return input;

  const obj: SortObject = {};

  for (const p of parts) {
    let dir: SortOrder = 1;
    let field = p;

    if (p.startsWith('-')) {
      dir = -1;
      field = p.slice(1);
    } else if (p.startsWith('+')) {
      dir = 1;
      field = p.slice(1);
    }

    const cleaned = safeField(field);
    if (!cleaned) continue;

    if (allowedSortBy && !allowedSortBy.includes(cleaned)) {
      // لو فيه whitelist ونفس الحقل غير مسموح، نتجاهله
      continue;
    }

    obj[cleaned] = dir;
  }

  // لو طلع كائن صالح نرجّعه، وإلا نعيد النص الأصلي
  return Object.keys(obj).length ? obj : input;
}

/* ------------------------------------------------------------------ */
/* API                                                                */
/* ------------------------------------------------------------------ */

/**
 * ✅ getPagination
 * - يقرأ القيم من req.validated?.query (لو موجود) وإلا من req.query
 * - يدعم:
 *   1) sortBy=<field>&order=asc|desc (مع whitelist اختيارية)
 *   2) sort كسلسلة جاهزة: "-createdAt,price" (مع تحليل/Whitelist احتياطي)
 * - يرجّع page/limit/skip/sort
 */
export function getPagination(req: Request, opts: PaginationOptions = {}): PaginationResult {
  const {
    defaultPage = 1,
    defaultLimit = 10,
    maxLimit = 100,
    defaultSort = '-createdAt',
    allowedSortBy,
  } = opts;

  // نقرأ من validated.query (لو متاحة من Zod) وإلا req.query
  const q = (req.validated?.query as Record<string, unknown>) ?? (req.query as any);

  // رقم الصفحة والحد
  const page = Math.max(1, toPosInt(q?.page, defaultPage));

  let limit = toPosInt(q?.limit, defaultLimit);
  if (limit > maxLimit) limit = maxLimit;

  // الفرز:
  // أ) sortBy + order
  const sortBy = typeof q?.sortBy === 'string' ? q.sortBy : undefined;
  const orderRaw = String(q?.order ?? '').toLowerCase();
  const order: SortOrder = orderRaw === 'desc' || orderRaw === '-1' ? -1 : 1;

  let sort: string | SortObject = defaultSort;

  if (sortBy) {
    const cleaned = safeField(sortBy);
    if (cleaned && (!allowedSortBy || allowedSortBy.includes(cleaned))) {
      sort = { [cleaned]: order } as SortObject;
    }
  } else if (typeof q?.sort === 'string' && q.sort.trim()) {
    // ب) سلسلة جاهزة: نحاول تحليلها واحترام الـ whitelist إن وُجدت
    sort = parseSortString(q.sort.trim(), allowedSortBy);
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip, sort };
}

/**
 * ✅ applySort
 * - أداة مساعدة لتطبيق الفرز على Query.
 * - تقبل string أو object كما هو.
 */
export function applySort<T extends Document>(
  query: Query<T[], T>,
  sort: string | SortObject,
): Query<T[], T> {
  return query.sort(sort as any);
}

/**
 * ✅ paginate
 * - يستقبل Query للبيانات + Query للعدّ الإجمالي
 * - يطبّق skip/limit على Query البيانات
 * - يرجّع { data, meta } حيث meta مبنية بـ buildMeta(total, page, limit)
 */
export async function paginate<T extends Document>(
  dataQuery: Query<T[], T>,
  countQuery: Query<number, T>,
  page: number,
  limit: number,
): Promise<PaginatedResult<T>> {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([dataQuery.skip(skip).limit(limit), countQuery]);

  return { data, meta: buildMeta(total, page, limit) };
}
