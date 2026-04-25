// src/types/express.d.ts
import 'express-serve-static-core';
import 'express';

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type { Logger } from 'pino';
import type { Types } from 'mongoose';

import type { IUser } from '../models/User';
import type { Role } from './auth.types';

/* -------------------------------- Commons -------------------------------- */
/** حاوية عامة لبيانات متحقّقة من Zod */
export type ValidatedBag<B = unknown, Q = unknown, P = unknown, H = unknown> = {
  body?: B;
  query?: Q;
  params?: P;
  headers?: H;
};

/** سياق آمن نعلّق فيه بيانات من الـ middlewares */
export type ReqCtx = Record<string, unknown>;

/** مساحة لتجميع الـ docs اللي جايه من fetchDoc وغيره */
export type DocsLocals = {
  docs?: Record<string, unknown>;
};

/** نسخة Lean خفيفة من بيانات المستخدم لاستخدامها في req.user.fullUser */
export type LeanUserForAuth = Pick<
  IUser,
  'firstName' | 'lastName' | 'email' | 'avatarUrl' | 'isEmailVerified' | 'role'
> & {
  _id: Types.ObjectId;
};

/** ما يتم حقنه بواسطة auth middleware (protect) */
export interface UserPayload {
  id: string;
  role: Role;
  fullUser?: LeanUserForAuth;
}

/* ------------------------ express-serve-static-core ----------------------- */
declare module 'express-serve-static-core' {
  interface Request {
    /** بيانات متحقّقة (Zod) يملؤها ميدلويير التحقق */
    validated?: ValidatedBag;

    /** هوية المستخدم (بعد Auth middleware) */
    user?: UserPayload;

    /** pino-http */
    id?: string;
    log?: Logger;

    /** Multer */
    file?: Express.Multer.File;
    files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };

    /** سياق آمن لتعليق بيانات من middlewares (بديل عن الكتابة على req مباشرة) */
    ctx?: ReqCtx;

    /** بيانات من rate limiter (للاستخدام في Retry-After) */
    rateLimit?: {
      resetTime?: Date;
      [k: string]: unknown;
    };
  }

  interface Locals extends DocsLocals {}
}

/* --------------------------------- express -------------------------------- */
declare module 'express' {
  interface Request {
    validated?: ValidatedBag;
    user?: UserPayload;
    id?: string;
    log?: Logger;
    file?: Express.Multer.File;
    files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
    ctx?: ReqCtx;
    rateLimit?: {
      resetTime?: Date;
      [k: string]: unknown;
    };
  }
}

/* ------------------------------ Helper Types ------------------------------ */
export type ValidatedRequest<
  B = unknown,
  Q = unknown,
  P = unknown,
  H = unknown,
> = ExpressRequest & { validated: ValidatedBag<B, Q, P, H> };

export type AuthedRequest = ExpressRequest & {
  user: UserPayload;
};

export type CtxRequest<C extends ReqCtx = ReqCtx> = ExpressRequest & {
  ctx: C;
};

export type ResWithDocs = ExpressResponse<any, DocsLocals>;
