import { db, schema } from '@/db';
import { eq, and, asc, inArray, sql } from 'drizzle-orm';
import { ensureBenchmarkAssetExists } from './prices';

export interface HoldingSnapshot {
  assetId: number;
  symbol: string;
  displayTicker: string;
  name: string;
  category: string;
  platform: string;
  quantity: number;
  avgCostAud: number;
  totalCostAud: number;
  currentPriceAud: number;
  marketValueAud: number;
  profitLossAud: number;
  profitLossPct: number;
  cagr: number;
  merBps: number | null;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  profitLoss: number;
  returnPct: number;
  cagr: number;
  holdings: HoldingSnapshot[];
  categoryBreakdown: { category: string; value: number; pct: number }[];
  benchmarkReturnPct?: number;
  alpha?: number;
  benchmarkSymbol?: string;
}

export interface ClosedHolding {
  assetId: number;
  symbol: string;
  displayTicker: string;
  name: string;
  category: string;
  platform: string;
  totalBought: number;
  totalSold: number;
  totalCostAud: number;
  totalProceedsAud: number;
  realisedPL: number;
}

// Build a map from yahooSymbol → list of all asset IDs that share it (across all profiles).
// This lets us look up prices stored under any profile's asset ID. Prices are
// keyed by assetId but the asset rows themselves are profile-scoped, so reading
// every asset row to build this map does not leak data — only asset IDs and
// yahoo symbols, which are fed into price queries below.
async function buildYahooSymbolToAssetIds(): Promise<Map<string, number[]>> {
  const allAssets = await db.select({ id: schema.assets.id, yahooSymbol: schema.assets.yahooSymbol }).from(schema.assets);
  const map = new Map<string, number[]>();
  for (const a of allAssets) {
    const ids = map.get(a.yahooSymbol) || [];
    ids.push(a.id);
    map.set(a.yahooSymbol, ids);
  }
  return map;
}

// Batch the "latest price per yahooSymbol" lookup into a single query, replacing
// a per-asset N+1. For each yahooSymbol used by `assets`, returns the most recent
// priceAud across all sibling asset IDs that share the symbol — identical to
// running the old getLatestPriceForAsset (orderBy date desc, limit 1) per asset.
async function getLatestPriceByYahoo(
  assets: { yahooSymbol: string }[],
  yahooMap: Map<string, number[]>,
): Promise<Map<string, number>> {
  const relatedIds = new Set<number>();
  const idToYahoo = new Map<number, string>();
  for (const a of assets) {
    for (const id of yahooMap.get(a.yahooSymbol) || []) {
      relatedIds.add(id);
      idToYahoo.set(id, a.yahooSymbol);
    }
  }
  const latest = new Map<string, number>();
  if (relatedIds.size === 0) return latest;

  // Fetch only the newest price row per related asset (correlated MAX(date))
  // rather than the asset's whole price history — one row per asset. Ascending
  // order means the last write per yahooSymbol wins = latest date across siblings.
  const ids = [...relatedIds];
  const rows = await db.select({ assetId: schema.prices.assetId, date: schema.prices.date, priceAud: schema.prices.priceAud })
    .from(schema.prices)
    .where(and(
      inArray(schema.prices.assetId, ids),
      eq(schema.prices.date, sql`(select max(p2.date) from prices p2 where p2.asset_id = ${schema.prices.assetId})`),
    ))
    .orderBy(asc(schema.prices.date));
  for (const r of rows) {
    const ys = idToYahoo.get(r.assetId);
    if (ys !== undefined) latest.set(ys, r.priceAud);
  }
  return latest;
}

// Group a flat, date-ascending transaction list by assetId, preserving order.
function groupTxsByAsset<T extends { assetId: number }>(txs: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const t of txs) {
    const arr = map.get(t.assetId);
    if (arr) arr.push(t);
    else map.set(t.assetId, [t]);
  }
  return map;
}

