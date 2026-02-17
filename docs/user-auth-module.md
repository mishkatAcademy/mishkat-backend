# User & Auth Module – Documentation

> **المسؤول عن:**  
> تسجيل المستخدمين، تفعيل الإيميل، تسجيل الدخول، نسيان/استعادة كلمة المرور، بروفايل المستخدم، تغيير الباسورد، وتعطيل/تفعيل الحسابات + إدارة المستخدمين للأدمن.

---

## 1. User Model

**الملف:** `src/models/User.ts`

### الحقول الأساسية

- `firstName: string` – الاسم الأول (إلزامي).
- `lastName: string` – الاسم الأخير (إلزامي).
- `email: string` – إيميل فريد، lowercase + trim، عليه index و unique.
- `password: string` – مخزّن مشفّر (bcrypt)، `select: false`.
- `role: 'student' | 'instructor' | 'admin'` – دور المستخدم، الافتراضي `student`.
- `phoneNumber?: string` – رقم جوال فريد (unique + sparse).
- `avatarUrl?: string` – رابط الصورة الذي يستهلكه الفرونت.
- `avatarRelPath?: string` – مسار داخلي تحت `uploads/...` للحذف فقط (لا يظهر في الـ JSON).

### العلاقات

- `addresses?: ObjectId[]` → `Address`
- `books: ObjectId[]` → `Book`
- `courses: ObjectId[]` → `Course`
- `sessions.consultations: ObjectId[]` → `ConsultationBooking`
- `sessions.researchs: ObjectId[]` → `ResearchRequest`

  > (الاسم `researchs` متعمد لحين refactor الموديول ده)

- `wishList.books: ObjectId[]` → `Book`
- `wishList.courses: ObjectId[]` → `Course`

### OTP & الحالة

- `emailOtpCode?: string` – كود تفعيل الإيميل (هاش).
- `emailOtpExpires?: Date` – انتهاء صلاحية كود التفعيل.
- `resetOtpCode?: string` – كود استعادة كلمة المرور (هاش).
- `resetOtpExpires?: Date` – انتهاء صلاحية كود الاستعادة.
- `isEmailVerified: boolean` – هل الإيميل مفعل؟ افتراضي `false`.
- `isDeleted: boolean` – soft delete، افتراضي `false`.
- `createdAt`, `updatedAt` – من `timestamps`.

### Hooks & Methods

- `pre('save')`:
  - لو `password` اتعدّل → يتم تشفيره بـ `bcrypt.genSalt(10)` + `bcrypt.hash`.
- `comparePassword(candidatePassword: string): Promise<boolean>`:
  - مقارنة password plain بـ password المشفّر.
- Virtual:
  - `fullName` → `${firstName} ${lastName}`

### Serialization (toJSON/toObject)

قبل إرجاع الـ user في الـ responses:

يتم حذف:

- `password`
- `emailOtpCode`
- `resetOtpCode`
- `avatarRelPath` (قيمة داخلية للسيرفر فقط)

### Indexes

- `UserSchema.index({ isDeleted: 1 });`  
  لتسريع الاستعلامات التي تفلتر على `isDeleted`.

---

## 2. Validation Schemas (Zod)

**الملف:** `src/validations/user.schema.ts`

### Helpers

- `emailNormalized`
  - string → trim → email → transform to lowercase.
- `passwordStrong`
  - min 8 chars
  - يحتوي على: حرف كبير، حرف صغير، رقم، رمز خاص واحد على الأقل.
- `objectIdStrict`
  - regex على 24 خانة hex.
- `avatarField`
  - يقبل:
    - `undefined`
    - رابط صحيح (`https://...`)
    - لو string فاضية `''` تتحول لـ `undefined`.

### Auth Schemas

- `registerSchema`
  - body:
    - `firstName` – 2..20
    - `lastName` – 2..20
    - `email` – normalized
    - `password` – strong
    - `avatar` – `avatarField` (اختياري URL)
- `verifyEmailSchema`
  - `email` – normalized
  - `otpCode` – 6 أرقام
- `resendVerificationEmailSchema`
  - `email`
- `loginSchema`
  - `email`
  - `password` – min 8
- `forgotPasswordSchema`
  - `email`
- `resetPasswordSchema`
  - `email`
  - `otpCode` – 6 أرقام
  - `newPassword` – strong

### User Schemas

- `updateProfileSchema`
  - body:
    - `firstName?` – 2..50
    - `lastName?` – 2..50
    - `avatar?` – `avatarField`
  - refine: لازم يكون فيه **واحد على الأقل** من:
    - firstName غير فاضية
    - lastName غير فاضية
    - avatar موجودة
