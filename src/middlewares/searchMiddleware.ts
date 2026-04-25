// src/middlewares/searchMiddleware.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Model, FilterQuery } from 'mongoose';
import { searchInModel } from '../utils/searchHelper';
import { ok } from '../utils/response';

type SortOrderStr = 'asc' | 'desc';

interface PopulateConfig {
  path: string;
  select?: string;
  match?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

interface SearchConfig<T> {
  model: Model<T>;
  fields: (keyof T)[];

  defaultFilters?: FilterQuery<T>;

  maxLimit?: number;

  allowedSortBy?: (keyof T)[];

  allowedFilterKeys?: (keyof T)[];

  defaultSelect?: string;

  lean?: boolean;

  populate?: PopulateConfig | PopulateConfig[];
}

const isNumeric = (v: unknown) => typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v));

const toPrimitive = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(toPrimitive);
  if (typeof v !== 'string') return v;

  const val = v.trim();

  // boolean
  if (val.toLowerCase() === 'true') return true;
  if (val.toLowerCase() === 'false') return false;

  // null/undefined
  if (val.toLowerCase() === 'null') return null;
  if (val.toLowerCase() === 'undefined') return undefined;

  // number
  if (isNumeric(val)) return Number(val);

  // ISO date
  const d = new Date(val);
  if (!isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(val)) return d;

  // otherwise string
  return val;
};

/** price[gte]=10  ==> { price: { $gte: 10 } } */
const applyOperator = (obj: any, key: string, rawVal: any) => {
  const m = key.match(/^(.+)\[(gte|gt|lte|lt|ne|in|nin|regex|between)\]$/);
  if (!m) {
    obj[key] = toPrimitive(rawVal);
    return;
  }
  const [, field, op] = m;
  const v = toPrimitive(rawVal);

  if (op === 'between') {
    // between=start,end
    const arr = typeof v === 'string' ? v.split(',').map((x) => toPrimitive(x)) : v;
    const [from, to] = Array.isArray(arr) ? arr : [undefined, undefined];
    obj[field] = {
      ...(from !== undefined ? { $gte: from } : {}),
      ...(to !== undefined ? { $lte: to } : {}),
    };
    return;
  }

  const map: Record<string, string> = {
    gte: '$gte',
    gt: '$gt',
    lte: '$lte',
    lt: '$lt',
    ne: '$ne',
    in: '$in',
    nin: '$nin',
    regex: '$regex',
  };
  const mongoOp = map[op];

  let value: any = v;
  if ((op === 'in' || op === 'nin') && typeof v === 'string') {
    value = v.split(',').map((x) => toPrimitive(x));
  }
  if (op === 'regex' && typeof v === 'string') {

    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    value = new RegExp(escaped, 'i');
  }

  obj[field] = { ...(obj[field] || {}), [mongoOp]: value };
};

const buildFilters = <T>(
  raw: Record<string, unknown>,
  allowedFilterKeys?: (keyof T)[],
): FilterQuery<T> => {
  const filters: Record<string, any> = {};

  Object.entries(raw).forEach(([k, v]) => {
    if (v === undefined) return;

    if (
      k === 'searchTerm' ||
      k === 'page' ||
      k === 'limit' ||
      k === 'sortBy' ||
      k === 'order' ||
      k === 'select'
    ) {
      return;
    }

    const baseKey = k.replace(/\[(gte|gt|lte|lt|ne|in|nin|regex|between)\]$/, '');
    if (allowedFilterKeys && !allowedFilterKeys.includes(baseKey as keyof T)) {
      return;
    }

    applyOperator(filters, k, v);
  });

  return filters as FilterQuery<T>;
};

export const searchMiddleware = <T>({
  model,
  fields,
  defaultFilters = {} as FilterQuery<T>,
  maxLimit = 100,
  allowedSortBy,
  allowedFilterKeys,
  defaultSelect,
  lean = false,
  populate,
}: SearchConfig<T>): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = (req.validated?.query as Record<string, unknown>) ?? (req.query as any);

      // 1) search term
      const searchTerm =
        typeof q?.searchTerm === 'string' && q.searchTerm.trim() ? q.searchTerm.trim() : undefined;

      // 2) pagination (مع سقف للـ limit)
      const toPosInt = (val: unknown, def: number) => {
        const n = typeof val === 'string' ? parseInt(val, 10) : Number(val);
        return Number.isFinite(n) && n > 0 ? n : def;
      };

      const page = Math.max(toPosInt(q?.page, 1), 1);
      let limit = toPosInt(q?.limit, 10);
      if (limit > maxLimit) limit = maxLimit;

      // 3) sorting (مع whitelist اختيارية)
      const sortByRaw = typeof q?.sortBy === 'string' ? q.sortBy : undefined;
      const order: 'asc' | 'desc' = String(q?.order) === 'desc' ? 'desc' : 'asc';

      let sortBy: keyof T | undefined;
      if (sortByRaw) {
        if (!allowedSortBy || (allowedSortBy as string[]).includes(sortByRaw)) {
          sortBy = sortByRaw as keyof T;
        }
      }

      // 4) select: إمّا من المستخدم أو defaultSelect
      const userSelect = typeof q?.select === 'string' ? q.select : undefined;
      const select = userSelect || defaultSelect;

      // 5) filters: من باقي الـ query بعد استبعاد مفاتيح التحكم
      const {
        searchTerm: _st,
        page: _pg,
        limit: _lm,
        sortBy: _sb,
        order: _or,
        select: _sel,
        ...rawFilters
      } = q || ({} as any);

      const parsedFilters = buildFilters<T>(
        rawFilters as Record<string, unknown>,
        allowedFilterKeys,
      );

      const finalFilters: FilterQuery<T> = {
        ...(defaultFilters || {}),
        ...(parsedFilters || {}),
      };

      // 6) إعدادات إضافية للبحث
      const extraOptions: Record<string, unknown> = {
        select,
        lean,
        populate,
      };

      // 7) البحث
      const result = await searchInModel<T>({
        model: model as Model<T>,
        fields,
        searchTerm,
        filters: finalFilters,
        page,
        limit,
        sortBy,
        order,
        ...extraOptions,
      } as any);

      // 8) استجابة موحّدة
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  };
};
