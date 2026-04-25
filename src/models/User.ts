// src/models/User.ts
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IAddress } from './Address';
import { IBook } from './Book';
import { ICourse } from './Course';
import { IConsultationBooking } from './ConsultationBooking';
import { IResearchRequest } from './ResearchRequest';
import type { Role } from '../types';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;

  // Avatar (طبقًا لنظام الرفع الجديد)
  avatarUrl?: string; // رابط عام علشان الفرونت
  avatarRelPath?: string; // مسار داخلي تحت uploads/... للحذف فقط

  isEmailVerified: boolean;
  role: Role;
  phoneNumber?: string;

  addresses?: (mongoose.Types.ObjectId | IAddress)[];

  // [BOOKS], [COURSES], {SESSIONS => [CONSULTATIONS], [RESEARCHES]}
  books: (mongoose.Types.ObjectId | IBook)[];
  courses: (mongoose.Types.ObjectId | ICourse)[];

  sessions: {
    consultations: (mongoose.Types.ObjectId | IConsultationBooking)[];
    researchs: (mongoose.Types.ObjectId | IResearchRequest)[];
  };

  wishList: {
    books: (mongoose.Types.ObjectId | IBook)[];
    courses: (mongoose.Types.ObjectId | ICourse)[];
  };

  // OTPs
  emailOtpCode?: string;
  emailOtpExpires?: Date;

  resetOtpCode?: string;
  resetOtpExpires?: Date;

  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidatePassword: string): Promise<boolean>;
  fullName?: string; // من الـ virtual
}

const UserSchema: Schema<IUser> = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },

    password: { type: String, required: true, select: false },

    avatarUrl: { type: String },
    avatarRelPath: { type: String },

    isEmailVerified: { type: Boolean, default: false },

    role: {
      type: String,
      enum: ['student', 'instructor', 'admin'],
      default: 'student',
    },

    phoneNumber: { type: String, unique: true, sparse: true, trim: true },

    addresses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Address' }],

    books: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],

    sessions: {
      consultations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ConsultationBooking' }],
      researchs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ResearchRequest' }],
    },

    wishList: {
      books: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
      courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    },

    // OTPs
    emailOtpCode: { type: String, select: false },
    emailOtpExpires: { type: Date },

    resetOtpCode: { type: String, select: false },
    resetOtpExpires: { type: Date },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toObject: {
      versionKey: false,
      virtuals: true,
      transform(_doc: any, ret: any) {
        delete ret.password;
        delete ret.emailOtpCode;
        delete ret.resetOtpCode;
        delete ret.avatarRelPath;
        return ret;
      },
    },
    toJSON: {
      versionKey: false,
      virtuals: true,
      transform(_doc: any, ret: any) {
        delete ret.password;
        delete ret.emailOtpCode;
        delete ret.resetOtpCode;
        delete ret.avatarRelPath;
        return ret;
      },
    },
  },
);

// 🔐 تشفير كلمة المرور قبل الحفظ
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ✅ مقارنة كلمات المرور
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Virtual
UserSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

UserSchema.index({ isDeleted: 1 });

export default mongoose.model<IUser>('User', UserSchema);
