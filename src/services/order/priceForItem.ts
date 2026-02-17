// src/services/order/priceForItem.ts
import AppError from '../../utils/AppError';
import Book from '../../models/Book';
import ConsultationHold from '../../models/ConsultationHold';
import ConsultationOffering from '../../models/ConsultationOffering';

// import Course from '../../models/Course';

type ItemType = 'Book' | 'Course' | 'ConsultationHold';

export type PriceItemResult = {
  unitPriceHalalas: number;
  snapshot: {
    title: { ar?: string; en?: string };
    slug?: string;
    image?: string;
    isDigital?: boolean;
  };
  requiresShipping: boolean;
};

/* ================= Helpers ================= */

function toNonNegInt(n: any, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

/** يرجّع أقل سعر صالح بين list والسيلز، وإلا يرجّع list أو 0 كـ fallback */
function effectiveUnitPriceHalalas(input: {
  priceHalalas?: number | null;
  salesPriceHalalas?: number | null;
}): number {
  const list = toNonNegInt(input.priceHalalas, 0);
  const sale = input.salesPriceHalalas;
  if (typeof sale === 'number' && sale >= 0 && sale <= list) return Math.floor(sale);
  return list;
}

/** يطبّع العنوان إلى LocalizedText حتى لو جالك String */
function toLocalizedTitle(raw: any): { ar?: string; en?: string } {
  if (raw && typeof raw === 'object' && ('ar' in raw || 'en' in raw)) {
    return raw as { ar?: string; en?: string };
  }
  const s = raw == null ? '' : String(raw);
  return s ? { ar: s } : {};
}

/* ================ Core ================= */

/**
 * يرجّع تفاصيل التسعير لعنصر واحد:
 * - unitPriceHalalas: السعر النهائي بالهللات (دائمًا رقم)
 * - snapshot: بيانات واجهة (title, slug, image, isDigital)
 * - requiresShipping: هل يحتاج شحن (كتب ورقية فقط)
 */
export async function priceForItem(itemType: ItemType, itemId: string): Promise<PriceItemResult> {
  switch (itemType) {
    case 'Book': {
      const book = await Book.findById(itemId)
        .select('title slug image isDigital priceHalalas salesPriceHalalas isDeleted stock')
        .lean();

      if (!book || (book as any).isDeleted) throw AppError.notFound('Book not found');

      const unit = effectiveUnitPriceHalalas({
        priceHalalas: (book as any).priceHalalas,
        salesPriceHalalas: (book as any).salesPriceHalalas,
      });

      const isDigital = Boolean((book as any).isDigital);

      // (اختياري قوي) منع شراء الورقي لو المخزون 0
      if (!isDigital) {
        const stock = Number((book as any).stock ?? 0);
        if (!Number.isFinite(stock) || stock <= 0) {
          throw AppError.badRequest('هذا الكتاب الورقي غير متوفر في المخزون');
        }
      }

      return {
        unitPriceHalalas: unit,
        snapshot: {
          title: toLocalizedTitle((book as any).title),
          slug: (book as any).slug,
          image: (book as any).image,
          isDigital,
        },
        requiresShipping: !isDigital,
      };
    }

    case 'ConsultationHold': {
      const hold = await ConsultationHold.findById(itemId)
        .select('user instructor status start end expiresAt offering applicant')

        .lean();

      if (!hold) throw AppError.notFound('Hold not found');
      if ((hold as any).status !== 'holding') throw AppError.badRequest('Hold غير صالح');
      if ((hold as any).expiresAt && new Date((hold as any).expiresAt) <= new Date()) {
        throw AppError.badRequest('Hold انتهى');
      }

      const off = await ConsultationOffering.findById((hold as any).offering)
        .select('title priceHalalas isActive')
        .lean();

      if (!off || (off as any).isActive === false) throw AppError.badRequest('Offering غير متاح');

      const unit = toNonNegInt((off as any).priceHalalas, 0);

      return {
        unitPriceHalalas: unit, // ✅ VAT في totals
        snapshot: {
          title: toLocalizedTitle((off as any).title),
          slug: String((hold as any)._id),
          image: undefined,
          isDigital: true,
        },
        requiresShipping: false,
      };
    }

    case 'Course':
      throw AppError.badRequest('Courses are not purchasable via cart yet');
    // TODO
    // const course = await Course.findById(itemId)
    //   .select('title slug image priceHalalas salesPriceHalalas isDeleted')
    //   .lean();

    // if (!course || (course as any).isDeleted) {
    //   throw AppError.notFound('Course not found');
    // }

    // const unit = effectiveUnitPriceHalalas({
    //   priceHalalas: (course as any).priceHalalas,
    //   salesPriceHalalas: (course as any).salesPriceHalalas,
    // });

    // return {
    //   unitPriceHalalas: unit,
    //   snapshot: {
    //     title: toLocalizedTitle((course as any).title),
    //     slug: (course as any).slug,
    //     image: (course as any).image,
    //     isDigital: true,
    //   },
    //   requiresShipping: false,
    // };
    // }

    default:
      throw AppError.badRequest('Unsupported item type');
  }
}
