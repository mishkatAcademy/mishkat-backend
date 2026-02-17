import mongoose, { Schema, Document, Types } from "mongoose";

export interface IModule extends Document {
  title: string;
  course: Types.ObjectId;
  order: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ModuleSchema: Schema = new Schema<IModule>(
  {
    title: { type: String, required: true },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    order: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IModule>("Module", ModuleSchema);
