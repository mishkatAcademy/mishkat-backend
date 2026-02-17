// src/services/orderService.ts
import { Types } from 'mongoose';
import Order, { IOrder } from '../models/Order';
import AppError from '../utils/AppError';
import CartItem, { ICartItem } from '../models/CartItem';
import Book from '../models/Book';
import Address from '../models/Address';
import ConsultationHold from '../models/ConsultationHold';
import ConsultationOffering from '../models/ConsultationOffering';
import ConsultationBooking from '../models/ConsultationBooking';
import InstructorProfile from '../models/InstructorProfile';
import { createMoyasarPayment, MoyasarWebhookPayload } from '../utils/payments/moyasar';
import { saveOnce, getIfExists } from '../utils/inMemoryOnceStore';
import { env } from '../config/env';
import { priceForItem } from './order/priceForItem';

// ============ إعدادات وقواعد عامة ============

// أقصى كمية للكتب الورقية
const MAX_QTY_PHYSICAL_BOOK = 20;

// شحن ثابت + ضريبة من env (أضفناهم في env.ts مع defaults)
const SHIPPING_FLAT = env.SHIPPING_FLAT_HALALAS ?? 0; // بالـ halalas
const VAT_PERCENT = env.VAT_PERCENT ?? 0; // نسبة %

type SupportedCartType = 'Book' | 'ConsultationHold'; // TODO Courses ISA

// const PAYMENT_AMOUNT_TOLERANCE_HALALAS = env.PAYMENT_AMOUNT_TOLERANCE_HALALAS ?? 100;

