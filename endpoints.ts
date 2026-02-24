// STATUS
const statusGuide = [
  // ===== نجاح =====
  {
    Success: [
      { status: 200, message: 'OK — العملية نجحت والرد يحتوي بيانات' },
      { status: 201, message: 'Created — تم إنشاء مورد جديد (مثال: Order/Category/Booking)' },
      { status: 204, message: 'No Content — العملية نجحت بدون جسم رد (مثال: DELETE)' },
      { status: 304, message: 'Not Modified — لأغراض الكاش/ETag' },
    ],
  },

  // ===== أخطاء طلب/صلاحيات =====
  {
    Error: [
      { status: 400, message: 'Bad Request — مدخلات/معاملات غير صالحة أو ناقصة' },
      { status: 401, message: 'Unauthorized — بدون توكن أو توكن غير صالح/منتهي' },
      { status: 403, message: 'Forbidden — لديك توكن لكن لا تملك صلاحية/ليس موردك' },
      { status: 404, message: 'Not Found — المورد غير موجود (كتاب/تصنيف/عنوان/طلب/حجز...)' },
      { status: 405, message: 'Method Not Allowed — الـ HTTP method غير مدعوم لهذا المسار' },
      {
        status: 409,
        message: 'Conflict — تعارض حالة (مثال: slug/email موجود، عنصر بالسلة موجود، slot محجوز)',
      },
      { status: 410, message: 'Gone — المورد لم يعد متاحًا (مثال: Hold منتهٍ)' },
      { status: 413, message: 'Payload Too Large — حجم جسم الطلب/الملف أكبر من المسموح' },
      { status: 415, message: 'Unsupported Media Type — Content-Type غير مدعوم' },
      { status: 422, message: 'Unprocessable Entity — فشل تحقق Zod (تفاصيل الأخطاء في الحقول)' },
      {
        status: 429,
        message: 'Too Many Requests — Rate Limit/Slowdown: محاولات كثيرة، حاول لاحقًا',
      },
    ],
  },

  // ===== أخطاء الخادم/الخدمات الخارجية =====
  {
    ServerError: [
      { status: 500, message: 'Internal Server Error — خطأ غير متوقع بالخادم' },
      { status: 502, message: 'Bad Gateway — فشل من خدمة خارجية/مزود دفع' },
      { status: 503, message: 'Service Unavailable — الخدمة غير جاهزة (DB down / readyz فاشل)' },
      { status: 504, message: 'Gateway Timeout — مهلة منتهية عند التواصل مع خدمة خارجية' },
    ],
  },
];

/* ============================
  🔐 Auth Endpoints (Controllers’ shape)
  Base: /api/v1/auth
============================ */

// Register → created({ message })
const register = {
  url: '/api/v1/auth/register',
  method: 'post',
  body: {
    firstName: 'Kareem',
    lastName: 'Elsayed',
    email: 'kareem@example.com',
    password: 'Str0ngP@ss!',
    avatar: 'https://example.com/avatar.jpg', // اختياري
  },
  response: { message: 'تم إنشاء الحساب. يرجى إدخال رمز التفعيل المرسل إلى بريدك.' },
};

// Verify Email → ok({ message })
const verifyEmail = {
  url: '/api/v1/auth/verify-email',
  method: 'post',
  body: { email: 'kareem@example.com', otpCode: '123456' },
  response: { message: 'تم تأكيد البريد الإلكتروني بنجاح ✅' },
};

// Resend Verification → ok({ message })
const resendVerificationEmail = {
  url: '/api/v1/auth/resend-verification',
  method: 'post',
  body: { email: 'kareem@example.com' },
  response: { message: 'تم إرسال رمز التفعيل بنجاح ✅' },
};

// Login → ok({ message, user })
const login = {
  url: '/api/v1/auth/login',
  method: 'post',
  body: { email: 'kareem@example.com', password: 'Str0ngP@ss!' },
  response: {
    message: 'تم تسجيل الدخول بنجاح ✅',
    user: {
      id: '66cf0b6e9c9f1c0012fa0001',
      firstName: 'Kareem',
      lastName: 'Elsayed',
      email: 'kareem@example.com',
      role: 'student',
      avatar: 'https://example.com/avatar.jpg',
      isEmailVerified: true,
    },
  },
};

// Refresh Token → ok({ message })
const refreshToken = {
  url: '/api/v1/auth/refresh-token',
  method: 'post',
  response: { message: 'تم تحديث التوكن بنجاح ✅' },
};

// Logout → ok({ message })
const logout = {
  url: '/api/v1/auth/logout',
  method: 'post',
  response: { message: 'تم تسجيل الخروج بنجاح ✅' },
};