export async function calculateHoldings(profileId?: number): Promise<HoldingSnapshot[]> {
  const assetFilter = profileId
    ? and(eq(schema.assets.isActive, true), eq(schema.assets.profileId, profileId))
    : eq(schema.assets.isActive, true);
  const allAssets = await db.select().from(schema.assets).where(assetFilter);
  if (allAssets.length === 0) return [];

  // Only load transactions for this profile's assets (was a full-table scan).
  const assetIds = allAssets.map(a => a.id);
  const scopedTransactions = await db.select().from(schema.transactions)
    .where(inArray(schema.transactions.assetId, assetIds))
    .orderBy(asc(schema.transactions.date));
  const txsByAsset = groupTxsByAsset(scopedTransactions);
  const yahooMap = await buildYahooSymbolToAssetIds();
  const latestPriceByYahoo = await getLatestPriceByYahoo(allAssets, yahooMap);

  const holdings: HoldingSnapshot[] = [];

  for (const asset of allAssets) {
    const txs = txsByAsset.get(asset.id);
    if (!txs || txs.length === 0) continue;

    let totalQty = 0;
    let totalCost = 0;

    for (const tx of txs) {
      if (tx.action === 'BUY') {
        totalCost += Math.abs(tx.totalAud);
        totalQty += tx.adjustedQty;
      } else if (tx.action === 'SELL') {
        const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
        const soldQty = Math.abs(tx.adjustedQty);
        totalCost -= avgCost * soldQty;
        totalQty -= soldQty;
      }
    }

    if (totalQty <= 0.0001) continue;

    const currentPrice = latestPriceByYahoo.get(asset.yahooSymbol) || 0;
    const marketValue = totalQty * currentPrice;
    const avgCost = totalCost / totalQty;

    // Per-holding CAGR based on first transaction date
    let holdingCagr = 0;
    const firstTxDate = txs[0]?.date;
    if (firstTxDate && totalCost > 0) {
      const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
      const years = Math.max(1 / 365.25, (Date.now() - new Date(firstTxDate).getTime()) / msPerYear);
      holdingCagr = (Math.pow(marketValue / totalCost, 1 / years) - 1) * 100;
    }

    holdings.push({
      assetId: asset.id,
      symbol: asset.symbol,
      displayTicker: asset.displayTicker,
      name: asset.name,
      category: asset.category,
      platform: [...new Set(txs.map(t => t.source).filter(Boolean))].join(', ') || asset.platform || '',
      quantity: totalQty,
      avgCostAud: avgCost,
      totalCostAud: totalCost,
      currentPriceAud: currentPrice,
      marketValueAud: marketValue,
      profitLossAud: marketValue - totalCost,
      profitLossPct: totalCost > 0 ? ((marketValue - totalCost) / totalCost) * 100 : 0,
      cagr: holdingCagr,
      merBps: asset.merBps ?? null,
    });
  }

  return holdings;
}

export async function calculateClosedHoldings(profileId?: number): Promise<ClosedHolding[]> {
  const assetFilter = profileId ? eq(schema.assets.profileId, profileId) : undefined;
  const allAssets = assetFilter
    ? await db.select().from(schema.assets).where(assetFilter)
    : await db.select().from(schema.assets);
  if (allAssets.length === 0) return [];

  const assetIds = allAssets.map(a => a.id);
  const scopedTransactions = await db.select().from(schema.transactions)
    .where(inArray(schema.transactions.assetId, assetIds))
    .orderBy(asc(schema.transactions.date));
  const txsByAsset = groupTxsByAsset(scopedTransactions);

  const closed: ClosedHolding[] = [];

  for (const asset of allAssets) {
    const txs = txsByAsset.get(asset.id);
    if (!txs || txs.length === 0) continue;

    let totalQty = 0;
    let totalCost = 0;
    let totalBought = 0;
    let totalSold = 0;
    let totalProceeds = 0;
    let totalSpent = 0;

    for (const tx of txs) {
      if (tx.action === 'BUY') {
        totalCost += Math.abs(tx.totalAud);
        totalQty += tx.adjustedQty;
        totalBought += tx.adjustedQty;
        totalSpent += Math.abs(tx.totalAud);
      } else if (tx.action === 'SELL') {
        const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
        const soldQty = Math.abs(tx.adjustedQty);
        totalCost -= avgCost * soldQty;
        totalQty -= soldQty;
        totalSold += soldQty;
        totalProceeds += Math.abs(tx.totalAud);
      }
    }

    if (totalQty > 0.0001) continue;
    if (totalSold === 0) continue;

    closed.push({
      assetId: asset.id,
      symbol: asset.symbol,
      displayTicker: asset.displayTicker,
      name: asset.name,
      category: asset.category,
      platform: [...new Set(txs.map(t => t.source).filter(Boolean))].join(', ') || asset.platform || '',
      totalBought,
      totalSold,
      totalCostAud: totalSpent,
      totalProceedsAud: totalProceeds,
      realisedPL: totalProceeds - totalSpent,
    });
  }

  return closed;
}

