import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const fromAddress = "Tennis Bracket <noreply@resend.dev>";

export async function sendInviteEmail(to: string, token: string) {
  const url = `${appUrl}/auth/accept-invite/${token}`;

  await resend.emails.send({
    from: fromAddress,
    to,
    subject: "You've been approved — set up your account",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Welcome to Tennis Bracket Challenge</h2>
        <p style="color: #475569;">Your access request has been approved. Click the button below to create your username and password.</p>
        <p style="margin: 32px 0;">
          <a href="${url}" style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Set Up Your Account
          </a>
        </p>
        <p style="color: #94a3b8; font-size: 13px;">This link expires in 7 days. If you didn't request access, you can ignore this email.</p>
        <p style="color: #94a3b8; font-size: 12px;">Or copy this URL into your browser:<br>${url}</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${appUrl}/auth/reset-password/${token}`;

  await resend.emails.send({
    from: fromAddress,
    to,
    subject: "Reset your password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Reset Your Password</h2>
        <p style="color: #475569;">We received a request to reset your password. Click the button below to choose a new one.</p>
        <p style="margin: 32px 0;">
          <a href="${url}" style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Reset Password
          </a>
        </p>
        <p style="color: #94a3b8; font-size: 13px;">This link expires in 1 hour. If you didn't request a password reset, you can ignore this email.</p>
        <p style="color: #94a3b8; font-size: 12px;">Or copy this URL into your browser:<br>${url}</p>
      </div>
    `,
  });
}
