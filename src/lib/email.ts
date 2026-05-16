import { Resend } from 'resend';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function getFrom() {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error('EMAIL_FROM is not set. Configure a verified sender (e.g. "Portfolio Tracker <no-reply@mail.yourdomain.com>").');
  }
  return from;
}

function getReplyTo() {
  return process.env.EMAIL_REPLY_TO;
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

  const unsubscribeMailto = process.env.EMAIL_UNSUBSCRIBE_MAILTO;

  await getResend().emails.send({
    from: getFrom(),
    to,
    replyTo: getReplyTo(),
    subject: 'Portfolio Rebalance Alert',
    headers: unsubscribeMailto
      ? { 'List-Unsubscribe': `<mailto:${unsubscribeMailto}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
      : undefined,
    text: `Portfolio Allocation Drift Detected\n\n${driftText}\n\nLog in to your portfolio tracker to review and rebalance.`,
    html: `
      <h2>Portfolio Allocation Drift Detected</h2>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><th>Category</th><th>Current</th><th>Target</th><th>Drift</th></tr>
        ${driftRows}
      </table>
      <p>Log in to your portfolio tracker to review and rebalance.</p>
    `,
  });
}

export async function sendVerificationEmail(to: string, url: string) {
  await getResend().emails.send({
    from: getFrom(),
    to,
    replyTo: getReplyTo(),
    subject: 'Verify your email',
    text: `Welcome to Portfolio Tracker.\n\nVerify your email by opening this link:\n${url}\n\nIf you didn't sign up, you can ignore this email.`,
    html: `
      <h2>Welcome to Portfolio Tracker</h2>
      <p>Click the link below to verify your email address:</p>
      <p><a href="${url}">Verify email</a></p>
      <p>If you didn't sign up, you can ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, url: string) {
  await getResend().emails.send({
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
