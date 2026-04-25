// مجرد بداية الشغل الأساسي في version II إن شاء الله

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IQuiz extends Document {
  lesson: Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuizSchema = new Schema<IQuiz>(
  {
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model<IQuiz>('Quiz', QuizSchema);