// Forgot Password → ok({ message })
const forgotPassword = {
  url: '/api/v1/auth/forgot-password',
  method: 'post',
  body: { email: 'kareem@example.com' },
  response: { message: 'تم إرسال رمز استعادة كلمة المرور إلى بريدك الإلكتروني' },
};

// Reset Password → ok({ message })
const resetPassword = {
  url: '/api/v1/auth/reset-password',
  method: 'post',
  body: { email: 'kareem@example.com', otpCode: '123456', newPassword: 'NewStr0ngP@ss!' },
  response: { message: 'تم تغيير كلمة المرور بنجاح ✅' },
};

const authEndpoints = [
  register,
  verifyEmail,
  resendVerificationEmail,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
];

/* ============================
  👤 User Endpoints (Controllers’ shape)
  Base: /api/v1/users
============================ */

// Me → ok({ user })
const getMyProfile = {
  url: '/api/v1/users/me',
  method: 'get',
  response: {
    user: {
      id: '66cf0b6e9c9f1c0012fa0001',
      firstName: 'Kareem',
      lastName: 'Elsayed',
      email: 'kareem@example.com',
      role: 'student',
      avatar: 'https://example.com/avatar.jpg',
      isEmailVerified: true,
    },
  },
};

// Update Me → ok({ user })
const updateMyProfile = {
  url: '/api/v1/users/me',
  method: 'patch',
  body: { firstName: 'Kareem', lastName: 'El Sayed', avatar: 'https://example.com/new.jpg' },
  response: {
    user: {
      id: '66cf0b6e9c9f1c0012fa0001',
      firstName: 'Kareem',
      lastName: 'El Sayed',
      email: 'kareem@example.com',
      role: 'student',
      avatar: 'https://example.com/new.jpg',
    },
  },
};

// Change Password → ok({ message })
const changePassword = {
  url: '/api/v1/users/me/change-password',
  method: 'patch',
  body: { currentPassword: 'Str0ngP@ss!', newPassword: 'An0therStr0ng!' },
  response: { message: 'تم تغيير كلمة المرور بنجاح ✅' },
};

// Delete Me → 204 No Content
const deleteMyAccount = {
  url: '/api/v1/users/me',
  method: 'delete',
  response: { status: 204, body: null },
};

// Admin: GET /users → ok({ users }, { count })
const getAllUsers = {
  url: '/api/v1/users',
  method: 'get',
  response: {
    data: {
      users: [
        {
          id: '66cf0b6e9c9f1c0012fa0001',
          firstName: 'Kareem',
          lastName: 'Elsayed',
          email: 'kareem@example.com',
          role: 'student',
          avatar: 'https://example.com/avatar.jpg',
        },
      ],
    },
    meta: { count: 1 },
  },
};

// Admin: GET /users/:id → ok({ user })
const getUserById = {
  url: '/api/v1/users/66cf0b6e9c9f1c0012faabcd',
  method: 'get',
  response: {
    user: {
      id: '66cf0b6e9c9f1c0012faabcd',
      firstName: 'Ahmed',
      lastName: 'Atiah',
      email: 'ahmed@example.com',
      role: 'admin',
      avatar: 'https://example.com/avatar.jpg',
    },
  },
};

// Admin: PATCH /users/:id/role → ok({ user, message })
const updateUserRole = {
  url: '/api/v1/users/66cf0b6e9c9f1c0012faabcd/role',
  method: 'patch',
  body: { role: 'instructor' },
  response: {
    user: {
      id: '66cf0b6e9c9f1c0012faabcd',
      firstName: 'Ahmed',
      lastName: 'Atiah',
      email: 'ahmed@example.com',
      role: 'instructor',
      avatar: 'https://example.com/avatar.jpg',
    },
    message: 'تم تحديث الدور بنجاح',
  },
};

// Admin: Deactivate → ok({ message })
const deactivateUser = {
  url: '/api/v1/users/admin/deactivate/66cf0b6e9c9f1c0012faabcd',
  method: 'patch',
  response: { message: 'تم تعطيل الحساب بنجاح ✅' },
};

// Admin: Reactivate → ok({ message })
const reactivateUser = {
  url: '/api/v1/users/admin/reactivate/66cf0b6e9c9f1c0012faabcd',
  method: 'patch',
  response: { message: 'تم تفعيل الحساب بنجاح ✅' },
};

// Admin: /users/search via searchMiddleware → { data, meta }
const searchUsers = {
  url: '/api/v1/users/search?searchTerm=kareem&role=instructor&page=1&limit=10&sortBy=createdAt&order=desc',
  method: 'get',
  response: {
    data: [
      {
        id: '66cf0b6e9c9f1c0012fa0002',
        firstName: 'Kareem',
        lastName: 'El Sayed',
        email: 'kareem@example.com',
        role: 'instructor',
        avatar: 'https://example.com/avatar2.jpg',
      },
    ],
    meta: { total: 1, page: 1, limit: 10, pages: 1, hasNextPage: false, hasPrevPage: false },
  },
};

