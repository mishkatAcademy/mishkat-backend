// src/config/db.ts
import mongoose from 'mongoose';
import { env, isDev } from './env';
import { logger } from '../utils/logger';

let listenersBound = false;

function maskUri(uri: string) {
  // اخفاء الـ credentials في اللوج
  return uri.replace(/(mongodb(\+srv)?:\/\/)([^@/]+)@/i, '$1****@');
}

export async function connectDB() {
  // إعدادات جلوبال
  mongoose.set('debug', isDev); // لوج الاستعلامات في التطوير
  mongoose.set('sanitizeFilter', true); // يمنع حقن $ داخل فلاتر الاستعلام
  mongoose.set('autoIndex', isDev); // تلقائي في الديف فقط
  mongoose.set('autoCreate', isDev); // إنشاء الكوليكشن تلقائيًا في الديف
  // يجعل مطابقة الاستعلامات أكثر صرامة. مناسب لمعظم الحالات
  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false);

  if (!listenersBound) {
    mongoose.connection.on('connected', () => logger.info('✅ MongoDB connected'));
    mongoose.connection.on('disconnected', () => logger.warn('🔌 MongoDB disconnected'));
    mongoose.connection.on('error', (err) => logger.error({ err }, '❌ MongoDB connection error'));
    // mongoose.connection.on('reconnected', () => logger.info('🔄 MongoDB reconnected'));
    listenersBound = true;
  }

  const uri = env.MONGODB_URI;
  const masked = maskUri(uri);

  mongoose.set('sanitizeFilter', false as any);
  console.log('[mongoose] sanitizeFilter=', mongoose.get('sanitizeFilter'));
  try {
    await mongoose.connect(uri, {
      // مهلة قصيرة لرسائل الخطأ علشان تكون أسرع لو السيرفر مش شغال
      serverSelectionTimeoutMS: 5_000,
      maxPoolSize: 20,
    });

    logger.info({ uri: masked }, '✅ Connected to MongoDB');
  } catch (err) {
    logger.error({ err, uri: masked }, '❌ Bootstrap failed (MongoDB connection)');
    throw err;
  }
}

export async function disconnectDB() {
  const state = mongoose.connection.readyState; // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  if (state === 1 || state === 2 || state === 3) {
    await mongoose.connection.close(false);
    logger.info('🔌 MongoDB connection closed.');
  } else {
    logger.info('ℹ️ MongoDB already disconnected.');
  }
}