- `updateUserRoleSchema`
  - `role` ∈ { student, instructor, admin }
- `changePasswordSchema`
  - `currentPassword` – nonempty + min 8
  - `newPassword` – strong
- `userIdParamsSchema`
  - `id` – ObjectId strict
- `userSearchQuerySchema`
  - searchTerm, page, limit, sortBy, order
  - isDeleted
  - afterId, regexMode, useTextSearch, textLanguage  
    (متوافق مع `searchMiddleware` + `searchHelper.ts`)

---

## 3. Auth Services & Flows

**الملف:** `src/services/authService.ts`

### 3.1 Register Flow

`registerService(input: RegisterInput)`

1. Normalize email.
2. Find existing user by email (بما فيهم الـ soft-deleted) مع:
   - `+emailOtpCode +resetOtpCode`
3. Generate OTP (10 دقائق) → `code` + `expiresAt` + hash.
4. الحالات:

- **existing && !isDeleted**  
  → throw 409: `"البريد الإلكتروني مستخدم من قبل"`.

- **existing && isDeleted** (restore):
  - يحدّث:
    - firstName, lastName
    - password (جديدة)
    - avatarUrl + avatarRelPath (لو جايين)
    - isDeleted = false
    - isEmailVerified = false
    - emailOtpCode = hash
    - emailOtpExpires = expiresAt
    - resetOtpCode = undefined
    - resetOtpExpires = undefined
  - save
  - `sendEmailVerificationOtp(email, code)`
  - return `{ wasRestored: true }`

- **لا يوجد existing** (create):
  - create User جديد بالقيم:
    - firstName, lastName, email, password
    - avatarUrl, avatarRelPath
    - isEmailVerified = false
    - emailOtpCode = hash
    - emailOtpExpires = expiresAt
  - `sendEmailVerificationOtp`
  - return `{ wasRestored: false }`

> **مهم:**  
> الـ `role` القادم من `RegisterInput` **مُهمل** في الخدمة لأمان أعلى، التسجيل دائمًا بـ role = `student`.

---

### 3.2 Verify Email

`verifyEmailService({ email, otpCode })`

1. Normalize email.
2. Find user مع:
   - `+emailOtpCode +emailOtpExpires`.
3. Checks:
   - !user أو isDeleted → 404 `"هذا الإيميل غير مسجل"`.
   - isEmailVerified → 400 `"هذا الإيميل مفعل بالفعل"`.
   - expiration/otp:
     - لو مفيش `emailOtpCode` أو `isOtpExpired(emailOtpExpires)` → invalid.
     - `verifyOtp(otpCode, emailOtpCode)`.
4. لو ok:
   - isEmailVerified = true
   - emailOtpCode = undefined
   - emailOtpExpires = undefined
   - save.

---

### 3.3 Resend Verification Email

`resendVerificationEmailService(email)`

1. Normalize email.
2. Find user.
3. Checks:
   - !user → 404 `"هذا البريد غير مسجل"`.
   - isDeleted → 403 `"الحساب معطل"`.
   - isEmailVerified → 400 `"البريد الإلكتروني مفعل بالفعل"`.
4. Generate new OTP (10 دقائق) + hash.
5. Save في `emailOtpCode`, `emailOtpExpires`.
6. `sendEmailVerificationOtp(email, code)`.

---

### 3.4 Login

`loginService({ email, password }, res)`

1. Validate إن email + password موجودين.
2. Normalize email.
3. Find user مع `+password`.
4. Checks:
   - !user → 404 `"المستخدم غير موجود"`.
   - isDeleted → 403 `"هذا الحساب محذوف"`.
   - comparePassword → لو false → 401 `"كلمة المرور غير صحيحة"`.
   - !isEmailVerified → 403 `"يرجى تفعيل بريدك الإلكتروني قبل تسجيل الدخول"`.
5. Generate tokens:
   - Access token:  
     `createAccessToken(userId, role, JWT_SECRET, ACCESS_TOKEN_EXPIRES_IN)`
   - Refresh token:  
     `createRefreshToken(userId, REFRESH_TOKEN_SECRET, REFRESH_TOKEN_EXPIRES_IN)`
6. `setAuthCookies(res, access.token, refresh.token)`
7. Return user payload:

```ts
{
  (id, firstName, lastName, email, role, avatarUrl);
}
```

### 3.5 Refresh Token

`refreshTokenService(token, res)`

