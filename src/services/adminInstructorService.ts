// src/services/adminInstructorService.ts
import User from '../models/User';
import InstructorProfile from '../models/InstructorProfile';
import AppError from '../utils/AppError';

type Localized = { ar?: string; en?: string };

function toLocalizedMaybe(v: any): Localized | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return { ar: v };
  if (typeof v === 'object' && ('ar' in v || 'en' in v)) return v;
  return undefined;
}

export async function adminCreateInstructorService(input: any) {
  // 1) guards
  const exists = await User.findOne({ email: input.email }).select('_id').lean();
  if (exists) throw AppError.conflict('Email already exists');

  if (input.phoneNumber) {
    const phoneExists = await User.findOne({ phoneNumber: input.phoneNumber }).select('_id').lean();
    if (phoneExists) throw AppError.conflict('Phone number already exists');
  }

  // 2) create user as instructor
  const user = await User.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phoneNumber: input.phoneNumber,
    password: input.password,
    role: 'instructor',
    isEmailVerified: !!input.verifyEmail,
    isDeleted: false,
  });

  try {
    const userId = String(user._id);
    // 3) create profile
    const profile = await InstructorProfile.create({
      user: userId,
      displayName: toLocalizedMaybe(input.displayName),
      headline: toLocalizedMaybe(input.headline),
      bio: toLocalizedMaybe(input.bio),
      academicDegree: toLocalizedMaybe(input.academicDegree),
      experiences: input.experiences,
      certifications: input.certifications,

      supportedTypes: input.supportedTypes ?? ['academic'],
      timezone: input.timezone ?? 'Asia/Riyadh',
      bufferMinutes: input.bufferMinutes ?? 10,
      minNoticeHours: input.minNoticeHours ?? 24,
      maxAdvanceDays: input.maxAdvanceDays ?? 30,
      rescheduleWindowHours: input.rescheduleWindowHours ?? 12,
      weekly: input.weekly ?? [],
      isActive: true,
      meetingMethod: 'manual',
      meetingUrl: input.meetingUrl,
    });

    // populate for response
    const populated = await InstructorProfile.findById(profile._id)
      .populate({ path: 'user', select: 'firstName lastName email role avatarUrl isDeleted' })
      .lean();

    return populated;
  } catch (e) {
    // rollback manual: delete created user if profile fails
    await User.deleteOne({ _id: user._id });
    throw e;
  }
}
