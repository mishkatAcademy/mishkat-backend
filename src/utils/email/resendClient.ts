// src/utils/email/resendClient.ts
import { Resend } from 'resend';
import { env } from '../../config/env';
import AppError from '../AppError';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const { to, subject, html, text } = opts;

  const { data, error } = await resend.emails.send({
    from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
    to: [to],
    subject,
    html,
    text,
  });

  if (error) {
    console.error('Resend email error', error);
    throw AppError.internal('فشل في إرسال البريد الإلكتروني، حاول مرة أخرى لاحقًا');
  }

  return data;
}
