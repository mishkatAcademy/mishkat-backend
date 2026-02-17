# Books Module – موديول الكتب

المسؤول عن إدارة الكتب (رقمية/ورقية)، مع دعم الغلاف، ملف الـ PDF، التصنيفات، الأسعار، والبحث في الكاتالوج.

---

## 1. Data Model – Book

## 1.1 Book Document (MongoDB / Mongoose)

اسم الموديل: `Book`

الفييلدز الأساسية:

- `title: { ar?: string; en?: string }`
  - عنوان الكتاب (محلي عربي/إنجليزي).
  - مطلوب: لازم يكون في واحد على الأقل (ar أو en).
- `slug: string`
  - حلقة URL-friendly مشتقة من العنوان.
  - فريد على الكتب غير المحذوفة (`isDeleted: false`) عن طريق index جزئي.
- `description?: { ar?: string; en?: string }`
  - وصف الكتاب (محلي).
- `author: { ar?: string; en?: string }`
  - اسم المؤلف، مطلوب (ar أو en).
- `publisher?: { ar?: string; en?: string }`
  - الناشر (اختياري).
- `language: 'ar' | 'en'`
  - لغة الكتاب، الافتراضي: `'ar'`.

صور + ملفات:

- `image?: string`
  - URL لصورة الغلاف (قد يكون ملف مرفوع أو URL خارجي).
- `imageRelPath?: string`
  - المسار النسبي للملف داخليًا على السيرفر (يُستخدم لحذف الملف فقط – لا يُرجع للـ client).
- `pdfUrl?: string`
  - رابط ملف PDF للكتاب الرقمي (مطلوب عمليًا للكتب الرقمية).
- `pdfRelPath?: string`
  - المسار النسبي لملف PDF (للحذف الداخلي – لا يُرجع للـ client).

الأسعار (بالهللة):

- `priceHalallas: number`
  - السعر الأساسي بالهللة.
  - ≥ 0 وقيمة صحيحة (Integer).
- `salesPriceHalallas?: number | null`
  - سعر التخفيض بالهللة (اختياري).
  - يجب أن يكون ≤ `priceHalallas` إن وُجد.

نوع الكتاب والمخزون:

- `isDigital: boolean`
  - `true`: كتاب رقمي (PDF).
  - `false`: كتاب ورقي.
- `stock?: number | null`
  - للكتب الورقية:
    - ≥ 0.
  - للكتب الرقمية:
    - يجب أن تكون `null` (يُضبَط تلقائيًا).

تصنيفات + ميتاداتا:

- `categories?: ObjectId[]`
  - مصفوفة IDs لتصنيفات من موديل `Category`.
- `showInHomepage: boolean`
  - هل يظهر في سكشن الكتب المميزة في الصفحة الرئيسية؟

التقييمات:

- `avgRating: number` (افتراضي 5، بين 0 و 5)
- `ratingsCount: number` (افتراضي 0)

نشر وطباعه:

- `pages?: number`
  - عدد الصفحات (≥ 1).
- `publishDate?: Date`
- `isbn?: string`
  - يتحقق من شكل ISBN-10 / ISBN-13 بشكل مبسط، مع أو بدون شرطات.

إدارة:

- `soldCount: number` (افتراضي 0)
- `isDeleted: boolean` (soft delete، افتراضي `false`, عليه index)
- `createdAt: Date` (من `timestamps`)
- `updatedAt: Date` (من `timestamps`)

### 1.2 Virtuals (قراءة فقط)

يتم حسابها تلقائيًا وتُرجع مع `toJSON` و `.lean({ virtuals: true })`:

- `priceSAR?: number`
  - `priceHalallas / 100`.
- `salesPriceSAR?: number | null`
  - `salesPriceHalallas / 100` أو `null`.
- `effectivePriceHalallas?: number`
  - لو `salesPriceHalallas` صالحة → تستخدمها، وإلا يستخدم `priceHalallas`.
- `effectivePriceSAR?: number`
  - `effectivePriceHalallas / 100`.
- `isOnSale?: boolean`
  - `true` لو فيه `salesPriceHalallas < priceHalallas`.
