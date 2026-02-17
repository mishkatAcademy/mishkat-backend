// import express from "express";
// import {
//   enrollInCourse,
//   getUserEnrollments,
//   updateEnrollmentProgress,
// } from "../controllers/enrollmentController";
// import { protect } from "../middlewares/authMiddleware";

// const router = express.Router();

// // ✅ الاشتراك في كورس (يجب أن يكون المستخدم مسجلاً الدخول)
// router.post("/", protect, enrollInCourse);

// // ✅ الحصول على كل الكورسات اللي الطالب مشترك فيها
// router.get("/my-enrollments", protect, getUserEnrollments);

// // ✅ تحديث التقدم في كورس معين
// router.patch("/:id/progress", protect, updateEnrollmentProgress);

// export default router;