async function finalizeConsultationHoldToBooking(opts: {
  orderUserId: string;
  holdId: string;
  orderPaymentId: string;
  payload: MoyasarWebhookPayload;
}) {
  const { orderUserId, holdId, orderPaymentId, payload } = opts;

  // ✅ Idempotency: لو Booking اتعمل قبل كده بنفس paymentId
  const existing = await ConsultationBooking.findOne({
    'payment.paymentId': orderPaymentId,
  })
    .select('_id')
    .lean();

  if (existing) return { bookingId: String((existing as any)._id), already: true };

  // ✅ Atomic lock: اقفل الـ hold لو لسه holding ومش منتهي (يقلل سباق التزامن)
  const now = new Date();

  const hold = await ConsultationHold.findOneAndUpdate(
    {
      _id: holdId,
      status: 'holding',
      $and: [
        { $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }] },
        {
          $or: [
            { user: new Types.ObjectId(orderUserId) },
            { user: null },
            { user: { $exists: false } },
          ],
        },
      ],
    },
    { $set: { 'payment.paymentId': orderPaymentId } },
    { new: true },
  );
  if (!hold) {
    const h = await ConsultationHold.findById(holdId).select('status expiresAt user').lean();
    if (!h) throw AppError.notFound('Hold not found');
    if ((h as any).expiresAt && new Date((h as any).expiresAt) <= now) {
      await ConsultationHold.updateOne({ _id: holdId }, { $set: { status: 'expired' } });
      throw AppError.badRequest('Hold انتهى');
    }
    if ((h as any).user && String((h as any).user) !== String(orderUserId)) {
      throw AppError.forbidden('هذا الـ Hold لا يخص هذا المستخدم');
    }
    throw AppError.badRequest('Hold غير صالح');
  }

  try {
    // ✅ Guard: applicant لازم يكون مكتمل لأن schema عندك required
    const a = (hold as any).applicant;
    if (!a?.fullName || !a?.email || !a?.whatsapp) {
      await ConsultationHold.updateOne({ _id: holdId }, { $set: { status: 'failed' } });
      throw AppError.badRequest('Hold applicant data is incomplete');
    }

    // ✅ منع تضارب: أي booking مؤكدة/مكتملة تتداخل
    const clash = await ConsultationBooking.findOne({
      instructor: hold.instructor,
      start: { $lt: hold.end },
      end: { $gt: hold.start },
      status: { $in: ['confirmed', 'completed'] },
    }).lean();

    if (clash) {
      await ConsultationHold.updateOne({ _id: holdId }, { $set: { status: 'failed' } });
      throw AppError.badRequest('Slot already booked');
    }

    const off = await ConsultationOffering.findById(hold.offering).lean();
    if (!off || (off as any).isActive === false) {
      await ConsultationHold.updateOne({ _id: holdId }, { $set: { status: 'failed' } });
      throw AppError.badRequest('Offering غير متاح');
    }

    const inst = await InstructorProfile.findOne({ user: hold.instructor }).lean();

    const VAT_PERCENT = env.VAT_PERCENT ?? 0;
    const price = Number((off as any).priceHalalas ?? 0);
    const expectedVat = Math.round((VAT_PERCENT / 100) * price);
    const expectedGrand = price + expectedVat;

    // ✅ إنشاء Booking
    const booking = await ConsultationBooking.create({
      user: hold.user ?? new Types.ObjectId(orderUserId),
      instructor: hold.instructor,
      offering: {
        type: (off as any).type,
        title: (off as any).title,
        durationMinutes: (off as any).durationMinutes,
        priceHalalas: (off as any).priceHalalas,
      },
      start: hold.start,
      end: hold.end,
      applicant: {
        fullName: a.fullName,
        email: a.email,
        whatsapp: a.whatsapp,
        issueDescription: a.issueDescription,
      },
      meetingUrl: (inst as any)?.meetingUrl,
      status: 'confirmed',
      totals: {
        priceHalalas: price,
        vatHalalas: expectedVat,
        grandTotalHalalas: expectedGrand,
      },
      payment: {
        provider: 'moyasar',
        paymentId: orderPaymentId,
        currency: 'SAR',
        paidAt: new Date(),
        raw: payload,
      },
    });

    // ✅ تحديث Hold إلى paid + بيانات الدفع
    await ConsultationHold.updateOne(
      { _id: holdId },
      {
        $set: {
          status: 'paid',
          payment: {
            ...(hold.payment || { provider: 'moyasar', currency: 'SAR' }),
            paymentId: orderPaymentId,
            amountHalalas: expectedGrand,
            currency: 'SAR',
            vatHalalas: expectedVat,
          },
        },
      },
    );

    return { bookingId: String((booking as any)._id), already: false };
  } catch (err: any) {
    // ✅ لو أي حاجة فشلت بعد lock → علّم hold failed (إلا لو اتعمل expired)
    await ConsultationHold.updateOne(
      { _id: holdId, status: { $ne: 'expired' } },
      { $set: { status: 'failed' } },
    );
    throw err;
  }
}

// توحيد الكمية حسب النوع
function normalizeQty(itemType: SupportedCartType, isDigital: boolean, inputQty: number) {
  if (itemType === 'ConsultationHold') return 1;
  if (itemType === 'Book' && isDigital) return 1;

  const n = Math.max(1, Math.floor(Number(inputQty) || 1));
  return Math.min(MAX_QTY_PHYSICAL_BOOK, n);
}

// حساب الإجماليات
function computeTotals(lines: { lineTotalHalalas: number; requiresShipping: boolean }[]): {
  subtotalHalalas: number;
  shippingHalalas: number;
  vatHalalas: number;
  discountHalalas: number;
  grandTotalHalalas: number;
} {
  const subtotal = lines.reduce((s, l) => s + l.lineTotalHalalas, 0);
  const anyShipping = lines.some((l) => l.requiresShipping);
  const shipping = anyShipping ? SHIPPING_FLAT : 0;
  const vat = Math.round((VAT_PERCENT / 100) * (subtotal + shipping));
  const discount = 0; // لاحقًا لو ضفنا كوبونات
  const grand = subtotal + shipping + vat - discount;

  return {
    subtotalHalalas: subtotal,
    shippingHalalas: shipping,
    vatHalalas: vat,
    discountHalalas: discount,
    grandTotalHalalas: grand,
  };
}

