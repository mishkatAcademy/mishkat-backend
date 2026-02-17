import mongoose, { Schema, Document, Types } from "mongoose";

interface IOption {
  _id: Types.ObjectId;
  text: string;
  isCorrect: boolean;
}

export interface IQuizQuestion extends Document {
  quiz: Types.ObjectId;
  question: string;
  options: IOption[];
  order: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuizQuestionSchema = new Schema<IQuizQuestion>(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
    question: { type: String, required: true },
    options: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        text: { type: String, required: true },
        isCorrect: { type: Boolean, required: true },
      },
    ],
    order: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IQuizQuestion>(
  "QuizQuestion",
  QuizQuestionSchema
);