- `isInStock?: boolean`
  - `true` دائمًا لو `isDigital = true`.
  - للورقي: `stock > 0`.

---

## 2. Validation Layer – Zod Schemas

الملف: `src/validations/book.schema.ts`

### 2.1 Helpers

- `localizedTextSchema`
  - شكل عام لنص محلي:

    ```ts
    {
      ar?: string; // trim + min(1) لو موجود
      en?: string; // trim + min(1) لو موجود
    }
    ```

  - شرط: لازم واحد على الأقل من `ar`, `en`.

- `moneyNumber`
  - رقم (ريال) يتم تحويله من سترنج عند الحاجة (`z.coerce.number()`).
  - ≥ 0، ≤ خانتين عشريتين.
- `isbnSchema`
  - `string` بين 10 و 17 حرفًا بعد الـ trim (تحقق مبسط).
- `objectId`
  - سترنج 24 خانة hex.

### 2.2 `createBookSchema`

Body (JSON أو `multipart/form-data` بعد تحويل):

- `title: localizedTextSchema` ✅ مطلوب.
- `description?: localizedTextSchema`.
- `author: localizedTextSchema` ✅ مطلوب.
- `publisher?: localizedTextSchema`.
- `language?: 'ar' | 'en'` (افتراضي `'ar'`).
- `image?: string (url)` (اختياري – الغلاف ممكن يترفع ملفًا).
- `price: number` (ريال، بالـ decimal).
- `salesPrice?: number` (اختياري).
- `isDigital?: boolean` (coerce, افتراضي `true`).
- `pdfUrl?: string (url)` (اختياري هنا – ممكن ييجي من ملف).
- `stock?: number`
  - للورقي فقط.
- `categories?: string[]` (ObjectId) (افتراضي `[]`).
- `showInHomepage?: boolean` (افتراضي `false`).
- `pages?: number (int ≥ 1)`.
- `publishDate?: Date` (coerce من سترنج).
- `isbn?: string` (تحقق مبسط).

Rules (superRefine):

- لو `salesPrice` موجودة:
  - يجب أن تكون ≤ `price`.
- لو `isDigital === true`:
  - يمنع `stock` كرقم (يجب أن تكون فارغة/غير رقمية).
- لو `isDigital === false` (كتاب ورقي):
  - يجب أن يكون `stock` رقمًا.

### 2.3 `updateBookSchema`

Body (كل الحقول اختيارية):

- نفس فييلدز `createBookSchema` لكن كلها `optional`.
- `stock` يسمح أن يكون `number` أو `null`.

Rules:

- لو `price` و `salesPrice` موجودين معًا:
  - `salesPrice ≤ price`.
- لو `isDigital === true`:
  - يمنع `stock` كرقم (نفس القاعدة).

### 2.4 `bookIdParamsSchema`

Parameters:

- `id: string` (24 hex).

### 2.5 `bookQuerySchema` (قائمة عامة + search)

Query params:

- `page?: number` (coerce, int ≥ 1, default 1)
- `limit?: number` (coerce, int من 1 لحد 100, default 10)
- `includeDeleted?: boolean` (افتراضي `false`)
- `search?: string` (اختياري)
- `categories?: string` (CSV: `"id1,id2,..."`)
- `language?: 'ar' | 'en'`
- `isDigital?: boolean`
- `inStock?: boolean`
- `showInHomepage?: boolean`
- `minPrice?: number` (ريال، coerce, ≥ 0)
- `maxPrice?: number` (ريال، coerce, ≥ 0)
- `sort?: string` (افتراضي `'createdAt:desc'`)

### 2.6 `homepageBooksQuerySchema`

Query params:

- `limit?: number` (1–50, default 12)
- `language?: 'ar' | 'en'`
- `isDigital?: boolean`
- `inStock?: boolean`

---

## 3. Service Layer – `src/services/bookService.ts`

### 3.1 Types

- `CreateBookInput`
  - مطابق تقريبًا لـ `createBookSchema` لكن:
    - `price`, `salesPrice` بالريال (`number`).