// يبني Lines من الكارت مع تسعير لحظي + قواعد الكمية
async function buildOrderLinesFromCart(userId: string, opts?: { cartItemId?: string }) {
  const baseFilter: any = { user: userId, isDeleted: false };

  if (opts?.cartItemId) {
    baseFilter._id = opts.cartItemId;
  }

  const cartItems: ICartItem[] = await CartItem.find(baseFilter)
    .select('_id itemType itemRef quantity snapshot')
    .lean();

  if (!cartItems.length) {
    throw AppError.badRequest(
      opts?.cartItemId ? 'العنصر غير موجود في السلة' : 'سلة المشتريات فارغة',
    );
  }

  // ✅ Guard للـ holds (داخل الـ selection بس)
  const holdsCount = cartItems.filter((c) => c.itemType === 'ConsultationHold').length;
  if (holdsCount > 1) {
    throw AppError.badRequest('يمكن شراء استشارة واحدة فقط في كل عملية دفع');
  }

  const items: IOrder['items'] = [];

  for (const ci of cartItems) {
    const type = ci.itemType as SupportedCartType;

    if (type !== 'Book' && type !== 'ConsultationHold') {
      throw AppError.badRequest(`Unsupported item type in cart: ${type}`);
    }

    //     // ✅ Ownership + validity guard للـ hold (زيادة أمان عن priceForItem)
    //     if (type === 'ConsultationHold') {
    //       const hold = await ConsultationHold.findById(ci.itemRef)
    //         .select('status expiresAt user')
    //         .lean();

    //       if (!hold) throw AppError.notFound('Hold not found');
    //       if ((hold as any).status !== 'holding') throw AppError.badRequest('Hold غير صالح');
    //       if ((hold as any).expiresAt && new Date((hold as any).expiresAt) <= new Date()) {
    //         throw AppError.badRequest('Hold انتهى');
    //       }
    //       if ((hold as any).user && String((hold as any).user) !== String(userId)) {
    //         throw AppError.forbidden('هذا الـ Hold لا يخص هذا المستخدم');
    //       }
    //     }

    const priced = await priceForItem(type, String(ci.itemRef));

    const qty = normalizeQty(type, !!priced.snapshot.isDigital, ci.quantity);
    if (qty < 1) throw AppError.badRequest('كمية غير صالحة');

    const unit = priced.unitPriceHalalas;
    const line = unit * qty;

    items.push({
      _id: new Types.ObjectId(),
      type,
      refId: ci.itemRef as any,
      quantity: qty,
      unitPriceHalalas: unit,
      lineTotalHalalas: line,
      requiresShipping: priced.requiresShipping,
      snapshot: {
        ...priced.snapshot,
        cartItemId: String(ci._id),
        ...(type === 'ConsultationHold' ? { holdId: String(ci.itemRef) } : {}),
      } as any,
    } as any);
  }

  return items;
}

/**
 * ✅ إنشاء طلب من محتويات الكارت:
 * - Idempotency: يرجّع نفس النتيجة لو اتبعت نفس المفتاح
 * - يبني Lines من الكارت (priceForItem)
 * - يحسب الإجماليات + يتحقق من عنوان الشحن لو مطلوب
 * - ينشئ Payment على Moyasar ويرجع paymentUrl
 */

