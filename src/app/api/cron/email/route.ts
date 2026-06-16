import { NextRequest, NextResponse } from 'next/server';
import { pollCmcEmails } from '@/lib/email-poll';
import { checkCronSecret } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  const denied = checkCronSecret(request);
  if (denied) return denied;

  try {
    const result = await pollCmcEmails();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Email poll error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