const userEndpoints = [
  getMyProfile,
  updateMyProfile,
  changePassword,
  deleteMyAccount,
  getAllUsers,
  getUserById,
  updateUserRole,
  deactivateUser,
  reactivateUser,
  searchUsers,
];

/* ============================
  📚 Book Endpoints (Controllers’ shape)
  Base: /api/v1/books
============================ */

// Public: list → ok(data, meta)
const listBooks = {
  url: '/api/v1/books?page=1&limit=10&search=fiqh&sort=createdAt:desc',
  method: 'get',
  response: {
    data: [
      {
        id: '6700a1...abc',
        slug: 'usul-al-fiqh',
        title: { ar: 'أصول الفقه', en: 'Usul al-Fiqh' },
        language: 'ar',
        priceHalallas: 2500,
        isDigital: true,
        // ...
      },
    ],
    meta: { total: 1, page: 1, limit: 10, pages: 1, hasNextPage: false, hasPrevPage: false },
  },
};

// Public: get one → ok({ book })
const getBook = {
  url: '/api/v1/books/6700a1...abc',
  method: 'get',
  response: {
    book: {
      id: '6700a1...abc',
      slug: 'usul-al-fiqh',
      title: { ar: 'أصول الفقه', en: 'Usul al-Fiqh' },
      // ...
    },
  },
};

// Public: homepage → ok({ books })
const homeBooks = {
  url: '/api/v1/books/home?limit=8',
  method: 'get',
  response: {
    books: [
      /* ... */
    ],
  },
};

// Public: list + categories → ok({ books, categories }, meta)
const booksWithCategories = {
  url: '/api/v1/books/with-categories?page=1&limit=12&isDigital=true',
  method: 'get',
  response: {
    books: [
      /* ... */
    ],
    categories: [
      { id: '66ff..01', title: { ar: 'فقه', en: 'Fiqh' }, booksCount: 12, slug: 'fiqh' },
    ],
    meta: { total: 12, page: 1, limit: 12, pages: 1, hasNextPage: false, hasPrevPage: false },
  },
};

// Admin: create → created({ book })
const createBook = {
  url: '/api/v1/books',
  method: 'post',
  body: {
    title: { ar: 'أصول الفقه', en: 'Usul al-Fiqh' },
    author: { ar: 'الجويني' },
    language: 'ar',
    price: 25.0,
    isDigital: true,
    pdfUrl: 'https://cdn.example.com/books/usul.pdf',
    categories: ['66ff..01'],
  },
  response: { book: { id: '6700a1...abc', slug: 'usul-al-fiqh' /* ... */ } },
};

// Admin: update → ok({ book })
const updateBook = {
  url: '/api/v1/books/6700a1...abc',
  method: 'patch',
  body: { price: 22.5, salesPrice: 19.9 },
  response: { book: { id: '6700a1...abc', priceHalallas: 2250, salesPriceHalallas: 1990 } },
};

// Admin: soft delete → ok({ deleted: true })
const deleteBook = {
  url: '/api/v1/books/6700a1...abc',
  method: 'delete',
  response: { deleted: true },
};

// Admin: restore → ok({ restored: true })
const restoreBook = {
  url: '/api/v1/books/6700a1...abc/restore',
  method: 'patch',
  response: { restored: true },
};

const bookEndpoints = [
  listBooks,
  getBook,
  homeBooks,
  booksWithCategories,
  createBook,
  updateBook,
  deleteBook,
  restoreBook,
];

/* ============================
  🗂️ Category Endpoints (Controllers’ shape)
  Base: /api/v1/categories
============================ */

// Public: list → ok(data, meta)
const listCategories = {
  url: '/api/v1/categories?page=1&limit=10&scope=book&sort=order:asc,createdAt:desc',
  method: 'get',
  response: {
    data: [
      {
        id: '66ff..01',
        slug: 'fiqh',
        title: { ar: 'فقه', en: 'Fiqh' },
        scopes: ['book'],
        booksCount: 12,
        order: 1,
      },
    ],
    meta: { total: 1, page: 1, limit: 10, pages: 1, hasNextPage: false, hasPrevPage: false },
  },
};

// Public: get one → ok({ category })
const getCategory = {
  url: '/api/v1/categories/66ff..01',
  method: 'get',
  response: {
    category: {
      id: '66ff..01',
      slug: 'fiqh',
      title: { ar: 'فقه', en: 'Fiqh' },
      scopes: ['book', 'course'],
      booksCount: 12,
    },
  },
};