- `UpdateBookInput = Partial<CreateBookInput>`
- `ListBooksInput`
  - مطابق تقريبًا لـ `bookQuerySchema`.

### 3.2 Helpers

- `parseSort(sortStr?: string): Record<string, 1 | -1>`
  - مثال: `"createdAt:desc,price:asc"`.
- `parseCategoriesCSV(csv?: string): string[] | undefined`
  - يحول `"id1,id2"` → `[id1, id2]` لو 24 hex.
- `incBooksCount(catIds, delta)`
  - يستدعي `Category.incCount(id, 'book', delta)` للتصنيفات المربوطة.
- `buildBooksQuery(input)`
  - يبني فلتر Mongo من:
    - includeDeleted, language, isDigital, showInHomepage
    - price range (minPrice/maxPrice → halalas)
    - categories (CSV)
    - inStock (digital always true, paper stock > 0)
    - search (RegExp على title/author/description/slug/isbn).

### 3.3 `createBook(data: CreateBookInput)`

- يبني `slug` من `title` باستخدام:
  - `slugFromLocalized`
  - `makeUniqueSlug(Book, desired)`
- يحوّل:
  - `price` → `priceHalallas` (باستخدام `toHalalas`).
  - `salesPrice` → `salesPriceHalallas` (لو موجودة).
- يتحقق:
  - لو `salesPriceHalallas > priceHalallas` → `AppError.badRequest`.
- يحدد:
  - `isDigital` (افتراضي `true`).
  - للرقمي:
    - يستخدم `data.pdfUrl` (لو موجود).
    - `stock = null`.
  - للورقي:
    - `pdfUrl = undefined`.
    - `stock = data.stock ?? 0`.
- ينشئ `Book` جديد.
- ينادي `incBooksCount(doc.categories, +1)`.
- يرجع `doc.toJSON()` (مع virtuals لو مفعّلة في `lean` فقط، هنا doc.toJSON يشمل virtuals).

### 3.4 `createBookWithUploads(data, files)`

Parameters:

- `data: CreateBookInput`
- `files: { cover?: Express.Multer.File; pdf?: Express.Multer.File }`

Logic:

- نفس منطق `createBook` لكن:
  - الغلاف:
    - لو `files.cover` موجود:
      - يحفظه عبر `moveDiskFileToUploads(files.cover, 'images/books')`.
      - يخزّن:
        - `image = saved.url`
        - `imageRelPath = saved.relPath`
    - وإلا لو `data.image` موجود:
      - يستخدمه كـ URL خارجي.
  - الملف الرقمي:
    - يحدد `isDigital` (افتراضي `true`).
    - لو `isDigital`:
      - لو `files.pdf`:
        - يحفظه عبر `moveDiskFileToUploads(files.pdf, 'files/books')`.
        - يخزّن `pdfUrl`, `pdfRelPath`.
      - وإلا لو `data.pdfUrl` موجود:
        - يستخدمه.
      - غير كده → `AppError.badRequest('ملف PDF أو رابط PDF مطلوب للكتاب الرقمي')`.
    - لو ورقي:
      - `pdfUrl`/`pdfRelPath` لا تُستخدم.
      - `stock = data.stock ?? 0`.
- ينشئ `Book`.
- ينادي `incBooksCount`.
- يرجع `doc.toJSON()`.

### 3.5 `listBooks(input: ListBooksInput)`

- يحسب:
  - `page`, `limit`, `skip`.
- يبني:
  - `q = buildBooksQuery(input)`.
  - `sort = parseSort(input.sort)`.
- ينفذ:
  - `Book.find(q).sort(sort).skip(skip).limit(limit).lean({ virtuals: true })`.
  - `Book.countDocuments(q)`.
- يرجع:

  ```ts
  {
    items: Book[],
    meta: {
      total,
      page,
      limit,
      pages,
      hasNextPage,
      hasPrevPage,
    },
  }
  ```

### 3.6 `getBook(id: string)`

- يبحث عن الكتاب:
  - `Book.findById(id).lean()`
