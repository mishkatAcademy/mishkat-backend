// src/bootstrap/seedAdmin.ts
import User from '../models/User';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export async function seedAdminUser() {
  const email = env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.SEED_ADMIN_PASSWORD;

  if (!email || !password) return;

  const firstName = env.SEED_ADMIN_FIRSTNAME || 'Admin';
  const lastName = env.SEED_ADMIN_LASTNAME || 'User';
  const verify = String(env.SEED_ADMIN_VERIFY_EMAIL || '').toLowerCase() === 'true';

  const existing = await User.findOne({ email }).select('_id role isDeleted').lean();

  // لو موجود
  if (existing) {
    const updateName = !!(env as any).SEED_ADMIN_UPDATE_NAME;
    const resetPass = !!(env as any).SEED_ADMIN_RESET_PASSWORD;

    const $set: any = {};

    // ✅ تحديث الاسم عند الطلب فقط
    if (updateName) {
      $set.firstName = firstName;
      $set.lastName = lastName;
    }

    // ✅ تحديث verify عند الطلب (اختياري—سيبها زي ما تحب)
    if (verify) $set.isEmailVerified = true;

    // ✅ ترقية/استعادة زي ما عندك
    if (existing.isDeleted) $set.isDeleted = false;
    if (existing.role !== 'admin') $set.role = 'admin';

    // ✅ تحديث الباسورد عند الطلب فقط
    if (resetPass && password) {
      const bcrypt = (await import('bcryptjs')).default;
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      $set.password = hashed; // لازم hashed لأن updateOne بيتخطّى pre('save')
    }

    // لو مفيش حاجة تتحدث… اخرج
    if (Object.keys($set).length) {
      await User.updateOne({ _id: existing._id }, { $set });
      logger.warn(
        { email, updateName, resetPass },
        'Seed admin: user existed and was updated (name/password flags)',
      );
    }

    return;
  }

  // إنشاء جديد (مهم: سيب تشفير الباسورد للـ pre("save") في UserSchema)
  await User.create({
    firstName,
    lastName,
    email,
    password,
    role: 'admin',
    isEmailVerified: verify ? true : false,
    isDeleted: false,
  });

  logger.info({ email }, 'Seed admin: admin user created');
}
