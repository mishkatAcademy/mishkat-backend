// src/server.ts
import express, {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet, { type HelmetOptions } from 'helmet';
import compression from 'compression';
import hpp from 'hpp';
// كان بيكسر ال req.param and/or req.query and/or req.body
// import mongoSanitize from 'express-mongo-sanitize';
// تم استبداله ب mongoSanitizeBody يدوي
import { mongoSanitizeBody } from './middlewares/mongoSanitizeBody';
import rateLimit from 'express-rate-limit';
// import slowDown from 'express-slow-down';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import pinoHttp from 'pino-http';
import crypto from 'crypto';

import { logger } from './utils/logger';
import { env, corsOrigins } from './config/env';
import { notFound, errorConverter, errorHandler } from './middlewares/errorHandler';

import serveStatic from 'serve-static';

import { UPLOAD_ROOT } from './services/localFiles.disk';

// Routes
// DONE
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import adminInstructorRoutes from './routes/adminInstructorRoutes';
import addressRoutes from './routes/addressRoutes';
import categoryRoutes from './routes/categoryRoutes';
import bookRoutes from './routes/bookRoutes';
import libraryRoutes from './routes/libraryRoutes';
import cartRoutes from './routes/cartRoutes';
import orderRoutes from './routes/orderRoutes';
import consultationRoutes from './routes/consultationRoutes';
import instructorRoutes from './routes/instructorRoutes';
import researchRoutes from './routes/researchRoutes';
import researchDownloadRoutes from './routes/researchDownloadRoutes';

import reviewRoutes from './routes/reviewRoutes';

// (Modules لاحقًا)
// SECOND MILLSTONE ISA
// import courseRoutes from "./routes/courseRoutes";
// import moduleRoutes from "./routes/moduleRoutes";
// import lessonRoutes from "./routes/lessonRoutes";
// import enrollmentRoutes from "./routes/enrollmentRoutes";
// import quizRoutes from "./routes/quizRoutes";
// import quizQuestionRoutes from "./routes/quizQuestionRoutes";
// import quizResponseRoutes from "./routes/quizResponseRoutes";

const app = express();
app.disable('x-powered-by');

mongoose.set('sanitizeFilter', false);

const apiPrefix = '/api/v1';
const isProd = env.NODE_ENV === 'production';

/* ============================================================================
1) Trust proxy
============================================================================ */
app.set('trust proxy', env.TRUST_PROXY ? 1 : 0);

app.use(
  pinoHttp({
    logger,
    autoLogging: env.NODE_ENV !== 'test',
    genReqId: (req) => (req.headers['x-request-id'] as string) || crypto.randomUUID(),
  }),
);

/* ============================================================================
2) CORS
============================================================================ */
const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, cb) {
    // السماح لأدوات بدون Origin (Postman/SSR)
    if (!origin) return cb(null, true);

    // السماح المفتوح (للتطوير): CORS_ORIGINS="*"
    if (corsOrigins === '*') return cb(null, true);

    // whitelist (array)
    if (Array.isArray(corsOrigins) && corsOrigins.includes(origin)) {
      return cb(null, true);
    }

    return cb(new Error('Not allowed by CORS'));
  },

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Error && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ status: 'fail', message: 'CORS: Origin not allowed' });
  }
  next(err);
});

/* ============================================================================
3) Security hardening + Parsers
// Helmet
============================================================================ */
function makeHelmet(options?: HelmetOptions): RequestHandler {
  return (helmet as unknown as (opts?: HelmetOptions) => RequestHandler)(options);
}

if (isProd) {
  app.use(makeHelmet());
} else {
  app.use(makeHelmet({ contentSecurityPolicy: false }));
}

app.use(
  hpp({
    whitelist: ['categories', 'tags', 'files'],
  }),
);
// app.use(hpp());

// ضغط الردود
app.use(compression());

const asHandler = (mw: any): RequestHandler => mw as unknown as RequestHandler;

app.use(asHandler(express.json({ limit: env.JSON_BODY_LIMIT })));
app.use(asHandler(express.urlencoded({ extended: true, limit: env.JSON_BODY_LIMIT })));

// Cookies
app.use(cookieParser());

// Sanitization ضد حقن Mongo
// app.use(mongoSanitize());
app.use(mongoSanitizeBody());

// ملفات static للـ uploads
const makeStatic = (root: string, options?: serveStatic.ServeStaticOptions): RequestHandler =>
  serveStatic(root, options) as unknown as RequestHandler;

app.use(
  '/uploads',
  makeStatic(UPLOAD_ROOT, {
    maxAge: '30d',
    setHeaders: (res, filePath /* , _stat */) => {
      if (filePath.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }),
);

/* ============================================================================
4) Health/Ready endpoints (before Rate Limit)
============================================================================ */
app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));
app.get('/readyz', (_req, res) => {
  const state = mongoose.connection.readyState; // 1 = connected
  res.status(state === 1 ? 200 : 503).json({ status: state === 1 ? 'ok' : 'not-ready' });
});

/* ============================================================================
5) Rate limit عام لمسارات /auth
============================================================================ */
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // مثال: 15 دقيقة
  max: env.RATE_LIMIT_MAX, // مثال: 100 طلب لكل IP
  standardHeaders: true,
  legacyHeaders: false,
});

// const authSlow = slowDown({
//   windowMs: env.RATE_LIMIT_WINDOW_MS,
//   delayAfter: 50,
//   delayMs: 250,
// });

/* ============================================================================
6) Routes (prefix موحّد)
============================================================================ */
app.use(`${apiPrefix}/auth`, authLimiter, authRoutes);
// لغيت ال authSlow بعد المشاكل اللي حصلت فاكر
// app.use(`${apiPrefix}/auth`, authLimiter, authSlow, authRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/admin`, adminRoutes);
app.use(`${apiPrefix}/adminInstructors`, adminInstructorRoutes);
app.use(`${apiPrefix}/addresses`, addressRoutes);
app.use(`${apiPrefix}/categories`, categoryRoutes);
app.use(`${apiPrefix}/books`, bookRoutes);
app.use(`${apiPrefix}/library`, libraryRoutes);
app.use(`${apiPrefix}/cart`, cartRoutes);
app.use(`${apiPrefix}/orders`, orderRoutes);
app.use(`${apiPrefix}/consultations`, consultationRoutes);
app.use(`${apiPrefix}/instructors`, instructorRoutes);
app.use(`${apiPrefix}/research`, researchRoutes);
app.use(`${apiPrefix}/research`, researchDownloadRoutes);
app.use(`${apiPrefix}/reviews`, reviewRoutes);

// لاحقًا:
// app.use(`${apiPrefix}/courses`, courseRoutes);
// app.use(`${apiPrefix}/modules`, moduleRoutes);
// app.use(`${apiPrefix}/lessons`, lessonRoutes);
// app.use(`${apiPrefix}/enrollments`, enrollmentRoutes);
// app.use(`${apiPrefix}/quizzes`, quizRoutes);
// app.use(`${apiPrefix}/quiz-questions`, quizQuestionRoutes);
// app.use(`${apiPrefix}/quiz-responses`, quizResponseRoutes);

/* ============================================================================
7) Error middlewares
============================================================================ */
app.use(notFound); // 404 لأي Route غير موجود
app.use(errorConverter); // حوّل أخطاء شائعة إلى AppError موحّد
app.use(errorHandler); // إخراج JSON نهائي

export default app;
