import { Request, Response } from 'express';
import Module from '../models/Module';

// ✅ إنشاء وحدة جديدة
export const createModule = async (req: Request, res: Response) => {
  try {
    const { title, course, order } = req.validated?.body ?? req.body;

    const module = await Module.create({
      title,
      course,
      order,
    });

    res.status(201).json({
      message: 'Module created successfully',
      module,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// ✅ جلب الوحدات حسب الكورس
export const getModulesByCourse = async (req: Request, res: Response) => {
  try {
    const { courseId } = (req.validated?.params as { courseId: string }) ?? req.params;
    const modules = await Module.find({
      course: courseId,
      isDeleted: false,
    }).sort('order');

    res.status(200).json(modules);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// ✅ تعديل وحدة
export const updateModule = async (req: Request, res: Response) => {
  try {
    const { id } = (req.validated?.params as { id: string }) ?? req.params;
    const { title, order } = req.validated?.body ?? req.body;

    const updated = await Module.findByIdAndUpdate(id, { title, order }, { new: true });

    if (!updated) return res.status(404).json({ message: 'Module not found' });

    res.status(200).json({ message: 'Module updated', module: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// ✅ حذف وحدة (soft delete)
export const deleteModule = async (req: Request, res: Response) => {
  try {
    const { id } = (req.validated?.params as { id: string }) ?? req.params;

    const deleted = await Module.findByIdAndUpdate(id, {
      isDeleted: true,
    });

    if (!deleted) return res.status(404).json({ message: 'Module not found' });

    res.status(200).json({ message: 'Module deleted (soft)' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
