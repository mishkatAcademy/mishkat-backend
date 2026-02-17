import { Request, Response } from 'express';
import Quiz from '../models/Quiz';
import Lesson from '../models/Lesson';

// ✅ إنشاء Quiz جديد
export const createQuiz = async (req: Request, res: Response) => {
  try {
    const { lessonId, questions } = req.body;

    const lessonExists = await Lesson.findById(lessonId);
    if (!lessonExists) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const quiz = await Quiz.create({
      lesson: lessonId,
      questions,
    });

    res.status(201).json({ message: 'Quiz created', quiz });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// ✅ تحديث Quiz
export const updateQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = (req.validated?.params as { id: string }) ?? req.params;
    const { questions } = req.body;

    const quiz = await Quiz.findByIdAndUpdate(id, { questions }, { new: true });

    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    res.status(200).json({ message: 'Quiz updated', quiz });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// ✅ حذف Quiz (منطقيًا)
export const deleteQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = (req.validated?.params as { id: string }) ?? req.params;

    const quiz = await Quiz.findByIdAndUpdate(id, { isDeleted: true }, { new: true });

    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    res.status(200).json({ message: 'Quiz deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// ✅ استرجاع كل الـ Quizzes لدرس معين
export const getQuizzesByLesson = async (req: Request, res: Response) => {
  try {
    const { lessonId } = (req.validated?.params as { lessonId: string }) ?? req.params;

    const quizzes = await Quiz.find({
      lesson: lessonId,
      isDeleted: false,
    });

    res.status(200).json(quizzes);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// ✅ استرجاع Quiz واحد بالتفصيل
export const getQuizById = async (req: Request, res: Response) => {
  try {
    const { id } = (req.validated?.params as { id: string }) ?? req.params;

    const quiz = await Quiz.findById(id);
    if (!quiz || quiz.isDeleted) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    res.status(200).json(quiz);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
