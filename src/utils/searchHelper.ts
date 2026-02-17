// src/utils/searchHelper.ts
import type {
  FilterQuery,
  Model,
  SortOrder,
  PopulateOptions,
  ProjectionType,
  QueryOptions,
  HydratedDocument,
} from 'mongoose';
import { Types } from 'mongoose';
import type { CollationOptions, ReadPreferenceLike } from 'mongodb';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type Order = 'asc' | 'desc';
type RegexMode = 'contains' | 'prefix' | 'suffix';

export interface SearchOptions<T> {
  model: Model<T>;

  /** الحقول اللي هنعمل عليها regex OR */
  fields?: (keyof T)[];
  searchTerm?: string;

  /** فلاتر إضافية */
  filters?: FilterQuery<T>;

  /** Pagination */
  page?: number;
  limit?: number;
  maxLimit?: number;

  /** Sorting */
  sortBy?: keyof T;
  order?: Order;
  sort?: Record<string, 1 | -1>;
  /** قائمة بيضاء اختيارية لحقول الفرز المسموح بها */
  allowedSortBy?: string[];

  /** إسامي متوافقة: select/projection */
  select?: string | ProjectionType<T>;
  projection?: ProjectionType<T>;

  /** تحسينات */
  populate?: string | PopulateOptions | (string | PopulateOptions)[];
  lean?: boolean | { getters?: boolean };
  collation?: CollationOptions;
  allowDiskUse?: boolean; // ⚠️ غالبًا مفيدة مع aggregation فقط
  hint?: string | Record<string, 1 | -1>;
  readPreference?: ReadPreferenceLike;
  queryOptions?: QueryOptions;

  /** بحث نصي عبر $text (اختياري لو عامل Text Index) */
  useTextSearch?: boolean;
  textLanguage?: string; // مثال: "ar" | "en"

  /** إعدادات Regex */
  regexMode?: RegexMode; // "contains" (افتراضي) | "prefix" | "suffix"
  maxRegexLength?: number; // افتراضي 128

  /** Cursor (اختياري) */
  afterId?: string; // لو حابب تستخدمه بدل skip/limit
}

export interface SearchResult<T> {
  results: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor: string | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** نهرب (escape) مصطلح البحث للـ Regex */
function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** مفاتيح خطرة نمنع استخدامها كحقول فرز (احترازًا) */
const FORBIDDEN_FIELDS = new Set(['__proto__', 'constructor', 'prototype']);

/** تنظيف اسم الحقل مع منع المفاتيح الخطرة */
const safeField = (name: string) => {
  const f = String(name).trim();
  if (!f || FORBIDDEN_FIELDS.has(f)) return null;
  return f;
};

/** تطبيق whitelist على كائن الفرز لو متاحة */
function sanitizeSortObject(
  sort: Record<string, 1 | -1>,
  allowedSortBy?: string[],
): Record<string, 1 | -1> {
  const out: Record<string, 1 | -1> = {};
  for (const [k, v] of Object.entries(sort)) {
    const cleaned = safeField(k);
    if (!cleaned) continue;
    if (allowedSortBy && !allowedSortBy.includes(cleaned)) continue;
    out[cleaned] = v === -1 ? -1 : 1;
  }
  return out;
}

/** تحليل صيغة sort النصية مثل: "-createdAt,price" */
function parseSortString(input: string, allowedSortBy?: string[]): string | Record<string, 1 | -1> {
  const parts = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!parts.length) return input;

