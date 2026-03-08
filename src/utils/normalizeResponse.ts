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

function isObjectIdInstance(v: any) {
  // ✅ ONLY real ObjectId instances (prevents "[object Object]" bugs)
  return v instanceof mongoose.Types.ObjectId || v?._bsontype === 'ObjectId';
}

function is24HexString(v: any) {
  return typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v);
}

function toIdString(v: any) {
  // ✅ convert only real ObjectId instances
  if (isObjectIdInstance(v)) return String(v);
  if (is24HexString(v)) return v;

  return v;
}

/**
 * ✅ normalizeAPI:
 * - يحوّل _id -> id (string) ويحذف _id
 * - يحذف __v
 * - يحوّل ObjectId الحقيقي إلى string (بدون ما يلمس objects)
 */
export function normalizeAPI<T = any>(value: T): T {
  if (value == null) return value;

  // Array
  if (Array.isArray(value)) return value.map(normalizeAPI) as any;

  // Date
  if (value instanceof Date) return value as any;

  // Convert ObjectId instance if the whole value is ObjectId
  if (isObjectIdInstance(value)) return String(value) as any;

  // Mongoose doc
  if (typeof (value as any).toJSON === 'function' && !isPlainObject(value)) {
    return normalizeAPI((value as any).toJSON()) as any;
  }

  // Plain object (lean results too)
  if (isPlainObject(value)) {
    const obj = value as AnyObj;
    const out: AnyObj = {};

    for (const [k, v] of Object.entries(obj)) {
      out[k] = normalizeAPI(v);
    }

    // ✅ _id → id
    if ('_id' in out && out._id != null) {
      out.id = String(out._id);
      delete out._id;
    }

    // ✅ remove __v
    if ('__v' in out) delete out.__v;

    // ✅ convert direct ObjectId values (not objects)
    for (const k of Object.keys(out)) {
      out[k] = toIdString(out[k]);
    }

    return out as any;
  }

  // Primitive
  return value as any;
}
