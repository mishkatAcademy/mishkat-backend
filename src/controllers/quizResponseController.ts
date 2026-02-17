// import { Request, Response } from "express";
// import Quiz from "../models/Quiz";
// import QuizQuestion from "../models/QuizQuestion";
// import QuizResponse from "../models/QuizResponse";
// import { AuthenticatedRequest } from "../middlewares/authMiddleware";

// // إرسال إجابة كويز
// export const submitQuizResponse = async (
//   req: AuthenticatedRequest,
//   res: Response
// ) => {
//   try {
//     const { quizId, answers } = req.body;
//     const studentId = req.userId;

//     const quizExists = await Quiz.findById(quizId);
//     if (!quizExists) return res.status(404).json({ message: "Quiz not found" });

//     let score = 0;

//     for (const userAnswer of answers) {
//       const question = await QuizQuestion.findById(userAnswer.questionId);
//       if (!question) continue;

//       const selectedOption = question.options.find(
//         (opt) => opt._id?.toString() === userAnswer.selectedOptionId
//       );

//       if (selectedOption?.isCorrect) score++;
//     }

//     const newResponse = await QuizResponse.create({
//       quiz: quizId,
//       student: studentId,
//       answers,
//       score,
//     });

//     res.status(201).json({
//       message: "Quiz submitted",
//       score,
//       resultId: newResponse._id,
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };

// // استرجاع نتيجة كويز لطالب معيّن
// export const getQuizResult = async (
//   req: AuthenticatedRequest,
//   res: Response
// ) => {
//   try {
//     const response = await QuizResponse.findOne({
//       quiz: req.params.quizId,
//       student: req.userId,
//     });

//     if (!response) return res.status(404).json({ message: "Result not found" });

//     res.status(200).json(response);
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err });
//   }
// };