  const obj: Record<string, 1 | -1> = {};
  for (const p of parts) {
    let dir: 1 | -1 = 1;
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
    if (allowedSortBy && !allowedSortBy.includes(cleaned)) continue;

    obj[cleaned] = dir;
  }
  return Object.keys(obj).length ? obj : input;
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

/**
 * ✅ searchInModel
 * - يبني استعلام مرن بـ filters + (Regex OR على fields) + $text اختياري.
 * - يدعم pagination (skip/limit) أو cursor بـ afterId.
 * - لا يلمس req.query إطلاقًا — ده Helper مستقل.
 */
export async function searchInModel<T>({
  model,
  fields = [],
  searchTerm,
  filters = {},
  page = 1,
  limit = 10,
  maxLimit = 100,
  sortBy,
  order = 'asc',
  sort,
  allowedSortBy,
  select,
  projection,
  populate,
  lean = true,
  collation = { locale: 'ar', strength: 1, numericOrdering: true },
  allowDiskUse,
  hint,
  readPreference,
  queryOptions,
  useTextSearch = false,
  textLanguage,
  regexMode = 'contains',
  maxRegexLength = 128,
  afterId,
}: SearchOptions<T>): Promise<SearchResult<T>> {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), maxLimit);

  /* ========= بناء شرط البحث ========= */
  const clauses: FilterQuery<T>[] = [];
  clauses.push(filters); // فلاتر أساسية

  // بحث Regex على الحقول
  let slicedTerm = typeof searchTerm === 'string' ? searchTerm.trim() : '';
  if (slicedTerm && fields.length > 0) {
    if (slicedTerm.length > maxRegexLength) {
      slicedTerm = slicedTerm.slice(0, maxRegexLength);
    }
    let pattern = escapeRegex(slicedTerm);
    if (regexMode === 'prefix') pattern = `^${pattern}`;
    else if (regexMode === 'suffix') pattern = `${pattern}$`;

    const orQuery = fields.map((field) => ({
      [field as string]: { $regex: new RegExp(pattern, 'i') },
    }));
    clauses.push({ $or: orQuery as FilterQuery<T>[] });
  }

  // بحث $text (لو مفعّل ومتاح index)
  if (useTextSearch && searchTerm) {
    const textExpr: any = { $search: searchTerm };
    if (textLanguage) textExpr.$language = textLanguage;
    clauses.push({ $text: textExpr } as FilterQuery<T>);
  }

  const finalQuery: FilterQuery<T> =
    clauses.length > 1 ? ({ $and: clauses } as any) : clauses[0] || {};

  /* ========= Pagination (skip/limit أو cursor) ========= */
  let skip = 0;
  if (!afterId) {
    skip = (safePage - 1) * safeLimit;
  } else {
    // استخدم ObjectId حقيقي لو صالح
    if (Types.ObjectId.isValid(afterId)) {
      const after = new Types.ObjectId(afterId);
      const op = order === 'asc' ? '$gt' : '$lt';
      (finalQuery as any)._id = { ...(finalQuery as any)._id, [op]: after };
    } // لو مش صالح نتجاهل الـ cursor بهدوء
  }

  /* ========= Sorting ========= */
  let sortOptions: Record<string, SortOrder> | any = {};
  if (sort && Object.keys(sort).length > 0) {
    sortOptions = sanitizeSortObject(sort, allowedSortBy);
  } else if (useTextSearch) {
    // رتب بالـ textScore desc
    sortOptions = { score: { $meta: 'textScore' } };
  } else if (sortBy) {
    const cleaned = safeField(String(sortBy));
    if (cleaned && (!allowedSortBy || allowedSortBy.includes(cleaned))) {
      sortOptions = { [cleaned]: order === 'asc' ? 1 : -1 } as Record<string, SortOrder>;
    }
  } else {
    // fallback آمن
    sortOptions = { createdAt: -1, _id: -1 } as Record<string, SortOrder>;
  }

  /* ========= Projection / Select ========= */
  let findProjection: any = select ?? projection ?? undefined;

  // لو بنرتّب بالـ textScore لازم نرجّع الـ score في projection
  if (useTextSearch) {
    if (!findProjection || typeof findProjection !== 'object') findProjection = {};
    findProjection = { ...findProjection, score: { $meta: 'textScore' } };
  }

  /* ========= تنفيذ الاستعلام ========= */
  let query = model
    .find(finalQuery, findProjection, queryOptions)
    .sort(sortOptions)
    .limit(safeLimit);

  if (!afterId) query = query.skip(skip);
  if (collation) query = query.collation(collation);
  if (populate) query = query.populate(populate as any);
  if (hint) query = query.hint(hint as any);
  if (readPreference) (query as any).read(readPreference);

  // ⚠️ allowDiskUse عادةً للـ aggregation؛ بعض الإصدارات قد تتجاهله في find
  if (allowDiskUse && typeof (query as any).allowDiskUse === 'function') {
    (query as any).allowDiskUse();
  }

  if (lean) {
    query = (query as any).lean(lean === true ? { getters: true } : lean);
  }

  const [results, total] = await Promise.all([query.exec(), model.countDocuments(finalQuery)]);

  const pages = Math.max(1, Math.ceil(total / safeLimit));
  const hasNextPage = afterId ? (results as any[]).length === safeLimit : safePage < pages;
  const hasPrevPage = afterId ? false : safePage > 1;
  const last = (results as any[])[(results as any[]).length - 1] as
    | (HydratedDocument<T> & { _id?: any })
    | undefined;
  const nextCursor = last && last._id ? String(last._id) : null;

  return {
    results: results as unknown as T[],
    total,
    page: afterId ? 1 : safePage,
    limit: safeLimit,
    pages: afterId ? 1 : pages,
    hasNextPage,
    hasPrevPage,
    nextCursor,
  };
}