export async function createOrderFromCart(
  userId: string,
  {
    cartItemId,
    addressId,
    notes,
    idempotencyKey,
  }: { cartItemId?: string; addressId?: string; notes?: string; idempotencyKey?: string },
) {
  // 1) Idempotency: لو المفتاح اتكرر، رجّع الكاش
  if (idempotencyKey) {
    const cached = await getIfExists<{ order: IOrder; paymentUrl: string }>(idempotencyKey);
    if (cached) return cached;
  }

  // 2) بناء العناصر
  const items = await buildOrderLinesFromCart(userId, { cartItemId });

  // 3) الإجماليات + عنوان الشحن إن لزم
  const totals = computeTotals(items);

  let addressSnapshot: IOrder['address'] | undefined;
  const needsShipping = items.some((l) => l.requiresShipping);
  if (needsShipping) {
    if (!addressId) throw AppError.badRequest('عنوان الشحن مطلوب لهذا الطلب');
    const addr = await Address.findOne({ _id: addressId, user: userId, isDeleted: false }).lean();
    if (!addr) throw AppError.notFound('العنوان غير موجود');

    addressSnapshot = {
      label: addr.label,
      recipientName: addr.recipientName,
      phone: addr.phone,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      notes: addr.notes,
    };
  }

  // 4) تحقق مخزون الكتب الورقية قبل إنشاء الطلب
  const paperBooks = items.filter((it) => it.type === 'Book' && it.requiresShipping);
  if (paperBooks.length) {
    const ids = paperBooks.map((b) => b.refId);
    const books = await Book.find({ _id: { $in: ids }, isDeleted: false })
      .select('_id stock isDigital')
      .lean();
    const stockMap = new Map<string, number | null | undefined>();
    for (const b of books) stockMap.set(String(b._id), (b as any).stock);
    for (const it of paperBooks) {
      const stock = stockMap.get(String(it.refId));
      if (typeof stock !== 'number' || stock < it.quantity) {
        throw AppError.badRequest('الكمية غير متوفرة لمخزون الكتاب الورقي');
      }
    }
  }

  // 5) إنشاء الطلب في الداتابيز
  const order = await Order.create({
    user: userId,
    status: 'pending_payment',
    currency: 'SAR',
    items,
    // ↓ لو فيه شحن: خزّن الـ snapshot + المرجع
    addressRef: needsShipping ? (addressId as any) : undefined,
    address: addressSnapshot,
    totals,
    payment: {
      provider: 'moyasar',
      status: 'pending',
      amountHalalas: totals.grandTotalHalalas,
      currency: 'SAR',
    },
    notes,
    fulfillment: { status: 'none' },
  });

  // 6) إنشاء دفعة Moyasar
  const pay = await createMoyasarPayment({
    amountHalalas: order.totals.grandTotalHalalas,
    currency: 'SAR',
    description: `Order ${order._id}`,
    metadata: { orderId: String(order._id), userId },
    successUrl: env.MOYASAR_SUCCESS_URL,
    failUrl: env.MOYASAR_FAIL_URL,
  });

  // خزّن paymentId
  order.payment.paymentId = pay.paymentId;
  await order.save();

  const result = { order: order.toJSON(), paymentUrl: pay.paymentUrl };

  // 7) Idempotency: خزّن النتيجة
  if (idempotencyKey) {
    await saveOnce(idempotencyKey, result, 24 * 60 * 60 * 1000);
  }

  return result;
}

export async function createOrderForConsultationPaid(args: {
  userId?: string;
  bookingId: string;
  offeringTitle: { ar?: string; en?: string };
  priceHalalas: number;
  vatHalalas: number;
  grandTotalHalalas: number;
  paymentId: string;
  payload: MoyasarWebhookPayload;
}) {
  if (!args.userId) return null;

  const items: IOrder['items'] = [
    {
      _id: new Types.ObjectId(),
      type: 'ConsultationBooking',
      refId: new Types.ObjectId(args.bookingId),
      quantity: 1,
      unitPriceHalalas: args.priceHalalas,
      lineTotalHalalas: args.priceHalalas,
      requiresShipping: false,
      snapshot: {
        title: args.offeringTitle,
        isDigital: true,
        bookingId: args.bookingId,
      },
    },
  ];

  const totals = {
    subtotalHalalas: args.priceHalalas,
    shippingHalalas: 0,
    vatHalalas: args.vatHalalas,
    discountHalalas: 0,
    grandTotalHalalas: args.grandTotalHalalas,
  };

  const order = await Order.create({
    user: args.userId,
    status: 'paid',
    currency: 'SAR',
    items,
    totals,
    payment: {
      provider: 'moyasar',
      paymentId: args.paymentId,
      status: 'paid',
      amountHalalas: args.grandTotalHalalas,
      currency: 'SAR',
      paidAt: new Date(),
      raw: args.payload,
    },
    fulfillment: { status: 'none' },
  });

  return order.toJSON();
}

