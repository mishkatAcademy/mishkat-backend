لمزيد من التفاصيل حول نظام المستخدمين وتسجيل الدخول، راجع:
[docs/user-auth-module.md](docs/user-auth-module.md)

لمزيد من التفاصيل حول نظام الكتب وكل ما يخصها، راجع:
[docs/book-module.md](docs/book-module.md)

## لقد قمت بتعطيل protect and isAdmin داخل userRoutes لأعمال التجربة

# لا تنسى اعادتهم ضروري جدا جدا جدا

## تم اعادتهم

<!-- FINISHED LIST -->

✅ 1. Users (auth + profile)

✅ User.ts
✅ authServices.ts
✅ userServices.ts
✅ authController.ts
✅ userController.ts
✅ user.schema.ts
✅ authRoutes.ts
✅ userRoutes.ts

✅ 2. Addresses

✅ Address.ts
✅ addressServices.ts
✅ addressController.ts
✅ address.schema.ts
✅ addressRoutes.ts

✅ 3. Categories

✅ Category.ts
✅ categoryServices.ts
✅ categoryController.ts
✅ category.schema.ts
✅ categoryRouter.ts

✅ 4. Books

✅ Book.ts
✅ bookServices.ts
✅ bookController.ts
✅ book.schema.ts
✅ bookRoutes.ts

✅ 5. Consulting Appointments (Consultation)

✅ InstructorProfile.ts
✅ ConsultationOffering.ts
✅ ConsultationHold.ts
✅ ConsultationBooking.ts
✅ consultation.schema.ts
✅ consultationServices.ts
✅ consultationController.ts
✅ consultationRoutes.ts

✅ 6. Research Help Requests

✅ ResearchRequest.ts
✅ researchServices.ts
✅ researcController.ts
✅ researc.schema.ts
✅ researchRoutes.ts

🟨 7. CartItems + Orders

✅ CartItem.ts
✅ cartService.ts
✅ cartController.ts
✅ cart.schema.ts
✅ cartRouter.ts

✅ Order.ts
✅ orderServices.ts
✅ orderController.ts
✅ order.schema.ts
✅ orderRoutes.ts

## TO DO LIST

<!-- ✅ 8. Reviews -->
<!-- ✅ Review.ts -->
<!-- ✅ reviewServices.ts -->
<!-- ✅ reviewController.ts -->
<!-- ✅ review.schema.ts -->
<!-- ✅ reviewRouter.ts -->

✅ 9. Courses + Modules + Lessons

✅ Enrollments

✅ Quiz system (Quiz + Questions + Responses)

<!-- TO DO LIST -->

<!-- 🟨 10. Coupons -->

<!-- 🟨 11. Notifications -->

### Routes

"./routes/authRoutes";

<!-- # app.use("/api/auth", authRoutes);

## router.post("/register", register); -->

# Register endpoint

"/api/v1/auth/register"

<!--
{
  firstName: "aaa",
  lastName: "bbb",
  email: "email@example.com",
  password: "123456",
  avatar: "ccc",
  isInstructor: false
}
-->

## router.post("/verify-email", verifyEmail);

<!--
{
  email: "email@example.com",
  otpCode: "856942"   // 6 random numbers
}
-->

## router.post("/resend-verification", resendVerificationEmail);

<!-- { email: "email@example.com", } -->

## router.post("/login", login);

<!--
{
  email: "email@example.com",
  password: "123456"
}
-->

## router.post("/logout", logout);

<!-- There is no data expected in the body -->
<!-- This function only clear tokens from cookies -->

## router.post("/refresh-token", refreshToken);

<!-- There is no data expected in the body -->
<!-- Only expect refreshToken in cookies  -->
<!-- req.cookies.refreshToken -->

## router.post("/forgot-password", forgotPassword);

<!-- { email: "email@example.com", } -->

## router.post("/verify-reset-otp", verifyResetOtp);

<!--
{
  email: "email@example.com",
  otpCode: "856942"   // 6 random numbers
}
-->

## router.post("/reset-password", resetPassword);

<!--
{
  email: "email@example.com",
  newPassword: "123456"
}
-->

"./routes/userRoutes";

# app.use("/api/users", userRoutes);

<!-- ALL USERS -->

## router.get("/me", getMyProfile);

## router.patch("/me", updateMyProfile);

## router.patch("/me/change-password", changePassword);

<!--
{
  currentPassword: "123456",
  newPassword: "987654"
}
-->

## router.delete("/me", deleteMyAccount);

<!-- ADMIN ONLY -->

## router.get("/", getAllUsers);

## router.get("/:id", getUserById);

<!-- param: id -->

## router.patch("/:id/role", updateUserRole);

<!--
{
  role: "student" | "instructor" | "admin"  // one of these values
}
-->
<!-- param: id -->

## router.patch("/admin/deactivate/:id", deactivateUser);

<!-- param: id -->

## router.patch("/admin/reactivate/:id", reactivateUser);

<!-- param: id -->

## router.get("/search", );

<!-- EXAMPLE
  GET /users/search?searchTerm=kareem&role=instructor&page=1&limit=5&sortBy=createdAt&order=desc
-->
<!-- query: searchTerm, role, page, limit, sortBy, order -->

"./routes/bookRoutes";

"./routes/consultationRoutes";

"./routes/researchRequestRoutes";
