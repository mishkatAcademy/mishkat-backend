// import { Request, Response } from "express";
// import Course from "../models/Course";
// import { AuthenticatedRequest } from "../middlewares/authMiddleware";

// // ➕ إنشاء كورس
// export const createCourse = async (
//   req: AuthenticatedRequest,
//   res: Response
// ) => {
//   try {
//     const {
//       title,
//       description,
//       price,
//       isFree,
//       image,
//       category,
//       tags,
//       duration,
//     } = req.body;

//     const course = await Course.create({
//       title,
//       description,
//       price,
//       isFree,
//       image,
//       category,
//       instructor: req.userId,
//       tags,
//       duration,
//     });

//     res.status(201).json({ message: "Course created successfully", course });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };

// // 📚 جلب كل الكورسات (بدون المحذوفة)
// export const getAllCourses = async (req: Request, res: Response) => {
//   try {
//     const courses = await Course.find({ isDeleted: false }).populate(
//       "category instructor",
//       "title name email"
//     );

//     res.status(200).json(courses);
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };

// export const getSingleCourse = async (req: Request, res: Response) => {
//   try {
//     const { idOrSlug } = req.params;

//     const course = await Course.findOne({
//       $or: [{ _id: idOrSlug }, { slug: idOrSlug }],
//       isDeleted: false,
//     }).populate("category instructor", "title name email");

//     if (!course) return res.status(404).json({ message: "Course not found" });

//     res.status(200).json(course);
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };

// export const updateCourse = async (
//   req: AuthenticatedRequest,
//   res: Response
// ) => {
//   try {
//     const { id } = req.params;

//     const course = await Course.findById(id);
//     if (!course || course.isDeleted) {
//       return res.status(404).json({ message: "Course not found" });
//     }

//     if (course.instructor.toString() !== req.userId) {
//       return res.status(403).json({ message: "Unauthorized" });
//     }

//     const updates = req.body;
//     Object.assign(course, updates);
//     await course.save();

//     res.status(200).json({ message: "Course updated", course });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };

// export const deleteCourse = async (
//   req: AuthenticatedRequest,
//   res: Response
// ) => {
//   try {
//     const { id } = req.params;

//     const course = await Course.findById(id);
//     if (!course || course.isDeleted) {
//       return res.status(404).json({ message: "Course not found" });
//     }

//     if (course.instructor.toString() !== req.userId) {
//       return res.status(403).json({ message: "Unauthorized" });
//     }

//     course.isDeleted = true;
//     await course.save();

//     res.status(200).json({ message: "Course deleted successfully" });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };
