// import { Request, Response } from "express";
// import QuizQuestion from "../models/QuizQuestion";
// import { AuthenticatedRequest } from "../middlewares/authMiddleware";

// // ➕ إنشاء سؤال جديد في كويز معيّن
// export const createQuizQuestion = async (
//   req: AuthenticatedRequest,
//   res: Response
// ) => {
//   try {
//     const { quiz, question, options } = req.body;

//     const newQuestion = await QuizQuestion.create({
//       quiz,
//       question,
//       options,
//     });

//     res.status(201).json({
//       message: "Question created successfully",
//       question: newQuestion,
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };

// // 📄 جلب سؤال واحد
// export const getQuizQuestionById = async (req: Request, res: Response) => {
//   try {
//     const question = await QuizQuestion.findById(req.params.id);
//     if (!question || question.isDeleted) {
//       return res.status(404).json({ message: "Question not found" });
//     }

//     res.status(200).json(question);
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };

// // 📚 جلب كل الأسئلة الخاصة بكويز معيّن
// export const getQuestionsByQuiz = async (req: Request, res: Response) => {
//   try {
//     const questions = await QuizQuestion.find({
//       quiz: req.params.quizId,
//       isDeleted: false,
//     });

//     res.status(200).json(questions);
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };

// // ✏️ تعديل سؤال
// export const updateQuizQuestion = async (req: Request, res: Response) => {
//   try {
//     const updated = await QuizQuestion.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true }
//     );

//     if (!updated || updated.isDeleted) {
//       return res.status(404).json({ message: "Question not found" });
//     }

//     res.status(200).json({ message: "Question updated", question: updated });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };

// // 🗑️ حذف سؤال (soft delete)
// export const deleteQuizQuestion = async (req: Request, res: Response) => {
//   try {
//     const deleted = await QuizQuestion.findByIdAndUpdate(
//       req.params.id,
//       { isDeleted: true },
//       { new: true }
//     );

//     if (!deleted) {
//       return res.status(404).json({ message: "Question not found" });
//     }

//     res.status(200).json({ message: "Question deleted" });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };
