// import { Request, Response } from "express";
// import Enrollment from "../models/Enrollment";

// import Course from "../models/Course";
// import { AuthenticatedRequest } from "../middlewares/authMiddleware";

// // ✅ الاشتراك في كورس
// export const enrollInCourse = async (
//   req: AuthenticatedRequest,
//   res: Response
// ) => {
//   try {
//     const { courseId } = req.body;

//     // تحقق من وجود الكورس
//     const course = await Course.findById(courseId);
//     if (!course) return res.status(404).json({ message: "Course not found" });

//     // تحقق إذا كان المستخدم مشترك بالفعل
//     const existing = await Enrollment.findOne({
//       student: req.userId,
//       course: courseId,
//     });
//     if (existing) return res.status(400).json({ message: "Already enrolled" });

//     const enrollment = await Enrollment.create({
//       student: req.userId,
//       course: courseId,
//       isPaid: !course.isFree, // لو الكورس مش مجاني → لازم يدفع
//     });

//     res.status(201).json({
//       message: "Enrolled successfully",
//       enrollment,
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };

// // ✅ الحصول على كل الكورسات المشترك بها طالب
// export const getUserEnrollments = async (
//   req: AuthenticatedRequest,
//   res: Response
// ) => {
//   try {
//     const enrollments = await Enrollment.find({ student: req.userId }).populate(
//       "course",
//       "title price isFree image"
//     );

//     res.status(200).json(enrollments);
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };

// // ✅ تحديث تقدم الطالب في كورس
// export const updateEnrollmentProgress = async (
//   req: AuthenticatedRequest,
//   res: Response
// ) => {
//   try {
//     const { id } = req.params;
//     const { progress } = req.body;

//     const enrollment = await Enrollment.findOne({
//       _id: id,
//       student: req.userId,
//     });

//     if (!enrollment) {
//       return res.status(404).json({ message: "Enrollment not found" });
//     }

//     enrollment.progress = progress;
//     await enrollment.save();

//     res.status(200).json({ message: "Progress updated", enrollment });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };
