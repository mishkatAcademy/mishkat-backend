import { Types } from 'mongoose';
import Address, { IAddress } from '../models/Address';
import AppError from '../utils/AppError';

async function ensureOwnedAddress(userId: string, addressId: string) {
  const addr = await Address.findOne({
    _id: new Types.ObjectId(addressId),
    user: new Types.ObjectId(userId),
    isDeleted: false,
  });
  if (!addr) throw AppError.notFound('العنوان غير موجود');
  return addr;
}

export async function listMyAddressesService(
  userId: string,
  opts: { page?: number; limit?: number; sortBy?: string } = {},
) {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit ?? 10)));

  const sort: Record<string, 1 | -1> = {};
  const sortBy = opts.sortBy ?? '';
  if (sortBy) {
    const dir = sortBy.startsWith('-') ? -1 : 1;
    const key = sortBy.replace(/^-/, '');
    sort[key] = dir;
  } else {
    sort.isDefault = -1;
    sort.createdAt = -1;
  }

  const query = { user: new Types.ObjectId(userId), isDeleted: false };
  const [data, total] = await Promise.all([
    Address.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Address.countDocuments(query),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

/** ➕ إنشاء عنوان جديد (يضبط isDefault تلقائيًا عند أول عنوان) */
export async function createAddressService(
  userId: string,
  input: Partial<IAddress>,
): Promise<IAddress> {
  const hasAny = await Address.exists({ user: userId, isDeleted: false });

  // لو المستخدم اختار isDefault أو لو ده أول عنوان
  const shouldBeDefault = Boolean(input.isDefault) || !hasAny;

  if (shouldBeDefault) {
    // ألغِ الافتراضي الحالي لو موجود
    await Address.updateMany({ user: userId, isDefault: true }, { $set: { isDefault: false } });
  }

  const doc = await Address.create({
    user: userId,
    label: input.label ?? 'home',
    recipientName: input.recipientName,
    phone: input.phone,
    street: input.street,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country,
    notes: input.notes,
    isDefault: shouldBeDefault,
  });

  return doc;
}

/** ✏️ تحديث عنواني */
export async function updateAddressService(
  userId: string,
  addressId: string,
  updates: Partial<IAddress>,
): Promise<IAddress> {
  const addr = await ensureOwnedAddress(userId, addressId);

  // تعديل العنوان ليصبح العنوان الافتراضي
  if (updates.isDefault === true && !addr.isDefault) {
    await Address.updateMany({ user: userId, isDefault: true }, { $set: { isDefault: false } });
    addr.isDefault = true;
  }

  // باقي الحقول
  if (updates.label !== undefined) addr.label = updates.label;
  if (updates.recipientName !== undefined) addr.recipientName = updates.recipientName;
  if (updates.phone !== undefined) addr.phone = updates.phone;
  if (updates.street !== undefined) addr.street = updates.street;
  if (updates.city !== undefined) addr.city = updates.city;
  if (updates.state !== undefined) addr.state = updates.state;
  if (updates.postalCode !== undefined) addr.postalCode = updates.postalCode;
  if (updates.country !== undefined) addr.country = updates.country;
  if (updates.notes !== undefined) addr.notes = updates.notes;

  await addr.save();
  return addr;
}

/** ⭐ تعيين كافتراضي صراحة */
export async function setDefaultAddressService(userId: string, addressId: string) {
  const addr = await ensureOwnedAddress(userId, addressId);

  if (!addr.isDefault) {
    await Address.updateMany({ user: userId, isDefault: true }, { $set: { isDefault: false } });
    addr.isDefault = true;
    await addr.save();
  }

  return addr;
}

/** 🗑️ حذف (Soft) — ولو كان افتراضي، عيّن آخر عنوان نشط كافتراضي */
export async function deleteAddressService(userId: string, addressId: string) {
  const addr = await ensureOwnedAddress(userId, addressId);

  const wasDefault = addr.isDefault;
  addr.isDeleted = true;
  addr.isDefault = false;
  await addr.save();

  if (wasDefault) {
    const fallback = await Address.findOne({
      user: userId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (fallback) {
      await Address.updateOne({ _id: fallback._id }, { $set: { isDefault: true } });
    }
  }
}

/** 🔍 قراءة عنوان من عناويني */
export async function getMyAddressService(userId: string, addressId: string) {
  return ensureOwnedAddress(userId, addressId);
}
