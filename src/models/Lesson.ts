// مجرد بداية الشغل الأساسي في version II إن شاء الله

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILesson extends Document {
  title: string;
  module: Types.ObjectId;
  videoUrl?: string;
  textContent?: string;
  pdfUrl?: string;
  order: number;
  isFreePreview: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LessonSchema: Schema = new Schema<ILesson>(
  {
    title: { type: String, required: true },
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
    },
    videoUrl: { type: String },
    textContent: { type: String },
    pdfUrl: { type: String },
    order: { type: Number, default: 0 },
    isFreePreview: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<ILesson>('Lesson', LessonSchema);