- لو مفيش `token` → يرجع **401**.
- يتحقّق من refresh JWT عن طريق `verifyJwt`.
- يستخرج `sub` كـ `userId`.
- يجيب المستخدم بـ `findById(userId)`:
  - لو `!user` أو `isDeleted` → **404**.
- ينشئ Access Token جديد فقط.
- يستدعي:
  - `setAuthCookies(res, access.token, token)` → يحتفظ بنفس الـ refresh token.

---

### 3.6 Logout

`logoutService(res)`

- يمسح الكوكيز باستخدام `clearAuthCookies(res)`  
  (أسماء الكوكيز موحدة في `COOKIE_NAMES`).

---

### 3.7 Forgot Password

`forgotPasswordService(email)`

- Normalize للإيميل.
- يبحث عن المستخدم:
  - لو `!user` أو `isDeleted` → **404**  
    `"لا يوجد مستخدم بهذا البريد الإلكتروني"`.
- يولّد OTP مدته 10 دقائق + hash.
- يحفظ القيم في:
  - `resetOtpCode`
  - `resetOtpExpires`
- يرسل الإيميل:
  - `sendPasswordResetOtp(email, code)`.

---

### 3.8 Reset Password (OTP)

`resetPasswordService(email, otpCode, newPassword)`

- يتحقّق إن كل القيم موجودة (`email`, `otpCode`, `newPassword`).
- Normalize للإيميل.
- يجيب المستخدم مع الحقول:
  - `+password +resetOtpCode +resetOtpExpires`
- Checks:
  - لو `!user` أو `isDeleted` → **404**.
  - يتحقق من انتهاء صلاحية الكود + مطابقته:
    - لو invalid → **400**  
      `"رمز الاستعادة غير صالح أو منتهي"`.
- التحديث:
  - `password = newPassword`
  - `resetOtpCode = undefined`
  - `resetOtpExpires = undefined`
  - `save()` (التشفير يتم تلقائيًا في `pre('save')`).

---

## 4. User Services

**الملف:** `src/services/userService.ts`

### 4.1 updateMyProfileService

`updateMyProfileService({ userId, payload, avatarFile })`

- يتحقّق إن فيه على الأقل حقل واحد للتحديث  
  (مغطي أيضًا من Zod في `updateProfileSchema`).
- يجيب المستخدم (ويرفض لو `isDeleted`).

**منطق الصورة:**

1. لو `avatarFile` موجود:
   - ينقل الملف بـ `moveDiskFileToUploads(avatarFile, 'avatars')`.
   - لو فيه `avatarRelPath` قديم:
     - يستدعي `deleteLocalByRelPath(avatarRelPath)`.
   - يحدّث:
     - `avatarUrl`
     - `avatarRelPath`

2. لو **مفيش ملف** لكن فيه `avatar` URL في الـ body:
   - لو فيه `avatarRelPath` قديم:
     - `deleteLocalByRelPath(avatarRelPath)` + تصفيره.
   - يحدّث `avatarUrl` بالـ URL الجاهز.

3. يحدّث `firstName`, `lastName` لو موجودين في الـ payload.

- في النهاية: `save()` + يرجّع `user`.

---

### 4.2 changePasswordService

`changePasswordService(userId, currentPassword, newPassword)`

- يجيب المستخدم بـ:
  - `User.findById(userId).select('+password')`
- لو `!user` أو `isDeleted` → **404**.
- `comparePassword(currentPassword)`:
  - لو النتيجة false → **401** `"كلمة المرور الحالية غير صحيحة"`.
- يحدّث:
  - `password = newPassword`
  - (التشفير يتم في `pre('save')` تلقائيًا).
- `save()`.

---

### 4.3 getAllUsersService

`getAllUsersService(): Promise<IUser[]>`

- استعلام:
  - `User.find({ isDeleted: false }).select('-password')`

---

### 4.4 getUserByIdService

`getUserByIdService(id)`

- استعلام:
  - `User.findById(id).select('-password')`
- لو `!user` أو `isDeleted` → **404** `"المستخدم غير موجود"`.

---

### 4.5 updateUserRoleService

`updateUserRoleService(id, role)`

- يتحقّق إن:
  - `role ∈ { 'student', 'instructor', 'admin' }`.
- يجيب المستخدم بدون كلمة مرور.
- لو `!user` → **404**.
- لو `role` الجديد = `previousRole`:
  - يرجّع `user` كما هو بدون تغيير.
- يحدّث:
  - `user.role = role` → `save()`.

