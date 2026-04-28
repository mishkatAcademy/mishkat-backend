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

  if (existing) {
    const updateName = !!(env as any).SEED_ADMIN_UPDATE_NAME;
    const resetPass = !!(env as any).SEED_ADMIN_RESET_PASSWORD;

    const $set: any = {};

    if (updateName) {
      $set.firstName = firstName;
      $set.lastName = lastName;
    }

    if (verify) $set.isEmailVerified = true;

    if (existing.isDeleted) $set.isDeleted = false;
    if (existing.role !== 'admin') $set.role = 'admin';

    if (resetPass && password) {
      const bcrypt = (await import('bcryptjs')).default;
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      $set.password = hashed;
    }

    if (Object.keys($set).length) {
      await User.updateOne({ _id: existing._id }, { $set });
      logger.warn(
        { email, updateName, resetPass },
        'Seed admin: user existed and was updated (name/password flags)',
      );
    }

    return;
  }

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

// // src/bootstrap/seedAdmin.ts
// import bcrypt from 'bcryptjs';
// import User from '../models/User';
// import { env } from '../config/env';
// import { logger } from '../utils/logger';

// export async function seedAdminUser() {
//   if (!env.SEED_ADMIN_ENABLED) {
//     logger.info('Seed admin: disabled');
//     return;
//   }

//   if (env.NODE_ENV === 'production' && env.SEED_ADMIN_RESET_PASSWORD) {
//     throw new Error('SEED_ADMIN_RESET_PASSWORD must be false in production');
//   }

//   const email = env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
//   const password = env.SEED_ADMIN_PASSWORD;

//   if (!email || !password) {
//     logger.warn('Seed admin: email/password missing, skipped');
//     return;
//   }

//   const firstName = env.SEED_ADMIN_FIRSTNAME || 'Admin';
//   const lastName = env.SEED_ADMIN_LASTNAME || 'User';
//   const verify = env.SEED_ADMIN_VERIFY_EMAIL === true;

//   const existing = await User.findOne({ email }).select('_id role isDeleted').lean();

//   // لو موجود
//   if (existing) {
//     const updateName = env.SEED_ADMIN_UPDATE_NAME === true;
//     const resetPass = env.SEED_ADMIN_RESET_PASSWORD === true;

//     const $set: any = {};

//     if (updateName) {
//       $set.firstName = firstName;
//       $set.lastName = lastName;
//     }

//     if (verify) {
//       $set.isEmailVerified = true;
//     }

//     if (existing.isDeleted) {
//       $set.isDeleted = false;
//     }

//     if (existing.role !== 'admin') {
//       $set.role = 'admin';
//     }

//     if (resetPass) {
//       const salt = await bcrypt.genSalt(10);
//       const hashed = await bcrypt.hash(password, salt);
//       $set.password = hashed;
//     }

//     if (Object.keys($set).length) {
//       await User.updateOne({ _id: existing._id }, { $set });

//       logger.warn({ email, updateName, resetPass }, 'Seed admin: existing user updated');
//     } else {
//       logger.info({ email }, 'Seed admin: existing admin unchanged');
//     }

//     return;
//   }

//   await User.create({
//     firstName,
//     lastName,
//     email,
//     password,
//     role: 'admin',
//     isEmailVerified: verify,
//     isDeleted: false,
//   });

//   logger.info({ email }, 'Seed admin: admin user created');
// }
