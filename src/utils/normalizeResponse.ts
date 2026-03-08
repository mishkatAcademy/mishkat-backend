// src/utils/normalizeResponse.ts
import mongoose from 'mongoose';

type AnyObj = Record<string, any>;

function isPlainObject(v: any) {
  return (
    v !== null &&
    typeof v === 'object' &&
    (v.constructor === Object || Object.getPrototypeOf(v) === null)
  );
}

function isObjectIdLike(v: any) {
  // ObjectId instance OR 24-hex string
  if (v == null) return false;
  if (typeof v === 'string') return /^[a-fA-F0-9]{24}$/.test(v);
  // mongoose ObjectId
  return mongoose.isValidObjectId(v) && typeof v !== 'string';
}

function toIdString(v: any) {
  if (isObjectIdLike(v)) return String(v);
  return v;
}

/**
 * ✅ normalizeAPI:
 * - يحوّل أي _id -> id (string) ويحذف _id
 * - يحذف __v
 * - يحوّل أي ObjectId values إلى string
 * - يدعم nested objects/arrays + lean + docs
 */
export function normalizeAPI<T = any>(value: T): T {
  if (value == null) return value;

  // Array
  if (Array.isArray(value)) {
    return value.map(normalizeAPI) as any;
  }

  // Date
  if (value instanceof Date) return value as any;

  // Mongoose doc (has toJSON)
  if (typeof (value as any).toJSON === 'function' && !isPlainObject(value)) {
    return normalizeAPI((value as any).toJSON()) as any;
  }

  // Plain object (including lean results)
  if (isPlainObject(value)) {
    const obj = value as AnyObj;
    const out: AnyObj = {};

    for (const [k, v] of Object.entries(obj)) {
      out[k] = normalizeAPI(v);
    }

    // ✅ replace _id → id
    if ('_id' in out && out._id != null) {
      out.id = String(out._id);
      delete out._id;
    }

    if ('__v' in out) delete out.__v;

    // ✅ convert remaining ObjectId-like values to string (helpful)
    for (const k of Object.keys(out)) {
      out[k] = toIdString(out[k]);
    }

    return out as any;
  }

  // Primitive
  return value as any;
}
