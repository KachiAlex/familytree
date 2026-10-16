const nodemailer = require('nodemailer');

// Email sending via generic SMTP (Brevo recommended), with Gmail as fallback.
// Configure with either:
//   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS - generic SMTP (Brevo: smtp-relay.brevo.com:587)
//   GMAIL_USER / GMAIL_APP_PASSWORD               - Gmail SMTP (requires 2FA + App Password)
//   MAIL_FROM                                     - optional sender address (defaults to SMTP_USER/GMAIL_USER)
//   FRONTEND_URL                                  - base URL used for links in emails
const isMailConfigured = () =>
  Boolean(
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
    (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  );

let transporter = null;
const getTransporter = () => {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = process.env.SMTP_HOST
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        })
      : nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
          },
        });
  }
  return transporter;
};

const senderAddress = () => process.env.MAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER;

const sendMail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  if (!t) {
    console.warn('Mail not configured (SMTP_* or GMAIL_* missing); skipping email to', to);
    return { sent: false };
  }
  const from = `"African Family Tree" <${senderAddress()}>`;
  const info = await t.sendMail({ from, replyTo: senderAddress(), to, subject, html, text });
  return { sent: true, messageId: info.messageId };
};

const sendInvitationEmail = async ({ email, token, personName, familyName }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const link = `${frontendUrl}/claim/${token}`;

  return sendMail({
    to: email,
    subject: `You've been invited to claim your family profile${personName ? ` - ${personName}` : ''}`,
    text: `You've been invited to claim your profile on African Family Tree${familyName ? ` (${familyName})` : ''}.\n\nClaim your profile here:\n${link}\n\nThis invitation expires in 7 days.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1565c0; color: #fff; padding: 24px; text-align: center;">
          <h1 style="margin: 0;">African Family Tree</h1>
          <p style="margin: 8px 0 0;">You've been invited to claim your profile!</p>
        </div>
        <div style="background: #f9f9f9; padding: 24px;">
          ${personName ? `<p><strong>Profile:</strong> ${personName}</p>` : ''}
          ${familyName ? `<p><strong>Family:</strong> ${familyName}</p>` : ''}
          <p>Click the button below to claim your profile. This invitation expires in 7 days.</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${link}" style="background: #1565c0; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 4px;">Claim My Profile</a>
          </p>
          <p style="font-size: 12px; color: #666; word-break: break-all;">Or paste this link in your browser: ${link}</p>
          <p style="font-size: 12px; color: #666;">If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>`,
  });
};

const sendPasswordResetEmail = async ({ email, token }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const link = `${frontendUrl}/reset-password?token=${token}`;

  return sendMail({
    to: email,
    subject: 'Reset your African Family Tree password',
    text: `A password reset was requested for your account.\n\nReset your password here:\n${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1565c0; color: #fff; padding: 24px; text-align: center;">
          <h1 style="margin: 0;">African Family Tree</h1>
        </div>
        <div style="background: #f9f9f9; padding: 24px;">
          <p>A password reset was requested for your account. Click the button below to choose a new password. This link expires in 1 hour.</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${link}" style="background: #1565c0; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 4px;">Reset Password</a>
          </p>
          <p style="font-size: 12px; color: #666; word-break: break-all;">Or paste this link in your browser: ${link}</p>
          <p style="font-size: 12px; color: #666;">If you did not request a reset, you can safely ignore this email.</p>
        </div>
      </div>`,
  });
};

module.exports = { isMailConfigured, sendMail, sendInvitationEmail, sendPasswordResetEmail };
