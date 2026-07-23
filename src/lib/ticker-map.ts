// Asset registry and source-specific ticker resolvers used by the importers.
//
// This file ships empty. Populate it with the assets and broker-specific
// mappings you actually use. The importers call these maps to translate
// source CSV/email tickers (e.g. "BHP" from CMC, "AAPL" from Stake, "BTC"
// from Swyftx/IR) into canonical internal asset symbols.
//
// Conventions used by the canonical symbol keys:
//   - ASX equities/ETFs:   "ASX:<TICKER>"            e.g. "ASX:VAS"
//   - NASDAQ/NYSE:         "NASDAQ:<TICKER>" / "NYSE:<TICKER>"
//   - OTC pink sheets:     "OTCMKTS:<TICKER>"
//   - Crypto (AUD pair):   "CURRENCY:<COIN>AUD"      e.g. "CURRENCY:BTCAUD"
//   - Gold / commodities:  free-form (e.g. "GOLD")
//
// Yahoo symbols are what we pass to `yahoo-finance2`. ASX uses the ".AX"
// suffix; crypto uses "<COIN>-AUD"; gold futures use "GC=F".

export interface AssetInfo {
  symbol: string;
  name: string;
  displayTicker: string;
  yahooSymbol: string;
  category: string;
  platform: string;
}

// Active assets. Imports for symbols listed here mark the asset `is_active = true`.
export const ASSET_MAP: Record<string, AssetInfo> = {
  'ASX:IOO': {
    symbol: 'ASX:IOO',
    name: 'iShares Global 100 ETF',
    displayTicker: 'IOO',
    yahooSymbol: 'IOO.AX',
    category: 'Intl Equities',
    platform: 'Stake',
  },
  'OTCMKTS:TCEHY': {
    symbol: 'OTCMKTS:TCEHY',
    name: 'Tencent Holdings Ltd (ADR)',
    displayTicker: 'TCEHY',
    yahooSymbol: 'TCEHY',
    category: 'Emerging Markets',
    platform: 'Stake',
  },
};

// Assets that previously appeared in your records but are now closed/delisted.
// Imports for symbols listed here still resolve, but the asset is created with
// `is_active = false`. Keep them out of `ASSET_MAP` to avoid daily price fetches.
export const INACTIVE_ASSETS: Record<string, AssetInfo> = {};

// --- Stake ---------------------------------------------------------------
// Stake uses ".ASX" suffixes for ASX tickers (auto-resolved below) and bare
// US tickers that need explicit mapping to NASDAQ/NYSE/OTCMKTS.
export const STAKE_US_TICKER_MAP: Record<string, string> = {
  'TCEHY': 'OTCMKTS:TCEHY',
};

export function resolveStakeTicker(stakeTicker: string): string | null {
  if (stakeTicker.endsWith('.ASX')) {
    return 'ASX:' + stakeTicker.replace('.ASX', '');
  }
  return STAKE_US_TICKER_MAP[stakeTicker] || null;
}

// --- Swyftx --------------------------------------------------------------
// Swyftx exports use bare coin codes (e.g. "BTC", "ETH").
export const SWYFTX_TICKER_MAP: Record<string, string> = {};

// --- Independent Reserve -------------------------------------------------
// IR uses bare coin codes (e.g. "BTC", "ETH", "XRP").
export const IR_TICKER_MAP: Record<string, string> = {};

// --- CMC Markets ---------------------------------------------------------
// CMC CSV/email tickers come in a few shapes:
//   - Bare ASX:        "VAS"          → "ASX:VAS"            (auto-resolved)
//   - US with suffix:  "AAPL:US"      → "NASDAQ:AAPL"        (auto-resolved)
//   - Slashed US:      "BRK/B:US"     → "NYSE:BRK.B"         (mapping needed)
//   - Aliases:         "GOLD"         → "GOLD"               (mapping needed)
// Add explicit overrides here; everything else falls through to the
// convention-based resolver below.
export const CMC_TICKER_MAP: Record<string, string> = {};

// Auto-resolve unmapped CMC tickers by convention:
//   - No colon         → ASX (e.g. "VGS"      → "ASX:VGS")
//   - ":US" suffix     → assume NASDAQ; "/" → "." (e.g. "MSFT:US" → "NASDAQ:MSFT")
// Returns null if it can't resolve; the importer will surface the row as an error.
export function resolveCmcTicker(cmcTicker: string): string | null {
  if (cmcTicker.includes(':')) {
    const [base, exchange] = cmcTicker.split(':');
    if (exchange === 'US') {
      const symbol = base.replace(/\//g, '.');
      return `NASDAQ:${symbol}`;
    }
    return null;
  }
  // Plain ticker without colon → ASX
  return `ASX:${cmcTicker}`;
}