// Admin: create → created({ category })
const createCategory = {
  url: '/api/v1/categories',
  method: 'post',
  body: {
    title: { ar: 'حديث', en: 'Hadith' },
    scopes: ['book'],
    order: 2,
  },
  response: { category: { id: '66ff..02', slug: 'hadith' /* ... */ } },
};

// Admin: update → ok({ category })
const updateCategory = {
  url: '/api/v1/categories/66ff..02',
  method: 'patch',
  body: { order: 3 },
  response: { category: { id: '66ff..02', order: 3 } },
};

// Admin: soft delete → ok({ deleted: true })
const deleteCategory = {
  url: '/api/v1/categories/66ff..02',
  method: 'delete',
  response: { deleted: true },
};

// Admin: restore → ok({ restored: true })
const restoreCategory = {
  url: '/api/v1/categories/66ff..02/restore',
  method: 'patch',
  response: { restored: true },
};

const categoryEndpoints = [
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  restoreCategory,
];
/* ============================
  🧑‍🏫 Consultation Endpoints (Controllers’ shape)
  Base: /api/v1/consultations
============================ */

/* --------------------------------
🟢 Public: Offerings
--------------------------------- */
const listOfferings = {
  url: '/api/v1/consultations/offerings?type=academic&activeOnly=true&page=1&limit=20&sort=order:asc,createdAt:desc',
  method: 'get',
  response: {
    offerings: [
      {
        id: '65f0c8c0d9e3b2a0d1a11111',
        type: 'academic',
        title: { ar: 'استشارة أكاديمية', en: 'Academic Consultation' },
        description: { ar: 'مراجعة بحث أو خطة دراسة', en: 'Review research or study plan' },
        durationMinutes: 60,
        priceHalalas: 20000,
        isActive: true,
        order: 1,
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-20T10:00:00.000Z',
      },
    ],
    // لو لاحقاً هتطبق pagination حقيقي في السيرفيس:
    // meta: { total: 1, page: 1, limit: 20, pages: 1, hasNextPage: false, hasPrevPage: false }
  },
};

/* --------------------------------
🟢 Public: Instructors
--------------------------------- */
// Public: list instructors → ok({ instructors })
const listInstructors = {
  url: '/api/v1/consultations/instructors?type=academic&activeOnly=true&page=1&limit=20&sort=createdAt:desc',
  method: 'get',
  response: {
    instructors: [
      {
        id: '65f0c8c0d9e3b2a0d1a22222',
        user: '65eaaaaad9e3b2a0d1a99999',
        displayName: 'د. أحمد',
        supportedTypes: ['academic', 'coaching'],
        timezone: 'Asia/Riyadh',
        bufferMinutes: 10,
        minNoticeHours: 24,
        maxAdvanceDays: 30,
        rescheduleWindowHours: 12,
        weekly: [
          { day: 0, start: '10:00', end: '14:00' },
          { day: 0, start: '17:00', end: '21:00' },
        ],
        meetingMethod: 'manual',
        isActive: true,
        experiences: [],
        createdAt: '2026-01-18T10:00:00.000Z',
        updatedAt: '2026-01-18T10:00:00.000Z',
      },
    ],
  },
};

/* --------------------------------
🟢 Public: Availability (single day slots)
--------------------------------- */
// Public: availability day → ok({ slots })
const availabilityDay = {
  url: '/api/v1/consultations/instructors/65eaaaaad9e3b2a0d1a99999/availability?date=2026-01-31&offeringId=65f0c8c0d9e3b2a0d1a11111',
  method: 'get',
  response: {
    slots: [
      {
        start: '2026-01-31T07:00:00.000Z',
        end: '2026-01-31T08:00:00.000Z',
      },
      {
        start: '2026-01-31T08:10:00.000Z',
        end: '2026-01-31T09:10:00.000Z',
      },
    ],
  },
  notes: {
    dateInput: 'YYYY-MM-DD (Riyadh local)',
    startEndStored: 'UTC ISO',
  },
};

/* --------------------------------
🟢 Public: Range Slots (slots by date)
--------------------------------- */
// Public: range slots → ok({ slotsByDate })
const rangeSlots = {
  url: '/api/v1/consultations/instructors/65eaaaaad9e3b2a0d1a99999/slots?from=2026-01-31&to=2026-02-07&offeringId=65f0c8c0d9e3b2a0d1a11111',
  method: 'get',
  response: {
    slotsByDate: {
      '2026-01-31': [{ start: '2026-01-31T07:00:00.000Z', end: '2026-01-31T08:00:00.000Z' }],
      '2026-02-01': [{ start: '2026-02-01T10:00:00.000Z', end: '2026-02-01T11:00:00.000Z' }],
    },
  },
};

