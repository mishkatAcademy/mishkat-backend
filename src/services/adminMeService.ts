import User from '../models/User';
import AppError from '../utils/AppError';
import type { Express } from 'express';
import { moveDiskFileToUploads, deleteLocalByRelPath } from './localFiles.disk';

const ADMIN_AVATAR_FOLDER = 'public/avatars/admins';

export async function adminUpdateMeService(
  adminUserId: string,
  updates: { firstName?: string; lastName?: string },
  avatarFile?: Express.Multer.File,
) {
  const user = await User.findById(adminUserId);
  if (!user || user.isDeleted) throw AppError.notFound('User not found');
  if (user.role !== 'admin') throw AppError.forbidden('Admins only');

  // ✅ لازم يبقى فيه تعديل فعلي (اسم أو avatar)
  const hasName =
    typeof updates.firstName !== 'undefined' || typeof updates.lastName !== 'undefined';
  const hasAvatar = !!avatarFile;

  if (!hasName && !hasAvatar) {
    throw AppError.badRequest('No changes provided');
  }

  if (typeof updates.firstName !== 'undefined') user.firstName = updates.firstName;
  if (typeof updates.lastName !== 'undefined') user.lastName = updates.lastName;

  if (avatarFile) {
    // امسح القديم (لو موجود)
    await deleteLocalByRelPath(user.avatarRelPath);

    // انقل الجديد لمجلد الأدمن
    const stored = await moveDiskFileToUploads(avatarFile, ADMIN_AVATAR_FOLDER);

    user.avatarUrl = stored.url; // للفرونت
    user.avatarRelPath = stored.relPath; // للحذف/الداونلود الداخلي
  }

  await user.save();
  return { user: user.toJSON() };
}

export async function adminChangePasswordService(
  adminUserId: string,
  input: { currentPassword: string; newPassword: string },
) {
  const user = await User.findById(adminUserId).select('+password');
  if (!user || user.isDeleted) throw AppError.notFound('User not found');
  if (user.role !== 'admin') throw AppError.forbidden('Admins only');

  const ok = await user.comparePassword(input.currentPassword);
  if (!ok) throw AppError.badRequest('Current password is incorrect');

  user.password = input.newPassword; // pre-save hashing
  await user.save();

  return { changed: true };
}
