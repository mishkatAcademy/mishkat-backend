import { Request, Response } from 'express';
import Lesson from '../models/Lesson';

// ✅ إنشاء درس جديد
export const createLesson = async (req: Request, res: Response) => {
  try {
    const newLesson = await Lesson.create(req.body);
    res.status(201).json(newLesson);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create lesson', error: err });
  }
};

// ✅ استرجاع كل الدروس الخاصة بموديول معين
export const getLessonsByModule = async (req: Request, res: Response) => {
  try {
    const { moduleId } = (req.validated?.params as { moduleId: string }) ?? req.params;
    const lessons = await Lesson.find({
      module: moduleId,
      isDeleted: false,
    }).sort('order');
    res.status(200).json(lessons);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get lessons', error: err });
  }
};

// ✅ استرجاع درس واحد
export const getLessonById = async (req: Request, res: Response) => {
  try {
    const { id } = (req.validated?.params as { id: string }) ?? req.params;
    const lesson = await Lesson.findById(id);
    if (!lesson || lesson.isDeleted) return res.status(404).json({ message: 'Lesson not found' });
    res.status(200).json(lesson);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get lesson', error: err });
  }
};

// ✅ تحديث درس
export const updateLesson = async (req: Request, res: Response) => {
  try {
    const { id } = (req.validated?.params as { id: string }) ?? req.params;
    const updated = req.validated?.body ?? req.body;
    const updatedLesson = await Lesson.findByIdAndUpdate(id, updated, {
      new: true,
    });
    if (!updatedLesson || updatedLesson.isDeleted)
      return res.status(404).json({ message: 'Lesson not found' });
    res.status(200).json(updatedLesson);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update lesson', error: err });
  }
};

// ✅ حذف درس (soft delete)
export const deleteLesson = async (req: Request, res: Response) => {
  try {
    const { id } = (req.validated?.params as { id: string }) ?? req.params;
    const lesson = await Lesson.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    res.status(200).json({ message: 'Lesson deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete lesson', error: err });
  }
};
