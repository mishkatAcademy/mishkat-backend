// src/services/userService.ts
import type { Express } from 'express';
import User, { IUser } from '../models/User';
import InstructorProfile from '../models/InstructorProfile';
import { AppError } from '../utils/AppError';
import { moveDiskFileToUploads, deleteLocalByRelPath } from '../services/localFiles.disk';
import type { Role } from '../types';

interface UpdateProfileInput {
  userId: string;
  payload: {
    firstName?: string;
    lastName?: string;
    avatar?: string; // URL جاية من الـ body لو موجودة
  };
  avatarFile?: Express.Multer.File; // ملف مرفوع عن طريق multer
}

export const updateMyProfileService = async ({
  userId,
  payload,
  avatarFile,
}: UpdateProfileInput) => {
  const { firstName, lastName, avatar } = payload;

  if (!firstName && !lastName && !avatar && !avatarFile) {
    throw new AppError('يرجى إدخال بيانات لتحديثها', 400);
  }

  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw new AppError('المستخدم غير موجود', 404);
  }

  let avatarUrl = user.avatarUrl;
  let avatarRelPath = user.avatarRelPath;

  // 1) لو في ملف جديد مرفوع → أولوية قصوى
  if (avatarFile) {
    const up = await moveDiskFileToUploads(avatarFile, 'avatars');

    // احذف القديم لو كان محلي
    if (avatarRelPath) {
      await deleteLocalByRelPath(avatarRelPath);
    }

    avatarUrl = up.url;
    avatarRelPath = up.relPath;
  } else if (typeof avatar === 'string' && avatar.trim()) {
    // 2) لو مفيش ملف بس في URL جديد في الـ body
    // لو كان في قبل كده صورة مرفوعة محليًا → احذفها
    if (avatarRelPath) {
      await deleteLocalByRelPath(avatarRelPath);
      avatarRelPath = undefined;
    }

    avatarUrl = avatar.trim();
  }

  if (typeof firstName === 'string' && firstName.trim()) {
    user.firstName = firstName.trim();
  }
  if (typeof lastName === 'string' && lastName.trim()) {
    user.lastName = lastName.trim();
  }

  user.avatarUrl = avatarUrl;
  user.avatarRelPath = avatarRelPath;

  await user.save();

  return user;
};

export const changePasswordService = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
) => {
  if (!currentPassword || !newPassword) {
    throw new AppError('يرجى إدخال كلمتي المرور', 400);
  }

  const user = await User.findById(userId).select('+password');
  if (!user || user.isDeleted) throw new AppError('المستخدم غير موجود', 404);

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new AppError('كلمة المرور الحالية غير صحيحة', 401);

  user.password = newPassword;
  // 🔐 التشفير بيتم تلقائيًا في pre('save')
  await user.save();
};

export const getAllUsersService = async (): Promise<IUser[]> => {
  const users = await User.find({ isDeleted: false }).select('-password');
  return users;
};

export const getUserByIdService = async (id: string) => {
  const user = await User.findById(id).select('-password');
  if (!user || user.isDeleted) throw new AppError('المستخدم غير موجود', 404);
  return user;
};

export const updateUserRoleService = async (id: string, role: string): Promise<IUser> => {
  const validRoles: Role[] = ['student', 'instructor', 'admin'];

  if (!validRoles.includes(role as Role)) {
    throw new AppError('دور المستخدم غير صالح', 400);
  }

  const user = await User.findById(id).select('-password');
  if (!user || user.isDeleted) throw new AppError('المستخدم غير موجود', 404);

  const previousRole = user.role;
  if (previousRole === role) return user;
  user.role = role as Role;
  await user.save();

  // 1) ترقية لـ instructor → أنشئ/فعّل InstructorProfile
  if (previousRole !== 'instructor' && role === 'instructor') {
    const existingProfile = await InstructorProfile.findOne({ user: user._id });

    if (!existingProfile) {
      await InstructorProfile.create({ user: user._id });
    } else if (!existingProfile.isActive) {
      existingProfile.isActive = true;
      await existingProfile.save();
    }
  }

  if (previousRole === 'instructor' && role !== 'instructor') {
    await InstructorProfile.updateOne({ user: user._id }, { isActive: false });
  }

  return user;
};

export const deactivateUserService = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('المستخدم غير موجود', 404);
  if (user.role === 'admin') throw new AppError('لا يمكن تعطيل حساب أدمن', 403);
  if (user.isDeleted) throw new AppError('الحساب معطل بالفعل', 400);

  user.isDeleted = true;
  await user.save();

  // 👇 لو المدرّس اتعطل → نعطّل بروفايله كمان
  if (user.role === 'instructor') {
    await InstructorProfile.updateOne({ user: user._id }, { isActive: false });
  }
};

export const reactivateUserService = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('المستخدم غير موجود', 404);
  if (user.role === 'admin') throw new AppError('لا يمكن تعديل حالة حساب الأدمن', 403);
  if (!user.isDeleted) throw new AppError('الحساب مفعل بالفعل', 400);

  user.isDeleted = false;
  await user.save();

  if (user.role === 'instructor') {
    await InstructorProfile.updateOne({ user: user._id }, { isActive: true });
  }
};
