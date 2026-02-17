// import express from "express";
// import {
//   createQuiz,
//   getQuizById,
//   updateQuiz,
//   deleteQuiz,
//   getQuizzesByLesson,
// } from "../controllers/quizController";
// import { protect } from "../middlewares/authMiddleware";

// const router = express.Router();

// // 🔒 كل الراوتات محمية بلوجيك تسجيل الدخول
// router.use(protect);

// // ➕ إنشاء كويز جديد (مرتبط بدرس)
// router.post("/", createQuiz);

// // 📄 جلب كويز محدد بالـ ID
// router.get("/:id", getQuizById);

// // ✏️ تعديل كويز
// router.put("/:id", updateQuiz);

// // 🗑️ حذف كويز (soft delete)
// router.delete("/:id", deleteQuiz);

// // 📚 الحصول على كل الكويزات المرتبطة بدرس معيّن
// router.get("/lesson/:lessonId", getQuizzesByLesson);

// export default router;
