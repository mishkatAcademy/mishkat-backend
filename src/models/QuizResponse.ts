import mongoose, { Schema, Document, Types } from "mongoose";

interface IAnswer {
  questionId: Types.ObjectId;
  selectedOptionId: Types.ObjectId;
}

export interface IQuizResponse extends Document {
  quiz: Types.ObjectId;
  student: Types.ObjectId;
  answers: IAnswer[];
  score: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuizResponseSchema = new Schema<IQuizResponse>(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "QuizQuestion",
          required: true,
        },
        selectedOptionId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
      },
    ],
    score: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IQuizResponse>(
  "QuizResponse",
  QuizResponseSchema
);
