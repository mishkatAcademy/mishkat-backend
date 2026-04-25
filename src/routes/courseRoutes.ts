// import express from "express";
// import {
//   createCourse,
//   getAllCourses,
//   getSingleCourse,
//   updateCourse,
//   deleteCourse,
// } from "../controllers/courseController";

// import { protect } from "../middlewares/authMiddleware";

// const router = express.Router();

// // 🆕 إنشاء كورس جديد
// router.post("/", protect, createCourse);

// // 📚 كل الكورسات
// router.get("/", getAllCourses);

// // 🔍 كورس محدد (ID أو slug)
// router.get("/:idOrSlug", getSingleCourse);

// // ✏️ تعديل كورس
// router.put("/:id", protect, updateCourse);

// // 🗑️ حذف كورس
// router.delete("/:id", protect, deleteCourse);

// export default router;
