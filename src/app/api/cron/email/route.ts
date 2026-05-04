import { NextRequest, NextResponse } from 'next/server';
import { pollCmcEmails } from '@/lib/email-poll';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await pollCmcEmails();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Email poll error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
