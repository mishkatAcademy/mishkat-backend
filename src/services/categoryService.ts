// src/services/categoryService.ts
import Category, { ICategory, CategoryScope } from '../models/Category';
import AppError from '../utils/AppError';
import { slugFromLocalized, makeUniqueSlug } from '../utils/slug';

type ListInput = {
  page?: number;
  limit?: number;
  scope?: CategoryScope;
  nonEmpty?: boolean;
  includeDeleted?: boolean;
  sort?: string; // "order:asc,createdAt:desc"
  search?: string;
};

/* ---------------- Sort helpers (whitelist) ---------------- */
const ALLOWED_SORT_FIELDS = new Set<'order' | 'createdAt' | 'booksCount' | 'coursesCount'>([
  'order',
  'createdAt',
  'booksCount',
  'coursesCount',
]);

function parseSort(sortStr?: string): Record<string, 1 | -1> {
  const s = (sortStr || '').trim();
  if (!s) return { order: 1, createdAt: -1 };

  const out: Record<string, 1 | -1> = {};
  for (const part of s.split(',')) {
    const [rawField, rawDir] = part.split(':').map((x) => x.trim());
    if (!rawField || !ALLOWED_SORT_FIELDS.has(rawField as any)) continue;
    out[rawField] = rawDir?.toLowerCase() === 'asc' ? 1 : -1;
  }
  return Object.keys(out).length ? out : { order: 1, createdAt: -1 };
}

/* -------------- lean-normalize (id بدل _id + إخفاء isDeleted) -------------- */
function normalizeLean<T extends { _id?: any; isDeleted?: any }>(doc: T) {
  if (!doc) return doc;
  const { _id, isDeleted, ...rest } = doc as any;
  return { id: String(_id), ...rest };
}

/* ========================== Create ========================== */
export async function createCategory(data: {
  title: ICategory['title'];
  description?: ICategory['description'];
  image?: string;
  scopes?: CategoryScope[];
  order?: number;
}) {
  const baseSlug = slugFromLocalized(data.title);

  const slug = await makeUniqueSlug(Category, baseSlug, {
    filter: { isDeleted: false },
  });

  // 3) إنشاء
  const cat = await Category.create({
    title: data.title,
    description: data.description,
    image: data.image,
    scopes: data.scopes?.length ? data.scopes : ['book', 'course'],
    slug,
    order: data.order ?? 0,
  });

  return cat.toJSON();
}

/* ========================== List ========================== */
export async function listCategories(input: ListInput) {
  const page = Math.max(1, input.page || 1);
  const limit = Math.min(100, Math.max(1, input.limit || 10));
  const skip = (page - 1) * limit;

  const q: any = {};
  if (!input.includeDeleted) q.isDeleted = false;

  if (input.scope) q.scopes = input.scope;

  if (input.nonEmpty) {
    if (input.scope === 'book') q.booksCount = { $gt: 0 };
    else if (input.scope === 'course') q.coursesCount = { $gt: 0 };
    else q.$or = [{ booksCount: { $gt: 0 } }, { coursesCount: { $gt: 0 } }];
  }

  if (input.search) {
    const safe = input.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const r = new RegExp(safe, 'i');
    q.$or = [...(q.$or || []), { 'title.ar': r }, { 'title.en': r }, { slug: r }];
  }

  const sort = parseSort(input.sort);

  const [rawItems, total] = await Promise.all([
    Category.find(q).select('-isDeleted').sort(sort).skip(skip).limit(limit).lean(),
    Category.countDocuments(q),
  ]);

  const items = rawItems.map(normalizeLean);

  const pages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    meta: {
      total,
      page,
      limit,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    },
  };
}

/* ========================== Get one ========================== */
export async function getCategory(id: string) {
  const cat = await Category.findById(id).lean();
  if (!cat || cat.isDeleted) throw AppError.notFound('Category not found');
  return normalizeLean(cat);
}

/* ========================== Update ========================== */
export async function updateCategory(
  id: string,
  data: {
    title?: ICategory['title'];
    description?: ICategory['description'];
    image?: string;
    scopes?: CategoryScope[];
    order?: number;
  },
) {
  const cat = await Category.findById(id);
  if (!cat || cat.isDeleted) throw AppError.notFound('Category not found');

  if (data.title) {
    cat.title = data.title;
    const baseSlug = slugFromLocalized(data.title);

    cat.slug = await makeUniqueSlug(Category, baseSlug, {
      excludeId: String(cat._id),
      filter: { isDeleted: false },
    });
  }

  if (typeof data.description !== 'undefined') cat.description = data.description;
  if (typeof data.image !== 'undefined') cat.image = data.image;
  if (Array.isArray(data.scopes) && data.scopes.length) cat.scopes = data.scopes;
  if (typeof data.order === 'number') cat.order = data.order;

  await cat.save();
  return cat.toJSON();
}

/* ========================== Soft delete / restore ========================== */
export async function softDeleteCategory(id: string) {
  const cat = await Category.findById(id);
  if (!cat || cat.isDeleted) throw AppError.notFound('Category not found or already deleted');
  cat.isDeleted = true;
  await cat.save();
}

export async function restoreCategory(id: string) {
  const cat = await Category.findById(id);
  if (!cat) throw AppError.notFound('Category not found');
  if (!cat.isDeleted) return; // already active

  const desired = cat.slug || slugFromLocalized(cat.title);
  const unique = await makeUniqueSlug(Category, desired, {
    excludeId: String(cat._id),
    filter: { isDeleted: false },
  });
  cat.slug = unique;
  cat.isDeleted = false;
  await cat.save();
}