/* --------------------------------
🟢 Public: Calendar Overlay (Version II UI)
--------------------------------- */
// Public: calendar overlay → ok(data)  (الكونترولر بيرجع ok(res, data) مباشرة)
const calendarOverlay = {
  url: '/api/v1/consultations/instructors/65eaaaaad9e3b2a0d1a99999/calendar?from=2026-01-31&to=2026-02-07',
  method: 'get',
  response: {
    timezone: 'Asia/Riyadh',
    rules: {
      bufferMinutes: 10,
      minNoticeHours: 24,
      maxAdvanceDays: 30,
      rescheduleWindowHours: 12,
    },
    weekly: [
      { day: 0, start: '10:00', end: '14:00' },
      { day: 0, start: '17:00', end: '21:00' },
      { day: 1, start: '10:00', end: '13:00' },
    ],
    exceptions: [
      {
        dateYMD: '2026-01-31',
        closed: false,
        slots: [
          { start: '12:00', end: '14:00' },
          { start: '17:00', end: '21:00' },
        ],
      },
      {
        dateYMD: '2026-02-02',
        closed: true,
      },
    ],
    busy: [
      {
        kind: 'booking',
        status: 'confirmed',
        start: '2026-01-31T14:00:00.000Z',
        end: '2026-01-31T15:00:00.000Z',
      },
      {
        kind: 'hold',
        start: '2026-01-31T16:00:00.000Z',
        end: '2026-01-31T17:00:00.000Z',
        expiresAt: '2026-01-31T16:15:00.000Z',
      },
    ],
  },
};

/* --------------------------------
🟢 Public: Hold + Payment (booking intent)
--------------------------------- */
// Public: create hold → created({ paymentUrl, holdId })
const createHoldAndPayment = {
  url: '/api/v1/consultations/hold',
  method: 'post',
  body: {
    instructorId: '65eaaaaad9e3b2a0d1a99999',
    offeringId: '65f0c8c0d9e3b2a0d1a11111',
    date: '2026-01-31',
    startHHMM: '10:00',
    applicant: {
      fullName: 'محمد علي',
      email: 'm@example.com',
      whatsapp: '9665xxxxxxx',
      issueDescription: 'عايز مراجعة بحث',
      acceptedTerms: true,
    },
    idempotencyKey: 'hold_2026-01-31_10:00_user_123',
  },
  response: {
    paymentUrl: 'https://pay.moyasar.com/....',
    holdId: '65f1c8c0d9e3b2a0d1a77777',
  },
};

// // Auth (user): POST hold + payment → created({ paymentUrl, holdId })
// const createHold = {
//   url: '/api/v1/consultations/hold',
//   method: 'post',
//   body: {
//     instructorId: '66cf0b6e9c9f1c0012faabcd',
//     offeringId: '6720ff...001',
//     date: '2025-10-25',
//     startHHMM: '10:00',
//     applicant: {
//       fullName: 'Kareem Elsayed',
//       email: 'kareem@example.com',
//       whatsapp: '+9665xxxxxxx',
//       issueDescription: 'ملخص المشكلة...',
//       acceptedTerms: true,
//     },
//     idempotencyKey: 'hold_kareem_2025-10-25_10:00',
//   },
//   response: {
//     paymentUrl: 'https://payments.moyasar.com/checkout/xyz',
//     holdId: '6730aa...789',
//   },
// };

// Public: alias create booking → created({ paymentUrl, holdId })
const createBookingAlias = {
  url: '/api/v1/consultations/bookings',
  method: 'post',
  body: createHoldAndPayment.body,
  response: createHoldAndPayment.response,
};

// // Alias: POST /consultations/bookings → created({ paymentUrl, holdId })
// const createBooking = {
//   url: '/api/v1/consultations/bookings',
//   method: 'post',
//   body: {
//     /* نفس createHold */
//   },
//   response: { paymentUrl: 'https://...', holdId: '6730aa...789' },
// };

/* --------------------------------
🟢 Public: Moyasar Webhook
--------------------------------- */

// Public: webhook → ok({ ok: true|false, reason? })
const moyasarWebhook = {
  url: '/api/v1/consultations/webhook/moyasar',
  method: 'post',
  body: {
    id: 'pay_123456',
    status: 'paid',
    amount: 23000,
    currency: 'SAR',
    metadata: {
      kind: 'consultation',
      holdId: '65f1c8c0d9e3b2a0d1a77777',
      instructorId: '65eaaaaad9e3b2a0d1a99999',
      offeringId: '65f0c8c0d9e3b2a0d1a11111',
      userId: '65u...',
    },
  },
  response: { ok: true },
  notes: {
    tip: 'في الواقع: Webhook غالباً internal، والـ frontend مش بيستدعيه.',
  },
};

