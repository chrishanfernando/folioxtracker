import { Resend } from 'resend';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendRebalanceAlert(
  to: string,
  drifts: { category: string; currentPct: number; targetPct: number; driftPct: number }[]
) {
  const driftRows = drifts
    .map(d => `<tr><td>${d.category}</td><td>${d.currentPct.toFixed(1)}%</td><td>${d.targetPct.toFixed(1)}%</td><td style="color: ${Math.abs(d.driftPct) > 5 ? 'red' : 'inherit'}">${d.driftPct > 0 ? '+' : ''}${d.driftPct.toFixed(1)}%</td></tr>`)
    .join('');

  await getResend().emails.send({
    from: 'Portfolio Tracker <portfolio@resend.dev>',
    to,
    subject: 'Portfolio Rebalance Alert',
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
