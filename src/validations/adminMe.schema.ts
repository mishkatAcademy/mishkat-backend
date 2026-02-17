import { z } from 'zod';

/** PATCH /admin/me (name + avatar via multipart) */
export const adminUpdateMeBodySchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
});

/** POST /admin/me/change-password */
export const adminChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'currentPassword is required'),
  newPassword: z.string().min(8, 'newPassword must be at least 8 chars').max(200),
});