/* --------------------------------
🔐 Protected: My Consultations
--------------------------------- */
// Protected: list my bookings → ok(items, meta)
const listMyConsultations = {
  url: '/api/v1/consultations/me?page=1&limit=10&status=confirmed',
  method: 'get',
  headers: { Authorization: 'Bearer <token>' },
  response: {
    data: [
      {
        id: '65f2aaaa...',
        instructor: '65eaaaaad9e3b2a0d1a99999',
        offering: {
          type: 'academic',
          title: { ar: 'استشارة أكاديمية', en: 'Academic Consultation' },
          durationMinutes: 60,
          priceHalalas: 20000,
        },
        start: '2026-02-01T10:00:00.000Z',
        end: '2026-02-01T11:00:00.000Z',
        status: 'confirmed',
        meetingUrl: 'https://zoom.us/....',
        totals: { priceHalalas: 20000, vatHalalas: 3000, grandTotalHalalas: 23000 },
        payment: {
          provider: 'moyasar',
          paymentId: 'pay_123456',
          currency: 'SAR',
          paidAt: '2026-01-31T08:00:00.000Z',
        },
      },
    ],
    meta: { total: 1, page: 1, limit: 10, pages: 1, hasNextPage: false, hasPrevPage: false },
  },
};

// Protected: get one booking → ok({ booking })
const getMyConsultation = {
  url: '/api/v1/consultations/me/65f2aaaa...',
  method: 'get',
  headers: { Authorization: 'Bearer <token>' },
  response: {
    booking: {
      id: '65f2aaaa...',
      instructor: '65eaaaaad9e3b2a0d1a99999',
      offering: {
        type: 'academic',
        title: { ar: 'استشارة أكاديمية', en: 'Academic Consultation' },
        durationMinutes: 60,
        priceHalalas: 20000,
      },
      start: '2026-02-01T10:00:00.000Z',
      end: '2026-02-01T11:00:00.000Z',
      status: 'confirmed',
      applicant: {
        fullName: 'محمد علي',
        email: 'm@example.com',
        whatsapp: '9665xxxxxxx',
        issueDescription: 'عايز مراجعة بحث',
      },
      meetingUrl: 'https://zoom.us/....',
      totals: { priceHalalas: 20000, vatHalalas: 3000, grandTotalHalalas: 23000 },
      payment: { provider: 'moyasar', paymentId: 'pay_123456', currency: 'SAR' },
      createdAt: '2026-01-31T07:59:00.000Z',
      updatedAt: '2026-01-31T07:59:00.000Z',
    },
  },
};

// Protected: reschedule → ok({ booking })
const rescheduleConsultation = {
  url: '/api/v1/consultations/me/65f2aaaa.../reschedule',
  method: 'post',
  headers: { Authorization: 'Bearer <token>' },
  body: {
    newStartAt: '2026-02-05T10:00:00.000Z',
    idempotencyKey: 'reschedule_65f2aaaa_2026-02-05T10:00Z',
  },
  response: {
    booking: {
      id: '65f2aaaa...',
      start: '2026-02-05T10:00:00.000Z',
      end: '2026-02-05T11:00:00.000Z',
      status: 'confirmed',
    },
  },
  notes: {
    validation: 'newStartAt لازم يكون ISO + timezone (Z أو +hh:mm)',
  },
};

// Protected: cancel → ok({ cancelled, eligibleForRefund })
const cancelConsultation = {
  url: '/api/v1/consultations/me/65f2aaaa.../cancel',
  method: 'post',
  headers: { Authorization: 'Bearer <token>' },
  response: { cancelled: true, eligibleForRefund: true },
};

/* --------------------------------
✅ Export list
--------------------------------- */
const consultationEndpoints = [
  listOfferings,
  listInstructors,
  availabilityDay,
  rangeSlots,
  calendarOverlay,
  createHoldAndPayment,
  createBookingAlias,
  moyasarWebhook,
  listMyConsultations,
  getMyConsultation,
  rescheduleConsultation,
  cancelConsultation,
];

/* ============================
  🎓 Instructor Profiles Endpoints (Controllers’ shape)
  Base: /api/v1/instructors
============================ */
/* --------------------------------
Instructor (self)
--------------------------------- */

