import mongoose, { Schema, Document, Types } from "mongoose";

// export type ReviewTargetType = "book" | "course" | "consultation" | "research";
export const REVIEW_TARGETS = [
  "book",
  "course",
  "consultation",
  "research",
] as const;
export type ReviewTargetType = (typeof REVIEW_TARGETS)[number];

export interface IReview extends Document {
  user: Types.ObjectId;
  targetId: Types.ObjectId; // ID للكتاب أو الكورس
  targetType: ReviewTargetType; // "book" أو "course" أو "consultation" أو "resarch"
  rating: number;
  comment?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: {
      type: String,
      required: true,
      enum: REVIEW_TARGETS,
    },
    rating: {
      type: Number,
      required: true,
      min: [1, "الحد الأدنى للتقييم هو 1"],
      max: [5, "الحد الأقصى للتقييم هو 5"],
      default: 5,
    },
    comment: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ✅ منع المستخدم من تقييم نفس الكتاب أو الكورس أو الخدمة مرتين
reviewSchema.index({ user: 1, targetId: 1, targetType: 1 }, { unique: true });

reviewSchema.virtual("target", {
  ref: (doc: any) => {
    switch (doc.targetType) {
      case "book":
        return "Book";
      case "course":
        return "Course";
      case "consultation":
        return "Consultation";
      case "research":
        return "Research";
      default:
        return null;
    }
  },
  localField: "targetId",
  foreignField: "_id",
  justOne: true,
});

export default mongoose.model<IReview>("Review", reviewSchema);