- شروط:
  - لو **لا يوجد كتاب** أو `isDeleted === true` → يرمي:
    - `AppError.notFound('الكتاب غير موجود')`
- يرجّع:
  - الدوكيومنت كـ JSON (بما فيها الـ virtuals لو متفعّلين في الـ schema).

---

### 3.7 `updateBook(id, data: UpdateBookInput)`

**الهدف:** تحديث كتاب بدون التعامل مع ملفات (روابط فقط).

**الخطوات:**

1. **جلب الكتاب:**
   - `const doc = await Book.findById(id);`
   - لو `!doc` أو `doc.isDeleted` → `AppError.notFound('الكتاب غير موجود')`.

2. **العنوان والـ slug:**
   - لو `data.title` موجود:
     - يبني `desired = slugFromLocalized(data.title)`.
     - يستدعي:

       ```ts
       doc.slug = await makeUniqueSlug(Book, desired, {
         excludeId: String(doc._id),
         filter: { isDeleted: false },
       });
       ```

     - يحدّث: `doc.title = data.title`.

3. **حقول النصوص والبسيطة:**
   - لو `data.description` !== undefined → `doc.description = data.description`.
   - لو `data.author` !== undefined → `doc.author = data.author`.
   - لو `data.publisher` !== undefined → `doc.publisher = data.publisher`.
   - لو `data.language` !== undefined → `doc.language = data.language`.
   - لو `data.image` !== undefined → `doc.image = data.image`.
   - لو `typeof data.showInHomepage === 'boolean'` → يحدّث `doc.showInHomepage`.
   - لو `typeof data.pages === 'number'` → `doc.pages = data.pages`.
   - لو `data.publishDate !== undefined` → `doc.publishDate = data.publishDate`.
   - لو `data.isbn !== undefined` → `doc.isbn = data.isbn`.

4. **الأسعار:**
   - لو `typeof data.price === 'number'`:
     - `doc.priceHalallas = toHalalas(data.price)`.
   - لو `typeof data.salesPrice === 'number'`:
     - `doc.salesPriceHalallas = toHalalas(data.salesPrice)`.
   - لو `data.salesPrice === null`:
     - `doc.salesPriceHalallas = null`.
   - بعد التحديث:
     - لو `typeof doc.salesPriceHalallas === 'number' && doc.salesPriceHalallas > doc.priceHalallas`:
       - يرمي: `AppError.badRequest('سعر التخفيض يجب أن يكون أقل من أو يساوي السعر')`.

5. **الطبيعة (رقمي/ورقي):**
   - لو `typeof data.isDigital === 'boolean'`:
     - `doc.isDigital = data.isDigital`.

   - لو `doc.isDigital === true` (رقمي):
     - لو `typeof data.pdfUrl === 'string'`:
       - `await deleteLocalByRelPath(doc.pdfRelPath);`
       - `doc.pdfUrl = data.pdfUrl;`
       - `doc.pdfRelPath = undefined;`
     - لو بعد التعديلات **لا يوجد** `doc.pdfUrl`:
       - يرمي: `AppError.badRequest('رابط PDF مطلوب للكتاب الرقمي')`.
     - يضبط: `doc.stock = null;`.

   - لو `doc.isDigital === false` (ورقي):
     - لو `typeof data.stock === 'number'`:
       - `doc.stock = data.stock;`
     - لو `typeof doc.stock !== 'number'`:
       - `doc.stock = 0;`
     - (اختياري) ممكن تنظيف `pdfUrl`/`pdfRelPath` عند التحويل لورقي لو حبيت.

6. **التصنيفات (categories):**
   - لو `Array.isArray(data.categories)`:
     - `const before = (doc.categories || []).map((x) => String(x));`
     - `const after = data.categories;`
     - `const removed = before.filter((id) => !after.includes(id));`
     - `const added = after.filter((id) => !before.includes(id));`
     - `doc.categories = after as any;`
     - `await Promise.all([incBooksCount(added, +1), incBooksCount(removed, -1)]);`

7. **الحفظ والنتيجة:**
   - `await doc.save();`
   - `return doc.toJSON();`

---