// Instructor (self): GET /instructors/me → ok({ profile })
const meGetInstructorProfile = {
  url: '/api/v1/instructors/me',
  method: 'get',
  auth: 'bearer',
  response: {
    profile: {
      id: '6721aa...010',
      userId: '66cf0b6e9c9f1c0012faabcd',
      displayName: 'د. أحمد',
      avatar: 'https://cdn.example.com/u/avatar.png',
      bio: { ar: 'نبذة عربية', en: 'English bio' },
      academicDegree: { ar: 'دكتوراه علم نفس', en: 'PhD Psychology' },
      experiences: [
        {
          title: { ar: 'أخصائي', en: 'Specialist' },
          organization: { ar: 'مركز كذا', en: 'Clinic XYZ' },
          startDate: '2022-01-01T00:00:00.000Z',
          endDate: null,
          description: { ar: '...', en: '...' },
        },
      ],
      supportedTypes: ['academic', 'social'],
      timezone: 'Asia/Riyadh',
      bufferMinutes: 10,
      minNoticeHours: 24,
      maxAdvanceDays: 30,
      rescheduleWindowHours: 12,
      weekly: [
        { day: 0, start: '10:00', end: '14:00' }, // 0=Saturday
        { day: 2, start: '12:00', end: '16:00' },
      ],
      exceptions: [
        {
          date: '2026-02-10T21:00:00.000Z', // normalized Riyadh day start in UTC
          closed: false,
          slots: [{ start: '18:00', end: '20:00' }],
        },
      ],
      meetingMethod: 'manual',
      meetingUrl: 'https://meet.example.com/ahmed',
      isActive: true,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-20T10:00:00.000Z',
      user: {
        id: '66cf0b6e9c9f1c0012faabcd',
        firstName: 'Ahmed',
        lastName: 'Ali',
        email: 'ahmed@example.com',
        role: 'instructor',
        avatar: 'https://cdn.example.com/u/avatar.png',
        isDeleted: false,
      },
    },
  },
};

// Instructor (self): PATCH /instructors/me → ok({ profile })
const meUpdateInstructorProfile = {
  url: '/api/v1/instructors/me',
  method: 'patch',
  auth: 'bearer',
  body: {
    displayName: 'د. أحمد (محدّث)',
    meetingUrl: 'https://meet.example.com/ahmed-new',
    bio: { ar: 'نبذة جديدة', en: 'New bio' },
    // ⚠️ ملاحظة: weekly/exceptions ممكن تتبعت هنا، لكن الأفضل تستخدم atomic endpoints تحت
  },
  response: {
    profile: {
      id: '6721aa...010',
      displayName: 'د. أحمد (محدّث)',
      meetingUrl: 'https://meet.example.com/ahmed-new',
      bio: { ar: 'نبذة جديدة', en: 'New bio' },
    },
  },
};

/* --------------------------------
✅ Atomic endpoints (recommended)
--------------------------------- */
// Instructor (self): PUT /instructors/me/weekly → ok({ profile })
const meReplaceWeekly = {
  url: '/api/v1/instructors/me/weekly',
  method: 'put',
  auth: 'bearer',
  body: {
    weekly: [
      { day: 0, start: '10:00', end: '14:00' },
      { day: 2, start: '12:00', end: '16:00' },
    ],
  },
  response: {
    profile: {
      id: '6721aa...010',
      weekly: [
        { day: 0, start: '10:00', end: '14:00' },
        { day: 2, start: '12:00', end: '16:00' },
      ],
      updatedAt: '2026-02-02T08:12:00.000Z',
    },
  },
};

// Instructor (self): PUT /instructors/me/exceptions/:dateYMD → ok({ profile })
const meUpsertException = {
  url: '/api/v1/instructors/me/exceptions/2026-02-10',
  method: 'put',
  auth: 'bearer',
  body: {
    closed: false,
    slots: [{ start: '18:00', end: '20:00' }],
  },
  response: {
    profile: {
      id: '6721aa...010',
      exceptions: [
        {
          date: '2026-02-10T21:00:00.000Z', // normalized
          closed: false,
          slots: [{ start: '18:00', end: '20:00' }],
        },
      ],
      updatedAt: '2026-02-02T08:15:00.000Z',
    },
  },
};

// Instructor (self): PUT closed day (no slots)
const meCloseDayException = {
  url: '/api/v1/instructors/me/exceptions/2026-02-11',
  method: 'put',
  auth: 'bearer',
  body: { closed: true },
  response: {
    profile: {
      id: '6721aa...010',
      exceptions: [{ date: '2026-02-11T21:00:00.000Z', closed: true }],
    },
  },
};

// Instructor (self): DELETE /instructors/me/exceptions/:dateYMD → ok({ profile })
const meDeleteException = {
  url: '/api/v1/instructors/me/exceptions/2026-02-10',
  method: 'delete',
  auth: 'bearer',
  response: {
    profile: {
      id: '6721aa...010',
      exceptions: [], // removed that day
      updatedAt: '2026-02-02T08:20:00.000Z',
    },
  },
};

