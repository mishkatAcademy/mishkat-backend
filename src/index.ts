// src/index.ts
import http from 'http';
import app from './server';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { logger } from './utils/logger';
import { seedAdminUser } from './bootstrap/seedAdmin';

let server: http.Server | undefined;
let shuttingDown = false;

/** مهم: امسك أخطاء synchronous غير المُلتقطة بدري جدًا */
process.on('uncaughtException', (err) => {
  logger.error({ err }, '💥 Uncaught Exception! Shutting down...');
  process.exit(1);
});

/** امسك الوعود غير المعالجة (على مستوى العملية) (Promise rejections) */
process.on('unhandledRejection', async (reason: unknown) => {
  logger.error({ reason }, '💥 Unhandled Rejection! Shutting down...');
  await gracefulShutdown(1);
});

/** إشارات النظام (Ctrl+C / منصات الاستضافة) */
process.on('SIGINT', async () => {
  logger.warn('🛑 SIGINT received');
  await gracefulShutdown(0);
});
process.on('SIGTERM', async () => {
  logger.warn('🛑 SIGTERM received');
  await gracefulShutdown(0);
});

async function bootstrap() {
  try {
    // 1) اتصل بقاعدة البيانات
    await connectDB();

    try {
      await seedAdminUser();
    } catch (err) {
      logger.error({ err }, '⚠️ Seed admin failed (continuing without seeding)');
    }

    // 2) شغّل السيرفر بعد نجاح الاتصال
    const hostLabel = env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

    server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server running on ${hostLabel}:${env.PORT} (NODE_ENV=${env.NODE_ENV})`);
    }) as http.Server;

    // server = app.listen(env.PORT, () => {
    //   logger.info(`🚀 Server running at http://localhost:${env.PORT}`);
    // }) as http.Server;

    // 3) ضبط مهلات الحماية من Slowloris والهجمات المشابهة
    server.keepAliveTimeout = 70_000; // 70 ثانية للـ keep-alive
    server.headersTimeout = 75_000; // 75 ثانية للهيدرز (أكبر شوية من keepAlive)
    server.requestTimeout = 60_000; // 60 ثانية لكل الطلب بالكامل

    // requestHeaderTimeout غير مدعوم
    // server.requestHeaderTimeout = 30_000; // 30 ثانية لاستلام الهيدرز
  } catch (err) {
    logger.error({ err }, '❌ Bootstrap failed');
    process.exit(1);
  }
}

async function gracefulShutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info('🛑 Starting graceful shutdown...');

  try {
    // 1) امنع اتصالات جديدة، وسيب الحالية تخلص (بحد أقصى 10 ثواني)
    if (server) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          logger.warn('⏱️ Force closing HTTP server after timeout');
          resolve();
        }, env.GRACEFUL_TIMEOUT_MS ?? 10_000);

        server!.close(() => {
          clearTimeout(timeout);
          logger.info('🧨 HTTP server closed.');
          resolve();
        });
      });
    }

    // أغلق الـ MongoDB مع حد أقصى للانتظار 8 ثواني
    await Promise.race([
      disconnectDB(),
      new Promise<void>((resolve) => setTimeout(resolve, 8_000)),
    ]);
  } catch (err) {
    logger.error({ err }, '⚠️ Error during shutdown');
  } finally {
    process.exit(exitCode);
  }
}

bootstrap();

export { server };
