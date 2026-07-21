import { Resend } from 'resend';
import { env } from '@/lib/env';

function getResend() {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set.');
  }
  return new Resend(env.RESEND_API_KEY);
}

function getFrom() {
  if (!env.EMAIL_FROM) {
    throw new Error('EMAIL_FROM is not set. Configure a verified sender (e.g. "FolioX Tracker <no-reply@mail.folioxtracker.com>").');
  }
  return env.EMAIL_FROM;
}

function getReplyTo() {
  return env.EMAIL_REPLY_TO;
}

type SendPayload = Parameters<Resend['emails']['send']>[0];

// Resend's SDK returns { data, error } rather than throwing on API-level
// failures (bad key, unverified domain, rate limit). Surface those as thrown
// errors so callers (Better Auth verification/reset flows) don't silently
// believe an email went out.
async function send(payload: SendPayload) {
  const { data, error } = await getResend().emails.send(payload);
  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? JSON.stringify(error)}`);
  }
  return data;
}

export async function sendRebalanceAlert(
  to: string,
  drifts: { category: string; currentPct: number; targetPct: number; driftPct: number }[]
) {
  const driftRows = drifts
    .map(d => `<tr><td>${d.category}</td><td>${d.currentPct.toFixed(1)}%</td><td>${d.targetPct.toFixed(1)}%</td><td style="color: ${Math.abs(d.driftPct) > 5 ? 'red' : 'inherit'}">${d.driftPct > 0 ? '+' : ''}${d.driftPct.toFixed(1)}%</td></tr>`)
    .join('');

  const driftText = drifts
    .map(d => `  - ${d.category}: ${d.currentPct.toFixed(1)}% (target ${d.targetPct.toFixed(1)}%, drift ${d.driftPct > 0 ? '+' : ''}${d.driftPct.toFixed(1)}%)`)
    .join('\n');

  const unsubscribeMailto = env.EMAIL_UNSUBSCRIBE_MAILTO;

  await send({
    from: getFrom(),
    to,
    replyTo: getReplyTo(),
    subject: 'Portfolio Rebalance Alert',
    headers: unsubscribeMailto
      ? { 'List-Unsubscribe': `<mailto:${unsubscribeMailto}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
      : undefined,
    text: `Portfolio Allocation Drift Detected\n\n${driftText}\n\nLog in to FolioX Tracker to review and rebalance.`,
    html: `
      <h2>Portfolio Allocation Drift Detected</h2>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><th>Category</th><th>Current</th><th>Target</th><th>Drift</th></tr>
        ${driftRows}
      </table>
      <p>Log in to FolioX Tracker to review and rebalance.</p>
    `,
  });
}

export async function sendVerificationEmail(to: string, url: string) {
  await send({
    from: getFrom(),
    to,
    replyTo: getReplyTo(),
    subject: 'Verify your email',
    text: `Welcome to FolioX Tracker.\n\nVerify your email by opening this link:\n${url}\n\nIf you didn't sign up, you can ignore this email.`,
    html: `
      <h2>Welcome to FolioX Tracker</h2>
      <p>Click the link below to verify your email address:</p>
      <p><a href="${url}">Verify email</a></p>
      <p>If you didn't sign up, you can ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, url: string) {
  await send({
    from: getFrom(),
    to,
    replyTo: getReplyTo(),
    subject: 'Reset your password',
    text: `Password reset requested.\n\nChoose a new password by opening this link (expires in 1 hour):\n${url}\n\nIf you didn't request a password reset, you can ignore this email.`,
    html: `
      <h2>Password reset</h2>
      <p>Click the link below to choose a new password. This link expires in 1 hour.</p>
      <p><a href="${url}">Reset password</a></p>
      <p>If you didn't request a password reset, you can ignore this email.</p>
    `,
  });
}