### 3.8 `updateBookWithUploads(id, data, files)`

**الهدف:** تحديث كتاب مع دعم رفع/تغيير ملفات الغلاف وملف الـ PDF.

**Signature:**

- `id: string`
- `data: UpdateBookInput`
- `files: { cover?: Express.Multer.File; pdf?: Express.Multer.File }`

**الخطوات:**

1. **جلب الكتاب والتحقق:**
   - `const doc = await Book.findById(id);`
   - لو `!doc` أو `doc.isDeleted`:
     - `AppError.notFound('الكتاب غير موجود')`.

2. **العنوان + slug:**
   - لو `data.title` موجود:
     - `desired = slugFromLocalized(data.title);`
     - `doc.slug = await makeUniqueSlug(Book, desired, { excludeId: String(doc._id), filter: { isDeleted: false } });`
     - `doc.title = data.title;`

3. **الحقول النصّية والميتا:**
   - `description`, `author`, `publisher`, `language`, `showInHomepage`, `pages`, `publishDate`, `isbn`
   - كلها يتم تحديثها لو موجودة في `data` بنفس منطق:
     - `if (typeof data.field !== 'undefined') doc.field = data.field;`

4. **الأسعار:**
   - لو `price` موجود → `doc.priceHalallas = toHalalas(data.price);`
   - لو `salesPrice` موجود → `doc.salesPriceHalallas = toHalalas(data.salesPrice);`
   - لو `salesPrice === null` → `doc.salesPriceHalallas = null;`
   - بعد التعديل:
     - لو `typeof doc.salesPriceHalallas === 'number' && doc.salesPriceHalallas > doc.priceHalallas`:
       - `AppError.badRequest('سعر التخفيض يجب أن يكون أقل من أو يساوي السعر');`

5. **الغلاف (cover):**
   - لو `files.cover` موجود:
     - `const saved = await moveDiskFileToUploads(files.cover, 'images/books');`
     - `await deleteLocalByRelPath(doc.imageRelPath);`
     - `doc.image = saved.url;`
     - `doc.imageRelPath = saved.relPath;`
   - else لو `typeof data.image === 'string'`:
     - `doc.image = data.image;`
     - (اختياري) ممكن تصفير `imageRelPath`.

6. **الطبيعة (رقمي/ورقي) + PDF:**
   - لو `typeof data.isDigital === 'boolean'`:
     - `doc.isDigital = data.isDigital;`

   - لو `doc.isDigital === true` (رقمي):
     - لو `files.pdf` موجود:
       - `const saved = await moveDiskFileToUploads(files.pdf, 'files/books');`
       - `await deleteLocalByRelPath(doc.pdfRelPath);`
       - `doc.pdfUrl = saved.url;`
       - `doc.pdfRelPath = saved.relPath;`

     - else لو `typeof data.pdfUrl === 'string'`:
       - `await deleteLocalByRelPath(doc.pdfRelPath);`
       - `doc.pdfUrl = data.pdfUrl;`
       - `doc.pdfRelPath = undefined;`

     - في النهاية:
       - لو `!doc.pdfUrl`:
         - `AppError.badRequest('ملف PDF أو رابط PDF مطلوب للكتاب الرقمي');`
       - `doc.stock = null;`

   - لو `doc.isDigital === false` (ورقي):
     - لو `typeof data.stock === 'number'`:
       - `doc.stock = data.stock;`
     - لو `typeof doc.stock !== 'number'`:
       - `doc.stock = 0;`

     - لو `files.pdf` موجود **أو** `typeof data.pdfUrl === 'string'`:
       - `await deleteLocalByRelPath(doc.pdfRelPath);`
       - `doc.pdfUrl = undefined as any;`
       - `doc.pdfRelPath = undefined;`

7. **التصنيفات (categories):**
   - لو `Array.isArray(data.categories)`:
     - نفس منطق `updateBook`:
       - احسب `before`, `after`, `added`, `removed`.
       - حدّث `doc.categories`.
       - `await incBooksCount(added, +1);`
       - `await incBooksCount(removed, -1);`