**إدارة `InstructorProfile`:**

1. لو **ترقية إلى مدرس**:
   - `previousRole !== 'instructor' && role === 'instructor'`
   - يبحث عن `InstructorProfile`:
     - لو مش موجود → `create` جديد `{ user: user._id }`.
     - لو موجود و `isActive = false` → يجعله `true`.

2. لو **نزول من مدرس إلى أي دور آخر**:
   - `previousRole === 'instructor' && role !== 'instructor'`
   - `InstructorProfile.updateOne({ user: user._id }, { isActive: false })`.

---

### 4.6 deactivateUserService

`deactivateUserService(userId)`

- يجيب المستخدم.
- لو `!user` → **404** `"المستخدم غير موجود"`.
- لو `role === 'admin'` → **403** `"لا يمكن تعطيل حساب أدمن"`.
- لو `isDeleted` بالفعل → **400** `"الحساب معطل بالفعل"`.
- يحدّث:
  - `isDeleted = true` → `save()`.

- لو `user.role === 'instructor'`:
  - يعطّل `InstructorProfile` المقابل:
    - `updateOne({ user: user._id }, { isActive: false })`.

---

### 4.7 reactivateUserService

`reactivateUserService(userId)`

- يجيب المستخدم.
- لو `!user` → **404** `"المستخدم غير موجود"`.
- لو `role === 'admin'` → **403** `"لا يمكن تعديل حالة حساب الأدمن"`.
- لو `!isDeleted` → **400** `"الحساب مفعل بالفعل"`.
- يحدّث:
  - `isDeleted = false` → `save()`.

- لو `user.role === 'instructor'`:
  - يعيد تفعيل `InstructorProfile`:
    - `updateOne({ user: user._id }, { isActive: true })`.

---

## 5. Controllers & Routes

### 5.1 Auth Controller & Routes

**الملفات:**

- `src/controllers/authController.ts`
- `src/routes/authRoutes.ts`

### Endpoints – `/api/v1/auth`

---

#### `POST /register`

**Middlewares:**

- `otpLimiter`
- `otpSlow`
- `uploadAvatarDisk`
- `validateRequestBody(registerSchema)`

**Body:**

- `firstName`
- `lastName`
- `email`
- `password`
- `avatar` (اختياري – URL جاهز)

**Files (اختياري):**

- ملف `avatar` مرفوع عبر `form-data`.

**Logic:**

- يحرك ملف الصورة (لو موجود) → `avatarUrl`, `avatarRelPath`.
- يستدعي `registerService`.

**Response 201:**

- لو `wasRestored === true`:
  - `"تم استعادة الحساب، يرجى إدخال رمز التفعيل المرسل إلى بريدك."`
- غير ذلك:
  - `"تم إنشاء الحساب. يرجى إدخال رمز التفعيل المرسل إلى بريدك."`

---

#### `POST /verify-email`

**Middlewares:**

- `otpLimiter`
- `otpSlow`
- `validateRequestBody(verifyEmailSchema)`

**Body:**

- `email`
- `otpCode`

**Service:** `verifyEmailService`

**Response 200:**

- `"تم تأكيد البريد الإلكتروني بنجاح ✅"`.

---

#### `POST /resend-verification`

**Middlewares:**

- `otpLimiter`
- `otpSlow`
- `validateRequestBody(resendVerificationEmailSchema)`

**Body:**

- `email`

**Service:** `resendVerificationEmailService`

**Response 200:**

- `"تم إرسال رمز التفعيل بنجاح ✅"`.

---

#### `POST /login`

**Middlewares:**

- `loginLimiter`
- `loginSlow`
- `validateRequestBody(loginSchema)`

**Body:**

- `email`
- `password`

**Service:** `loginService`

**Response 200:**

```json
{
  "message": "تم تسجيل الدخول بنجاح ✅",
  "user": { ... }
}
```

> **ملاحظة:**  
> الـ Tokens (Access + Refresh) يتم إرسالها في الكوكيز  
> (HttpOnly, Secure حسب إعدادات البيئة).

---

### POST /refresh-token

**Middlewares:** — (لا يحتاج body)

**Logic:**

- يقرأ `COOKIE_NAMES.refresh` من `req.cookies`.
- يستدعي:  
  `refreshTokenService(token, res)`.

**Response 200:**

- `"تم تحديث التوكن بنجاح ✅"`.

---

### POST /logout

**Logic:**

- يستدعي `logoutService(res)` لمسح الكوكيز.

**Response 200:**

