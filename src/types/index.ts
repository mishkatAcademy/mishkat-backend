// src/types/index.ts

/* ================= Re-exports مريحة ================= */

// Auth-related types
export type {
  Role,
  RegisterInput,
  LoginInput,
  AuthUserDTO,
  AccessTokenPayload,
  RefreshTokenPayload,
} from './auth.types';

// Common utility types
export type {
  Id,
  WithTimestamps,
  ServiceResult,
  Nullable,
  Undefinable,
  QueryFilters,
  FileMeta,
  PaginationParams,
  PaginationMeta,
  PaginatedResult,
} from './common';

// إعادة تصدير تنفيذ buildMeta
export { buildMeta } from './common';
