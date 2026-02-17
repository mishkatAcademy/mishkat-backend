// src/utils/email/templates/authOtpTemplates.ts
interface BaseOtpTemplateParams {
  appName: string;
  otp: string; // 6 أرقام
}

/**
 * ألوان وهوية أكاديمية مشكاة
 */
const PALETTE = {
  pageBg: '#F7F6F1',
  cardBg: '#ffffff',
  primary: '#C5A979',
  textMain: '#2b2b2b',
  textMuted: '#666666',
  textSoft: '#949992',
  borderTop: '#C5A979',
};

const baseWrapperStyle = `
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background:${PALETTE.pageBg};
  padding:24px;
`;

const cardStyle = `
  max-width:480px;
  margin:0 auto;
  background:${PALETTE.cardBg};
  border-radius:12px;
  padding:24px;
  border-top:4px solid ${PALETTE.borderTop};
  box-shadow:0 6px 18px rgba(0,0,0,0.04);
`;

const headingStyle = `
  font-size:20px;
  margin:0 0 12px;
  color:${PALETTE.textMain};
`;

const bodyTextStyle = `
  font-size:14px;
  color:${PALETTE.textMuted};
  line-height:1.7;
`;

const otpBoxStyle = `
  display:inline-block;
  font-size:26px;
  letter-spacing:6px;
  padding:12px 24px;
  border-radius:10px;
  background:${PALETTE.primary};
  color:#ffffff;
  font-weight:bold;
`;

const smallTextStyle = `
  font-size:12px;
  color:${PALETTE.textSoft};
  margin-top:24px;
`;

/* =================== Email Verification =================== */
export function buildVerificationOtpEmail({ appName, otp }: BaseOtpTemplateParams) {
  const subject = `رمز التحقق من البريد الإلكتروني – ${appName}`;

  const html = `
    <div dir="rtl" lang="ar" style="${baseWrapperStyle}">
      <div style="${cardStyle}">
        <h1 style="${headingStyle}">مرحبًا بك في ${appName}</h1>

        <p style="${bodyTextStyle}">
          شكرًا لتسجيلك في <strong>${appName}</strong>.<br/>
          من فضلك استخدم رمز التحقق التالي لتأكيد بريدك الإلكتروني:
        </p>

        <p style="text-align:center; margin:24px 0;">
          <span style="${otpBoxStyle}">
            ${otp}
          </span>
        </p>

        <p style="${bodyTextStyle}">
          هذا الرمز صالح لفترة زمنية محدودة، ولا تشاركه مع أي شخص.
        </p>

        <p style="${smallTextStyle}">
          إذا لم تقم بطلب هذا التسجيل، يمكنك تجاهل هذه الرسالة.
        </p>
      </div>
    </div>
  `;

  const text = `
مرحبًا بك في ${appName}

رمز التحقق من البريد الإلكتروني:

${otp}

هذا الرمز صالح لفترة زمنية محدودة، ولا تشاركه مع أي شخص.

إذا لم تقم بطلب هذا التسجيل، يمكنك تجاهل هذه الرسالة.
  `.trim();

  return { subject, html, text };
}

/* =================== Reset Password =================== */
export function buildResetPasswordOtpEmail({ appName, otp }: BaseOtpTemplateParams) {
  const subject = `رمز استعادة كلمة المرور – ${appName}`;

  const html = `
    <div dir="rtl" lang="ar" style="${baseWrapperStyle}">
      <div style="${cardStyle}">
        <h1 style="${headingStyle}">استعادة كلمة المرور</h1>

        <p style="${bodyTextStyle}">
          تم طلب استعادة كلمة المرور لحسابك في <strong>${appName}</strong>.<br/>
          استخدم رمز التحقق التالي لإكمال عملية استعادة كلمة المرور:
        </p>

        <p style="text-align:center; margin:24px 0;">
          <span style="${otpBoxStyle}">
            ${otp}
          </span>
        </p>

        <p style="${bodyTextStyle}">
          هذا الرمز صالح لفترة زمنية محدودة، ولا تشاركه مع أي شخص.
        </p>

        <p style="${smallTextStyle}">
          إذا لم تقم بطلب استعادة كلمة المرور، تجاهل هذه الرسالة، أو قم بتغيير كلمة المرور إذا كنت تشك في أي نشاط غريب.
        </p>
      </div>
    </div>
  `;

  const text = `
استعادة كلمة المرور – ${appName}

تم طلب استعادة كلمة المرور لحسابك.

رمز التحقق:

${otp}

هذا الرمز صالح لفترة زمنية محدودة، ولا تشاركه مع أي شخص.

إذا لم تقم بطلب استعادة كلمة المرور، تجاهل هذه الرسالة أو قم بتغيير كلمة المرور إذا كنت تشك في أي نشاط غريب.
  `.trim();

  return { subject, html, text };
}