8. **الحفظ والنتيجة:**
   - `await doc.save();`
   - `return doc.toJSON();`

---

### 3.9 `softDeleteBook(id: string)`

**الهدف:** حذف منطقي (Soft delete) لكتاب.

**الخطوات:**

1. `const doc = await Book.findById(id);`
2. لو:
   - `!doc` أو `doc.isDeleted`:
     - `AppError.notFound('الكتاب غير موجود أو محذوف');`
3. يضبط:
   - `doc.isDeleted = true;`
   - `await doc.save();`
4. يعدّل عدّاد الكتب في التصنيفات المرتبطة:
   - `await incBooksCount(doc.categories as ObjectId[], -1);`

---

### 3.10 `restoreBook(id: string)`

**الهدف:** استرجاع كتاب تم حذفه منطقيًا.

**الخطوات:**

1. `const doc = await Book.findById(id);`
2. لو `!doc`:
   - `AppError.notFound('الكتاب غير موجود');`
3. لو `!doc.isDeleted`:
   - يرجع بدون تغيير (الكتاب غير محذوف أساسًا).
4. يبني slug مناسب:
   - `const desired = doc.slug || slugFromLocalized(doc.title);`
   - `doc.slug = await makeUniqueSlug(Book, desired, { excludeId: String(doc._id), filter: { isDeleted: false } });`
5. يضبط:
   - `doc.isDeleted = false;`
   - `await doc.save();`
6. يزوّد عدّاد الكتب في التصنيفات المرتبطة:
   - `await incBooksCount(doc.categories as ObjectId[], +1);`

---

### 3.11 `getHomepageBooks(input)`

**الهدف:** جلب كتب مميزة للصفحة الرئيسية.

**Input:**

- `limit?: number` → من 1 إلى 50 (الافتراضي 12).
- `language?: 'ar' | 'en'`.
- `isDigital?: boolean`.
- `inStock?: boolean`.

**Logic:**

1. يحسب `limit` بالـ clamp:
   - `const limit = Math.min(50, Math.max(1, input.limit ?? 12));`
2. يبني الاستعلام `q`:
   - `q.isDeleted = false;`
   - `q.showInHomepage = true;`
   - لو `input.language` → `q.language = input.language;`
   - لو `typeof input.isDigital === 'boolean'` → `q.isDigital = input.isDigital;`
   - لو `input.inStock === true`:
     - `q.$or = [{ isDigital: true }, { isDigital: false, stock: { $gt: 0 } }];`
3. ينفّذ:
   - `const items = await Book.find(q).sort({ createdAt: -1 }).limit(limit).lean();`
4. يرجع:
   - `return items;`

---

### 3.12 `getBooksWithCategories(input: ListBooksInput)`

**الهدف:** ترجيع الكتب + التصنيفات (Categories) غير الفارغة في نفس الـ response.

**Input (ملخّص):**

- `page?: number`
- `limit?: number`
- `includeDeleted?: boolean`
- `search?: string`
- `categories?: string` (CSV)
- `language?: 'ar' | 'en'`
- `isDigital?: boolean`
- `inStock?: boolean`
- `showInHomepage?: boolean`
- `minPrice?: number`
- `maxPrice?: number`
- `sort?: string`

**Logic:**

1. يحسب Pagination:
   - `const page = Math.max(1, input.page || 1);`
   - `const limit = Math.min(100, Math.max(1, input.limit || 10));`
   - `const skip = (page - 1) * limit;`
2. يبني:
   - `const q = buildBooksQuery(input);`
   - `const sort = parseSort(input.sort);`
3. في `Promise.all`:
   - `Book.find(q).sort(sort).skip(skip).limit(limit).lean()`
   - `Book.countDocuments(q)`
   - `Category.find({ isDeleted: false, booksCount: { $gt: 0 }, scopes: 'book' }).sort({ order: 1, createdAt: -1 }).lean()`
4. يحسب:
   - `const pages = Math.max(1, Math.ceil(total / limit));`
   - `meta = { total, page, limit, pages, hasNextPage: page < pages, hasPrevPage: page > 1 };`
5. يرجع:

