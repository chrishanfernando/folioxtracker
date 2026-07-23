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
    category: 'World',
    platform: 'Stake',
  },
  'OTCMKTS:TCEHY': {
    symbol: 'OTCMKTS:TCEHY',
    name: 'Tencent Holdings Ltd (ADR)',
    displayTicker: 'TCEHY',
    yahooSymbol: 'TCEHY',
    category: 'China',
    platform: 'Stake',
  },
  'NYSE:BRK.B': {
    symbol: 'NYSE:BRK.B',
    name: 'Berkshire Hathaway Inc. Class B',
    displayTicker: 'BRK.B',
    yahooSymbol: 'BRK-B',
    category: 'USA',
    platform: 'Stake',
  },
  'NASDAQ:AAPL': {
    symbol: 'NASDAQ:AAPL',
    name: 'Apple Inc.',
    displayTicker: 'AAPL',
    yahooSymbol: 'AAPL',
    category: 'USA',
    platform: 'Stake',
  },
  'NASDAQ:GOOG': {
    symbol: 'NASDAQ:GOOG',
    name: 'Alphabet Inc. (Class C)',
    displayTicker: 'GOOG',
    yahooSymbol: 'GOOG',
    category: 'USA',
    platform: 'Stake',
  },
  'NASDAQ:GOOGL': {
    symbol: 'NASDAQ:GOOGL',
    name: 'Alphabet Inc.',
    displayTicker: 'GOOGL',
    yahooSymbol: 'GOOGL',
    category: 'USA',
    platform: 'Stake',
  },
  'NASDAQ:BIDU': {
    symbol: 'NASDAQ:BIDU',
    name: 'Baidu Inc.',
    displayTicker: 'BIDU',
    yahooSymbol: 'BIDU',
    category: 'China',
    platform: 'Stake',
  },
  'NYSE:BABA': {
    symbol: 'NYSE:BABA',
    name: 'Alibaba Group',
    displayTicker: 'BABA',
    yahooSymbol: 'BABA',
    category: 'China',
    platform: 'Stake',
  'CURRENCY:BTCAUD': {
    symbol: 'CURRENCY:BTCAUD',
    name: 'Bitcoin',
    displayTicker: 'BTC',
    yahooSymbol: 'BTC-AUD',
    category: 'Crypto',
    platform: 'Swyftx',
  },
  'CURRENCY:ETHAUD': {
    symbol: 'CURRENCY:ETHAUD',
    name: 'Ethereum',
    displayTicker: 'ETH',
    yahooSymbol: 'ETH-AUD',
    category: 'Crypto',
    platform: 'Swyftx',
  },
  'CURRENCY:MANAAUD': {
    symbol: 'CURRENCY:MANAAUD',
    name: 'Decentraland',
    displayTicker: 'MANA',
    yahooSymbol: 'MANA-AUD',
    category: 'Crypto',
    platform: 'Swyftx',
  },
  'CURRENCY:POLAUD': {
    symbol: 'CURRENCY:POLAUD',
    name: 'Polygon Ecosystem Token',
    displayTicker: 'POL',
    yahooSymbol: 'POL-AUD',
    category: 'Crypto',
    platform: 'Swyftx',
  },
  'CURRENCY:USDCAUD': {
    symbol: 'CURRENCY:USDCAUD',
    name: 'USD Coin',
    displayTicker: 'USDC',
    yahooSymbol: 'USDC-AUD',
    category: 'Crypto',
    platform: 'Swyftx',
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
  'AAPL': 'NASDAQ:AAPL',
  'GOOG': 'NASDAQ:GOOG',
  'GOOGL': 'NASDAQ:GOOGL',
  'BIDU': 'NASDAQ:BIDU',
  'BABA': 'NYSE:BABA',
  'BRK.B': 'NYSE:BRK.B',
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
export const SWYFTX_TICKER_MAP: Record<string, string> = {
  'BTC': 'CURRENCY:BTCAUD',
  'ETH': 'CURRENCY:ETHAUD',
  'MANA': 'CURRENCY:MANAAUD',
  'POL': 'CURRENCY:POLAUD',
  'USDC': 'CURRENCY:USDCAUD',
};

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
