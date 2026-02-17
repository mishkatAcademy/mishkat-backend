// src/utils/slug.ts
import slugifyLib from 'slugify';
import type { Model, FilterQuery } from 'mongoose';

export type LocalizedText = { ar?: string; en?: string };

/**
 * حوّل عنوان محلّي إلى slug أساسي
 * - يدعم تعدد اللغات (ar/en) مع ترتيب تفضيل
 * - لو مفيش عنوان خالص، نستخدم fallback (افتراضي: "item")
 */
export function slugFromLocalized(
  title: LocalizedText,
  opts?: {
    prefer?: Array<keyof LocalizedText>;
    maxLen?: number;
    fallback?: string;
  },
) {
  const prefer = opts?.prefer ?? ['en', 'ar'];
  const maxLen = opts?.maxLen ?? 80;
  const fallback = (opts?.fallback ?? 'item').trim() || 'item';

  const raw =
    prefer.map((k) => title?.[k]?.trim()).find(Boolean) ||
    (title?.ar || title?.en || '').trim() ||
    fallback;

  const base = slugifyLib(raw, { lower: true, strict: true, locale: 'ar' });
  return base.slice(0, maxLen);
}

/**
 * ابني slug فريد لموديل معيّن
 * - يعتمد على فهرس unique على slug (مع isDeleted: false لو soft-delete)
 * - فلتر إضافي اختياري (مثال: { isDeleted: false })
 * - يستثني وثيقة معيّنة لو بتعمل تحديث (excludeId)
 */
export async function makeUniqueSlug<T extends { slug: string }>(
  model: Model<T>,
  baseSlug: string,
  opts?: {
    filter?: FilterQuery<T>;
    excludeId?: string; // تجاهل وثيقة معينة (وقت التحديث)
    maxTries?: number; // حد أقصى للمحاولات
  },
): Promise<string> {
  const filter = opts?.filter ?? {};
  const excludeId = opts?.excludeId;
  const maxTries = Math.max(2, opts?.maxTries ?? 50);

  // هات كل الـ slugs اللي بتبدأ بالـ baseSlug أو baseSlug-رقم
  const regex = new RegExp(`^${escapeRegExp(baseSlug)}(?:-(\\d+))?$`, 'i');
  const existing = await model.find({ ...filter, slug: { $regex: regex } }, { slug: 1 }).lean();

  if (!existing.length) return baseSlug;

  // استخرج أكبر suffix
  let maxSuffix = 1;
  for (const doc of existing) {
    const m = String((doc as any).slug).match(/-(\\d+)$/);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) maxSuffix = Math.max(maxSuffix, n);
    }
  }

  // جرّب suffixes جديدة لحد ما تلاقي المتاح
  for (let i = maxSuffix + 1; i < maxSuffix + 1 + maxTries; i++) {
    const candidate = `${baseSlug}-${i}`;
    const found = await model
      .findOne(
        { ...filter, slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) },
        { _id: 1 },
      )
      .lean();

    if (!found) return candidate;
  }

  // fallback: لو الدنيا زحمة جدًا، زوّد رقم عشوائي بسيط
  return `${baseSlug}-${Date.now() % 10000}`;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}
