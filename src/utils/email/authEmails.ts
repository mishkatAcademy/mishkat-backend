// src/utils/email/authEmails.ts
import { env } from '../../config/env';
import { sendEmail } from './resendClient';
import {
  buildVerificationOtpEmail,
  buildResetPasswordOtpEmail,
} from './templates/authOtpTemplates';

const APP_NAME = env.APP_NAME ?? 'Mishkat Academy';

export async function sendEmailVerificationOtp(email: string, otp: string) {
  const { subject, html, text } = buildVerificationOtpEmail({ appName: APP_NAME, otp });
  await sendEmail({ to: email, subject, html, text });
}

export async function sendPasswordResetOtp(email: string, otp: string) {
  const { subject, html, text } = buildResetPasswordOtpEmail({ appName: APP_NAME, otp });
  await sendEmail({ to: email, subject, html, text });
}
