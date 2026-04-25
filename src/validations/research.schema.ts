// src/validations/research.schema.ts
import { z } from 'zod';

export const specializationEnum = z.enum(['خدمة اجتماعية', 'علم اجتماع', 'علم نفس', 'تربية خاصة']);

export const natureEnum = z.enum([
  'بحث أكاديمي مقرر',
  'بحث ماجستير',
  'بحث دكتوراه',
  'بحث ترقية',
  'بحث للنشر في مجلة علمية',
]);

export const serviceEnum = z.enum([
  'توفير مصادر ودراسات',
  'اقتراح عناوين لموضوعات البحث',
  'عمل خطة البحث',
  'اقتراح محاور للإطار النظري وتقسيمات البحث',
  'عمل فصل محدد في البحث',
  'عمل البحث كاملا',
]);

const ymd = /^\d{4}-\d{2}-\d{2}$/;

export const attachmentParamsSchema = z.object({
  id: z.string().length(24, 'Invalid id'),
  attachmentId: z.string().length(24, 'Invalid attachmentId'),
});

export const createResearchBodySchema = z.object({
  specialization: specializationEnum,
  nature: natureEnum,
  serviceType: serviceEnum,

  name: z.string().min(2).max(120),
  whatsapp: z.string().min(6).max(30),
  email: z.string().email(),

  researchTitle: z.string().min(2).max(300),
  description: z.string().max(5000).optional(),

  proposedDueDate: z.string().regex(ymd, 'صيغة التاريخ يجب أن تكون YYYY-MM-DD'),
});

export const idParamSchema = z.object({
  id: z.string().length(24, 'Invalid id'),
});

export const myListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

/** الأدمن */
export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),

  status: z.enum(['new', 'in_review', 'in_progress', 'completed', 'cancelled']).optional(),
  specialization: specializationEnum.optional(),
  nature: natureEnum.optional(),
  serviceType: serviceEnum.optional(),

  search: z.string().trim().optional(), // name/email/researchTitle
  from: z.string().regex(ymd).optional(), // filter by createdAt range
  to: z.string().regex(ymd).optional(),
});

export const adminUpdateBodySchema = z.object({
  status: z.enum(['new', 'in_review', 'in_progress', 'completed', 'cancelled']).optional(),
  adminNotes: z.string().max(10000).optional(),
});