/* --------------------------------
Admin
--------------------------------- */
// Admin: POST /instructors → created({ profile })
const adminCreateInstructor = {
  url: '/api/v1/instructors',
  method: 'post',
  auth: 'bearer (admin)',
  body: {
    userId: '66cf0b6e9c9f1c0012faabcd',
    displayName: 'د. أحمد',
    bio: { ar: 'نبذة عربية', en: 'English bio' },
    academicDegree: { ar: 'دكتوراه علم نفس', en: 'PhD Psychology' },
    experiences: [
      {
        title: { ar: 'أخصائي', en: 'Specialist' },
        organization: { ar: 'مركز كذا', en: 'Clinic XYZ' },
        startDate: '2022-01-01',
        description: { ar: '...', en: '...' },
      },
    ],
    supportedTypes: ['academic', 'social'],
    timezone: 'Asia/Riyadh',
    bufferMinutes: 10,
    minNoticeHours: 24,
    maxAdvanceDays: 30,
    rescheduleWindowHours: 12,
    weekly: [{ day: 0, start: '10:00', end: '14:00' }],
    meetingMethod: 'manual',
    meetingUrl: 'https://meet.example.com/ahmed',
    isActive: true,
  },
  response: {
    profile: {
      id: '6721aa...010',
      userId: '66cf0b6e9c9f1c0012faabcd',
      displayName: 'د. أحمد',
      supportedTypes: ['academic', 'social'],
      timezone: 'Asia/Riyadh',
      isActive: true,
      user: {
        id: '66cf0b6e9c9f1c0012faabcd',
        firstName: 'Ahmed',
        lastName: 'Ali',
        email: 'ahmed@example.com',
        role: 'instructor',
        avatar: 'https://cdn.example.com/u/avatar.png',
        isDeleted: false,
      },
    },
  },
};

// Admin: GET /instructors → ok(data, meta)
const adminListInstructors = {
  url: '/api/v1/instructors?page=1&limit=10&type=academic&activeOnly=true&search=أحمد&sort=createdAt:desc',
  method: 'get',
  auth: 'bearer (admin)',
  response: {
    data: [
      {
        id: '6721aa...010',
        userId: '66cf0b6e9c9f1c0012faabcd',
        displayName: 'د. أحمد',
        supportedTypes: ['academic'],
        timezone: 'Asia/Riyadh',
        isActive: true,
        avatar: 'https://cdn.example.com/u/avatar.png',
      },
    ],
    meta: {
      total: 1,
      page: 1,
      limit: 10,
      pages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  },
};

// Admin: GET /instructors/:userId → ok({ profile })
const adminGetInstructor = {
  url: '/api/v1/instructors/66cf0b6e9c9f1c0012faabcd',
  method: 'get',
  auth: 'bearer (admin)',
  response: {
    profile: {
      id: '6721aa...010',
      userId: '66cf0b6e9c9f1c0012faabcd',
      displayName: 'د. أحمد',
      supportedTypes: ['academic', 'social'],
      timezone: 'Asia/Riyadh',
      weekly: [{ day: 0, start: '10:00', end: '14:00' }],
      exceptions: [],
      isActive: true,
      user: { id: '66cf0b6e9c9f1c0012faabcd', role: 'instructor' },
    },
  },
};

// Admin: PATCH /instructors/:userId → ok({ profile })
const adminUpdateInstructor = {
  url: '/api/v1/instructors/66cf0b6e9c9f1c0012faabcd',
  method: 'patch',
  auth: 'bearer (admin)',
  body: {
    displayName: 'د. أحمد السعيد',
    bufferMinutes: 15,
    // ⚠️ هنا كمان لو بتعدل weekly/exceptions الأفضل تعمل atomic endpoints (لو هتضيفها للأدمن لاحقًا)
  },
  response: {
    profile: {
      id: '6721aa...010',
      displayName: 'د. أحمد السعيد',
      bufferMinutes: 15,
      updatedAt: '2026-02-02T08:30:00.000Z',
    },
  },
};

// Admin: PATCH /instructors/:userId/activate → ok({ profile, message })
const adminActivateInstructor = {
  url: '/api/v1/instructors/66cf0b6e9c9f1c0012faabcd/activate',
  method: 'patch',
  auth: 'bearer (admin)',
  response: {
    profile: { id: '6721aa...010', isActive: true },
    message: 'Activated',
  },
};

// Admin: PATCH /instructors/:userId/deactivate → ok({ profile, message })
const adminDeactivateInstructor = {
  url: '/api/v1/instructors/66cf0b6e9c9f1c0012faabcd/deactivate',
  method: 'patch',
  auth: 'bearer (admin)',
  response: {
    profile: { id: '6721aa...010', isActive: false },
    message: 'Deactivated',
  },
};

const instructorEndpoints = [
  // self
  meGetInstructorProfile,
  meUpdateInstructorProfile,

  // atomic (recommended)
  meReplaceWeekly,
  meUpsertException,
  meCloseDayException,
  meDeleteException,

  // admin
  adminCreateInstructor,
  adminListInstructors,
  adminGetInstructor,
  adminUpdateInstructor,
  adminActivateInstructor,
  adminDeactivateInstructor,
];