/**
 * ✅ Webhook من Moyasar
 * - يحدّث حالة الطلب (paid/failed)
 * - يخصم المخزون للكتب الورقية عند الدفع
 */
export async function handleMoyasarWebhook(payload: MoyasarWebhookPayload) {
  const { id: paymentId, status, amount, metadata, currency } = payload as any;

  let order = await Order.findOne({ 'payment.paymentId': paymentId });
  if (!order && metadata?.orderId) order = await Order.findById(metadata.orderId);
  if (!order) throw AppError.notFound('Order not found for this payment');

  if (order.status === 'paid') return { ok: true };
  if (order.status === 'paid_review') return { ok: true };

  if (status === 'paid') {
    const expectedAmount = Number(order.payment.amountHalalas ?? 0);
    const receivedAmount = typeof amount === 'number' ? amount : Number(amount);
    const receivedCurrency = currency ? String(currency) : 'SAR';

    const tolerance = 100; // 1 SAR

    // currency mismatch => paid_review
    if (receivedCurrency !== 'SAR') {
      order.status = 'paid_review';
      order.payment.status = 'paid';
      order.payment.paidAt = new Date();
      order.payment.raw = payload;
      order.payment.discrepancy = {
        reason: 'currency_mismatch',
        expectedAmountHalalas: expectedAmount,
        receivedAmountHalalas: Number.isFinite(receivedAmount) ? receivedAmount : undefined,
        expectedCurrency: 'SAR',
        receivedCurrency,
        deltaHalalas: Number.isFinite(receivedAmount) ? receivedAmount - expectedAmount : undefined,
      };
      await order.save();
      const paidCartItemIds = order.items.map((it: any) => it.snapshot?.cartItemId).filter(Boolean);

      if (paidCartItemIds.length) {
        await CartItem.updateMany(
          { _id: { $in: paidCartItemIds }, user: order.user, isDeleted: false },
          { $set: { isDeleted: true } },
        );
      }
      return { ok: true, review: true, reason: 'currency_mismatch' };
    }

    // amount mismatch => paid_review
    if (Number.isFinite(receivedAmount) && Math.abs(receivedAmount - expectedAmount) > tolerance) {
      order.status = 'paid_review';
      order.payment.status = 'paid';
      order.payment.paidAt = new Date();
      order.payment.raw = payload;
      order.payment.discrepancy = {
        reason: 'amount_mismatch',
        expectedAmountHalalas: expectedAmount,
        receivedAmountHalalas: receivedAmount,
        expectedCurrency: 'SAR',
        receivedCurrency: 'SAR',
        deltaHalalas: receivedAmount - expectedAmount,
      };
      await order.save();
      const paidCartItemIds = order.items.map((it: any) => it.snapshot?.cartItemId).filter(Boolean);

      if (paidCartItemIds.length) {
        await CartItem.updateMany(
          { _id: { $in: paidCartItemIds }, user: order.user, isDeleted: false },
          { $set: { isDeleted: true } },
        );
      }

      return { ok: true, review: true, reason: 'amount_mismatch' };
    }

    // ✅ 1) خصم مخزون الكتب الورقية + warnings لو فشل
    order.payment.warnings = order.payment.warnings || [];

    for (const it of order.items) {
      if (it.type !== 'Book' || !it.requiresShipping) continue;

      const r = await Book.updateOne(
        { _id: it.refId, stock: { $gte: it.quantity }, isDeleted: false },
        { $inc: { stock: -it.quantity } },
      );

      if (r.matchedCount === 0) {
        order.payment.warnings.push({
          kind: 'stock_decrement_failed',
          refId: String(it.refId),
          qty: it.quantity,
          at: new Date(),
          message:
            'Stock decrement failed (no match for stock >= qty). Manual review may be required.',
        });
      }
    }

    // ✅ 2) ConsultationHold → Booking ثم تحديث order item => ConsultationBooking
    const holdIdx = order.items.findIndex((x: any) => x.type === 'ConsultationHold');

    // multiple holds => logical_mismatch
    const holdsCount = order.items.filter((x: any) => x.type === 'ConsultationHold').length;
    if (holdsCount > 1) {
      order.status = 'paid_review';
      order.payment.status = 'paid';
      order.payment.paidAt = new Date();
      order.payment.raw = payload;
      order.payment.discrepancy = {
        reason: 'logical_mismatch',
        expectedAmountHalalas: expectedAmount,
        receivedAmountHalalas: Number.isFinite(receivedAmount) ? receivedAmount : undefined,
        expectedCurrency: 'SAR',
        receivedCurrency: 'SAR',
        deltaHalalas: Number.isFinite(receivedAmount) ? receivedAmount - expectedAmount : undefined,
        details: {
          message: 'Multiple ConsultationHold items found in one order. Not allowed.',
          holdIds: order.items
            .filter((x: any) => x.type === 'ConsultationHold')
            .map((x: any) => String(x.refId)),
        },
      };
      await order.save();
      const paidCartItemIds = order.items.map((it: any) => it.snapshot?.cartItemId).filter(Boolean);

      if (paidCartItemIds.length) {
        await CartItem.updateMany(
          { _id: { $in: paidCartItemIds }, user: order.user, isDeleted: false },
          { $set: { isDeleted: true } },
        );
      }
      return { ok: true, review: true, reason: 'logical_mismatch' };
    }

    if (holdIdx !== -1) {
      const holdId = String((order.items[holdIdx] as any).refId);

      const { bookingId } = await finalizeConsultationHoldToBooking({
        orderUserId: String(order.user),
        holdId,
        orderPaymentId: String(order.payment.paymentId || paymentId),
        payload,
      });

      // ✅ هنا التحويل الحقيقي
      (order.items[holdIdx] as any).type = 'ConsultationBooking';
      (order.items[holdIdx] as any).refId = new Types.ObjectId(bookingId);

      // (اختياري مفيد)
      (order.items[holdIdx] as any).snapshot = {
        ...(order.items[holdIdx] as any).snapshot,
        holdId,
        bookingId,
        isDigital: true,
      };
    }

    // ✅ 3) تحديث حالة الأوردر
    order.status = 'paid';
    order.payment.status = 'paid';
    order.payment.paidAt = new Date();
    order.payment.raw = payload;
    await order.save();

    // ✅ 4) تفريغ الكارت
    const paidCartItemIds = order.items.map((it: any) => it.snapshot?.cartItemId).filter(Boolean);

    if (paidCartItemIds.length) {
      await CartItem.updateMany(
        { _id: { $in: paidCartItemIds }, user: order.user, isDeleted: false },
        { $set: { isDeleted: true } },
      );
    }

    // TODO: إرسال ايميل تأكيد + روابط تحميل للرقمي + تفعيل الكورسات (لاحقًا)
    return { ok: true };
  }

  if (status === 'failed') {
    order.status = 'failed';
    order.payment.status = 'failed';
    order.payment.raw = payload;
    await order.save();
    return { ok: true };
  }

  return { ok: false };
}

/** ✅ طلبات المستخدم */
export async function listMyOrders(userId: string, page = 1, limit = 10) {
  const safePage = Math.max(1, page | 0);
  const safeLimit = Math.min(100, Math.max(1, limit | 0));
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    Order.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    Order.countDocuments({ user: userId }),
  ]);

  const pages = Math.max(1, Math.ceil(total / safeLimit));
  return {
    items,
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      pages,
      hasNextPage: safePage < pages,
      hasPrevPage: safePage > 1,
    },
  };
}

/** ✅ طلب واحد (مع تحقق الملكية) */
export async function getMyOrder(userId: string, orderId: string) {
  const order = await Order.findById(orderId).lean();
  if (!order) throw AppError.notFound('Order not found');
  if (String(order.user) !== String(userId)) throw AppError.forbidden('Not your order');
  return order;
}
