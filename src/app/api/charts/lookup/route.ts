import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { requireUser } from '@/lib/auth-helpers';

const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });
const FX_SYMBOL = 'AUDUSD=X';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  }

  try {
    const isAud = symbol.endsWith('.AX') || symbol.endsWith('-AUD');

    const result = await yf.chart(symbol, {
      period1: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      interval: '1wk',
    });

    let fxRates: Map<string, number> | null = null;
    if (!isAud) {
      try {
        const fxResult = await yf.chart(FX_SYMBOL, {
          period1: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          interval: '1wk',
        });
        fxRates = new Map(
          fxResult.quotes
            .filter(r => r.date && r.close != null)
            .map(r => [r.date!.toISOString().split('T')[0], r.close!])
        );
      } catch {}
    }

    const priceHistory = result.quotes
      .filter(r => r.date && r.close != null)
      .map(r => {
        const date = r.date!.toISOString().split('T')[0];
        const price = r.close!;
        if (isAud) {
          return { date, priceAud: price };
        }
        const fx = fxRates?.get(date) || 0.65;
        return { date, priceAud: price / fx };
      });

    // Get the display name
    const quote = await yf.quote(symbol);
    const name = quote.shortName || quote.longName || symbol;

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      name,
      priceHistory,
    });
  } catch (error) {
    console.error('Chart lookup error:', error);
    return NextResponse.json({ error: `Could not find "${symbol}"` }, { status: 404 });
  }
}