export async function calculatePortfolioSummary(profileId?: number): Promise<PortfolioSummary> {
  const holdings = await calculateHoldings(profileId);

  const totalValue = holdings.reduce((sum, h) => sum + h.marketValueAud, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCostAud, 0);
  const profitLoss = totalValue - totalCost;
  const returnPct = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

  // CAGR: get earliest transaction date. Only the single earliest row is needed
  // (was a full-table scan). For a profile, restrict to its holdings' assets;
  // otherwise the globally earliest transaction, matching the prior behaviour.
  const assetIds = holdings.map(h => h.assetId);
  let cagr = 0;
  if (assetIds.length > 0) {
    const firstTxRows = await db.select({ assetId: schema.transactions.assetId, date: schema.transactions.date })
      .from(schema.transactions)
      .where(profileId ? inArray(schema.transactions.assetId, assetIds) : undefined)
      .orderBy(asc(schema.transactions.date))
      .limit(1);
    const firstTx = firstTxRows[0];

    if (firstTx && totalCost > 0) {
      const startDate = new Date(firstTx.date);
      const now = new Date();
      const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
      const years = Math.max(1 / 365.25, (now.getTime() - startDate.getTime()) / msPerYear);
      cagr = (Math.pow(totalValue / totalCost, 1 / years) - 1) * 100;
    }
  }

  // Alpha / Benchmark Return
  let benchmarkReturnPct: number | undefined;
  let alpha: number | undefined;
  let benchmarkSymbol: string | undefined;
  if (profileId) {
    const profileRow = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).limit(1);
    benchmarkSymbol = profileRow[0]?.benchmarkSymbol || 'VAS.AX';
    const { history: benchmarkHistory, costBasis: benchmarkCost } = await getBenchmarkValueHistory(profileId);
    if (benchmarkHistory.length > 0 && benchmarkCost > 0) {
      const benchmarkFinalValue = benchmarkHistory[benchmarkHistory.length - 1].value;
      benchmarkReturnPct = ((benchmarkFinalValue - benchmarkCost) / benchmarkCost) * 100;
      alpha = returnPct - benchmarkReturnPct;
    }
  }

  const categoryMap = new Map<string, number>();
  for (const h of holdings) {
    categoryMap.set(h.category, (categoryMap.get(h.category) || 0) + h.marketValueAud);
  }
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, value]) => ({
      category,
      value,
      pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return { totalValue, totalCost, profitLoss, returnPct, cagr, holdings, categoryBreakdown, benchmarkReturnPct, alpha, benchmarkSymbol };
}

export async function getPortfolioValueHistory(profileId?: number): Promise<{ date: string; value: number; cost: number }[]> {
  // Include ALL assets for this profile (even inactive/closed) for accurate historical value
  const assetFilter = profileId ? eq(schema.assets.profileId, profileId) : undefined;
  const allAssets = assetFilter
    ? await db.select().from(schema.assets).where(assetFilter)
    : await db.select().from(schema.assets);
  if (allAssets.length === 0) return [];

  // Scope transactions to this profile's assets (was a full-table scan + filter).
  const assetIds = allAssets.map(a => a.id);
  const scopedTransactions = await db.select().from(schema.transactions)
    .where(inArray(schema.transactions.assetId, assetIds))
    .orderBy(asc(schema.transactions.date));
  const txsByAsset = groupTxsByAsset(scopedTransactions);

  // Build yahooSymbol → sibling asset IDs map for cross-profile price lookup
  const yahooMap = await buildYahooSymbolToAssetIds();

  // Collect all sibling asset IDs that share yahooSymbols with this profile's assets
  const allRelatedAssetIds = new Set<number>();
  for (const asset of allAssets) {
    const siblings = yahooMap.get(asset.yahooSymbol) || [];
    for (const id of siblings) allRelatedAssetIds.add(id);
  }

  // Load only prices for related assets (was a full-table scan + filter).
  const allPrices = allRelatedAssetIds.size === 0 ? [] : await db.select({
      assetId: schema.prices.assetId, date: schema.prices.date, priceAud: schema.prices.priceAud,
    })
    .from(schema.prices)
    .where(inArray(schema.prices.assetId, [...allRelatedAssetIds]))
    .orderBy(asc(schema.prices.date));

  // Build a map: yahooSymbol → date-ascending price entries (deduped by date)
  const pricesByYahoo = new Map<string, { date: string; priceAud: number }[]>();
  for (const asset of allAssets) {
    const siblings = yahooMap.get(asset.yahooSymbol) || [];
    if (!pricesByYahoo.has(asset.yahooSymbol)) {
      const prices = allPrices
        .filter(p => siblings.includes(p.assetId))
        .map(p => ({ date: p.date, priceAud: p.priceAud }));
      // Deduplicate by date (take latest entry per date)
      const byDate = new Map<string, number>();
      for (const p of prices) byDate.set(p.date, p.priceAud);
      pricesByYahoo.set(asset.yahooSymbol, Array.from(byDate.entries()).map(([date, priceAud]) => ({ date, priceAud })).sort((a, b) => a.date.localeCompare(b.date)));
    }
  }

  // Get all unique price dates
  const allDatesSet = new Set<string>();
  for (const prices of pricesByYahoo.values()) {
    for (const p of prices) allDatesSet.add(p.date);
  }
  const priceDates = Array.from(allDatesSet).sort();

  // Precompute, per asset, a cumulative (qty, cost) snapshot after each of its
  // transactions. Since both the snapshots and priceDates are date-ascending, a
  // forward-only pointer replaces re-folding every transaction for every date —
  // turning O(dates × assets × txs) into O(dates × assets + Σtxs). The
  // accumulation math is identical to the original fold.
  interface AssetCalc {
    asset: typeof allAssets[number];
    snaps: { date: string; qty: number; cost: number }[];
    prices: { date: string; priceAud: number }[];
    txPtr: number;   // index of the last snapshot whose date <= current date (-1 = none yet)
    pricePtr: number; // index of the last price whose date <= current date (-1 = none yet)
  }
  const calcs: AssetCalc[] = allAssets.map((asset) => {
    const txs = txsByAsset.get(asset.id) || [];
    const snaps: { date: string; qty: number; cost: number }[] = [];
    let qty = 0;
    let cost = 0;
    for (const tx of txs) {
      if (tx.action === 'BUY') {
        cost += Math.abs(tx.totalAud);
        qty += tx.adjustedQty;
      } else if (tx.action === 'SELL') {
        const avgCost = qty > 0 ? cost / qty : 0;
        const soldQty = Math.abs(tx.adjustedQty);
        cost -= avgCost * soldQty;
        qty -= soldQty;
      }
      snaps.push({ date: tx.date, qty, cost });
    }
    return { asset, snaps, prices: pricesByYahoo.get(asset.yahooSymbol) || [], txPtr: -1, pricePtr: -1 };
  });

  const history: { date: string; value: number; cost: number }[] = [];

  for (const date of priceDates) {
    let totalValue = 0;
    let totalCost = 0;

    for (const c of calcs) {
      // Advance the transaction pointer to the last snapshot on/before `date`.
      while (c.txPtr + 1 < c.snaps.length && c.snaps[c.txPtr + 1].date <= date) c.txPtr++;
      if (c.txPtr < 0) continue;
      const { qty, cost } = c.snaps[c.txPtr];
      if (qty <= 0.0001) continue;

      // Advance the price pointer to the latest price on/before `date`.
      while (c.pricePtr + 1 < c.prices.length && c.prices[c.pricePtr + 1].date <= date) c.pricePtr++;
      if (c.pricePtr >= 0) {
        totalValue += qty * c.prices[c.pricePtr].priceAud;
      }
      totalCost += cost;
    }

    if (totalValue > 0) {
      history.push({ date, value: totalValue, cost: totalCost });
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const lastDate = history[history.length - 1]?.date;
  if (lastDate && lastDate < today) {
    let totalValue = 0;
    let totalCost = 0;

    for (const c of calcs) {
      // Final cumulative snapshot = fold of ALL of this asset's transactions.
      const last = c.snaps[c.snaps.length - 1];
      if (!last) continue;
      const { qty, cost } = last;
      if (qty <= 0.0001) continue;

      const price = c.prices[c.prices.length - 1];
      if (price) {
        totalValue += qty * price.priceAud;
      }
      totalCost += cost;
    }

    if (totalValue > 0) {
      history.push({ date: today, value: totalValue, cost: totalCost });
    }
  }

  return history;
}

export async function getBenchmarkValueHistory(profileId: number): Promise<{
  history: { date: string; value: number }[];
  costBasis: number;
}> {
  const empty = { history: [], costBasis: 0 };
  const profileResult = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).limit(1);
  if (profileResult.length === 0) return empty;
  const benchmarkSymbol = profileResult[0].benchmarkSymbol || 'VAS.AX';

  // Find or create benchmark asset to ensure we have prices
  const benchmarkAssetId = await ensureBenchmarkAssetExists(benchmarkSymbol);

  // Get all transactions for this profile
  const assets = await db.select().from(schema.assets).where(eq(schema.assets.profileId, profileId));
  const assetIds = assets.map(a => a.id);
  if (assetIds.length === 0) return empty;

  const allTxs = await db.select().from(schema.transactions)
    .where(inArray(schema.transactions.assetId, assetIds))
    .orderBy(asc(schema.transactions.date));

  if (allTxs.length === 0) return empty;

  // Get historical prices for benchmark
  const prices = await db.select().from(schema.prices)
    .where(eq(schema.prices.assetId, benchmarkAssetId))
    .orderBy(asc(schema.prices.date));

  if (prices.length === 0) return empty;

  // Map each tx to the first price on or after its date (handles weekends/holidays).
  // Txs with no forward-matching price are skipped — and excluded from costBasis so
  // the return % stays consistent with the value series.
  const unitChangesByDate = new Map<string, number>();
  let costBasis = 0;
  for (const tx of allTxs) {
    if (tx.action !== 'BUY' && tx.action !== 'SELL') continue;
    const p = prices.find(pp => pp.date >= tx.date);
    if (!p) continue;
    const units = Math.abs(tx.totalAud) / p.priceAud;
    const delta = tx.action === 'BUY' ? units : -units;
    unitChangesByDate.set(p.date, (unitChangesByDate.get(p.date) || 0) + delta);
    costBasis += tx.action === 'BUY' ? Math.abs(tx.totalAud) : -Math.abs(tx.totalAud);
  }

  const history: { date: string; value: number }[] = [];
  let shadowUnits = 0;

  const firstApplied = [...unitChangesByDate.keys()].sort()[0];
  if (!firstApplied) return { history: [], costBasis };
  const filteredPrices = prices.filter(p => p.date >= firstApplied);

  for (const price of filteredPrices) {
    const delta = unitChangesByDate.get(price.date);
    if (delta) shadowUnits += delta;
    history.push({ date: price.date, value: shadowUnits * price.priceAud });
  }

  // Add today's value if not already in history
  const today = new Date().toISOString().split('T')[0];
  const lastHistory = history[history.length - 1];
  if (lastHistory && lastHistory.date < today) {
    history.push({ date: today, value: shadowUnits * filteredPrices[filteredPrices.length - 1].priceAud });
  }

  return { history, costBasis };
}
