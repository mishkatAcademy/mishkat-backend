// import express from "express";
// import {
//   createQuizQuestion,
//   getQuizQuestionById,
//   getQuestionsByQuiz,
//   updateQuizQuestion,
//   deleteQuizQuestion,
// } from "../controllers/quizQuestionController";
// import { protect } from "../middlewares/authMiddleware";

// const router = express.Router();

// // 🛡️ كل العمليات محمية - لازم المستخدم يكون مسجل دخول
// router.use(protect);

// // ➕ إضافة سؤال لكويز
// router.post("/", createQuizQuestion);

// // 📄 جلب سؤال معيّن
// router.get("/:id", getQuizQuestionById);

// // 📚 جلب كل الأسئلة التابعة لكويز معيّن
// router.get("/quiz/:quizId", getQuestionsByQuiz);

// // ✏️ تعديل سؤال
// router.put("/:id", updateQuizQuestion);

// // 🗑️ حذف سؤال (soft delete)
// router.delete("/:id", deleteQuizQuestion);

// export default router;