```ts
return {
  books: items,
  categories,
  meta,
};
```

## 4. Controllers – `bookController.ts` (ملخص)

- `createBookCtrl`
  - يستخدم `createBook(req.validated?.body)`؛
  - Response 201: `{ book }`.

- `createBookUploadCtrl`
  - يقرأ `req.body` + `req.files`;
  - يستدعي `createBookWithUploads(body, files)`؛
  - Response 201: `{ book }`.

- `listBooksCtrl`
  - يستدعي `listBooks(req.validated?.query)`؛
  - Response 200: `{ items }` + `meta`.

- `getBookCtrl`
  - يأخذ `id` من `req.validated?.params` أو `req.params`;
  - يستدعي `getBook(id)`؛
  - Response 200: `{ book }`.

- `updateBookCtrl`
  - يأخذ `id` + `updates` من `req.validated`;
  - يستدعي `updateBook(id, updates)`؛
  - Response 200: `{ book }`.

- `updateBookUploadCtrl`
  - يأخذ `id` من params، و `body` + `files` من request؛
  - يستدعي `updateBookWithUploads(id, body, files)`؛
  - Response 200: `{ book }`.

- `deleteBookCtrl`
  - يستدعي `softDeleteBook(id)`؛
  - Response 200: `{ deleted: true }`.

- `restoreBookCtrl`
  - يستدعي `restoreBook(id)`؛
  - Response 200: `{ restored: true }`.

- `homepageBooksCtrl`
  - يستدعي `getHomepageBooks(req.validated?.query)`؛
  - Response 200: `{ books }`.

- `booksWithCategoriesCtrl`
  - يستدعي `getBooksWithCategories(req.validated?.query)`؛
  - Response 200: `{ books, categories }` + `meta`.

> جميع الكونترولرز ملفوفة بـ `catchAsync` وتستخدم `ok` / `created` من `utils/response`.

---

## 5. Routes – `bookRoutes.ts` (ملخص)

**Base path:** `/api/v1/books`

### 5.1 Public Routes

- `GET /home`
  - Middlewares:
    - `validateQuery(homepageBooksQuerySchema)`
  - Handler:
    - `homepageBooksCtrl`

- `GET /with-categories`
  - Middlewares:
    - `validateQuery(bookQuerySchema)`
  - Handler:
    - `booksWithCategoriesCtrl`

- `GET /search`
  - Middlewares: - `validateQuery(bookQuerySchema)` - `searchMiddleware({
  model: Book,
  fields: [
    'slug',
    'title.ar',
    'title.en',
    'author.ar',
    'author.en',
    'description.ar',
    'description.en',
    'isbn',
  ],
  defaultFilters: { isDeleted: false },
})`
  - ملاحظة: `searchMiddleware` هو المسؤول عن إرجاع الـ response (أو لازم تضيف handler بعده لو مش بيكتب بنفسه).

- `GET /`
  - Middlewares:
    - `validateQuery(bookQuerySchema)`
  - Handler:
    - `listBooksCtrl`

- `GET /:id`
  - Middlewares:
    - `validateRequest({ params: bookIdParamsSchema })`
  - Handler:
    - `getBookCtrl`

### 5.2 Admin-only Routes

بعد:

```ts
router.use(protect, isAdmin);
```

POST /

Middlewares:

- validateRequestBody(createBookSchema)

Handler:

- createBookCtrl

POST /upload

Middlewares:

- uploadBookAssetsDisk

Handler:

- createBookUploadCtrl

PATCH /:id

Middlewares:

- validateRequest({ params: bookIdParamsSchema, body: updateBookSchema })

Handler:

- updateBookCtrl

PATCH /:id/upload

Middlewares:

- validateRequest({ params: bookIdParamsSchema })
- uploadBookAssetsDisk

Handler:

- updateBookUploadCtrl

DELETE /:id

Middlewares:

- validateRequest({ params: bookIdParamsSchema })

Handler:

- deleteBookCtrl

PATCH /:id/restore

Middlewares:

- validateRequest({ params: bookIdParamsSchema })

Handler:

- restoreBookCtrl
