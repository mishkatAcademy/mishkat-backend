// src/types/auth.types.ts

/** دور المستخدم داخل النظام */
export type Role = 'student' | 'instructor' | 'admin';

/** مدخلات تسجيل حساب جديد */
export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;

  role?: Role;

  avatarUrl?: string; // رابط عام يوصله الفرونت
  avatarRelPath?: string; // المسار الداخلي تحت uploads/... للحذف فقط
}

/** مدخلات تسجيل الدخول */
export interface LoginInput {
  email: string;
  password: string;
}

/** بيانات المستخدم اللي بنرجعها بعد الـ auth (login/register) */
export interface AuthUserDTO {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  avatarUrl?: string;
}

/**
 * Payload الخاص بالـ Access Token (JWT)
 * - متوافق مع createAccessToken / verifyJwt
 */
export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  iat?: number;
  exp?: number;
}

/**
 * Payload الخاص بالـ Refresh Token (JWT)
 */
export interface RefreshTokenPayload {
  sub: string; // user id
  tokenId: string; // jti / معرف التوكن
  iat?: number;
  exp?: number;
}