- `"تم تسجيل الخروج بنجاح ✅"`.

---

### POST /forgot-password

**Middlewares:**

- `otpLimiter`
- `otpSlow`
- `validateRequestBody(forgotPasswordSchema)`

**Body:**

- `email`

**Service:**

- `forgotPasswordService`

**Response 200:**

- `"تم إرسال رمز استعادة كلمة المرور إلى بريدك الإلكتروني"`.

---

### POST /reset-password

**Middlewares:**

- `otpLimiter`
- `otpSlow`
- `validateRequestBody(resetPasswordSchema)`

**Body:**

- `email`
- `otpCode`
- `newPassword`

**Service:**

- `resetPasswordService`

**Response 200:**

- `"تم تغيير كلمة المرور بنجاح ✅"`.

---

## 5.2 User Controller & Routes

**الملفات:**

- `src/controllers/userController.ts`
- `src/routes/userRoutes.ts`

> جميع المسارات في `userRoutes` تمر أولًا على:
>
> ```ts
> router.use(protect);
> ```
>
> يعني لازم يكون المستخدم **مسجّل دخول**.

---

### Endpoints – `/api/v1/users`

---

### `GET /me`

- يرجع بيانات المستخدم الحالي.

**Service:**

- `getMyProfile` → داخليًا:
  - `getUserByIdService(req.user.id)`.

---

### `PATCH /me`

**Middlewares:**

- `uploadAvatarDisk`
- `validateRequestBody(updateProfileSchema)`

**Body:**

- `firstName?`
- `lastName?`
- `avatar?` (URL string)

**Files (اختياري):**

- ملف `avatar`.

**Service:**

- `updateMyProfileService`

**Response:**

```json
{
  "user": { ... }
}
```

### `PATCH /me/change-password`

**Middlewares:**

- `validateRequestBody(changePasswordSchema)`

**Body:**

- `currentPassword`
- `newPassword`

**Service:**

- `changePasswordService`

**Response:**

- `"تم تغيير كلمة المرور بنجاح ✅"`.

---

### `DELETE /me`

**Logic:**

- يمنع حذف حساب الأدمن نفسه.
- ينفّذ soft delete بشكل idempotent:
  - لو الحساب **غير محذوف**:
    - يضبط `isDeleted = true`.
  - لو الحساب **محذوف بالفعل**:
    - لا يكرّر العملية.

- يمسح الكوكيز (خروج إجباري) عبر `clearAuthCookies(res)`.

**Response:**

- `204 No Content`.

---

## Admin-only Routes (بعد `router.use(isAdmin)`)

### `GET /`

- يجلب كل المستخدمين غير المحذوفين.

**Service:**

- `getAllUsersService`.

**Response:**

```json
{
  "users": [ ... ],
  "meta": { "count": n }
}
```

### `GET /:id`

**Middleware:**

- `validateRequestParams(userIdParamsSchema)`

**Service:**

- `getUserByIdService(id)`

---

### `PATCH /:id/role`

**Middlewares:**

- `validateRequestParams(userIdParamsSchema)`
- `validateRequestBody(updateUserRoleSchema)`

**Body:**

```json
{ "role": "student" | "instructor" | "admin" }
```

**Service:**

- `updateUserRoleService(id, role)`

**Response:**

```json
{
  "user": { ... },
  "message": "تم تحديث الدور بنجاح"
}
```

### `PATCH /admin/deactivate/:id`

**Middleware:**

- `validateRequestParams(userIdParamsSchema)`

**Service:**

- `deactivateUserService(id)`

**Response:**

- `"تم تعطيل الحساب بنجاح ✅".`

---

### `PATCH /admin/reactivate/:id`

**Middleware:**

- `validateRequestParams(userIdParamsSchema)`

**Service:**

- `reactivateUserService(id)`

**Response:**

- `"تم تفعيل الحساب بنجاح ✅".`

---

### `GET /search`

**Middlewares:**

- `validateQuery(userSearchQuerySchema)`
- `searchMiddleware({
  model: User,
  fields: ['firstName', 'lastName', 'email'],
  defaultFilters: { isDeleted: false },
})`

**Query params:**

- `searchTerm`
- `page`
- `limit`
- `sortBy`
- `order`
- `afterId`
- `regexMode`
- `useTextSearch`
- `textLanguage`
- `isDeleted?`
  > (مع أن `defaultFilters = { isDeleted: false }`)

**Response:**

- حسب ما يقدمه `searchMiddleware`  
  (غالبًا `{ items, pagination }` أو شكل مشابه).
