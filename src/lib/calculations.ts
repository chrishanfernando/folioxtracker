import { db, schema } from '@/db';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';

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
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  profitLoss: number;
  returnPct: number;
  cagr: number;
  holdings: HoldingSnapshot[];
  categoryBreakdown: { category: string; value: number; pct: number }[];
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

// Get latest price for an asset, falling back to sibling asset IDs with the same yahooSymbol
async function getLatestPriceForAsset(
  assetId: number,
  yahooSymbol: string,
  yahooMap: Map<string, number[]>,
): Promise<number> {
  // Look up latest price across all sibling assets with same yahooSymbol
  const allIds = yahooMap.get(yahooSymbol) || [assetId];

  const result = await db.select()
    .from(schema.prices)
    .where(inArray(schema.prices.assetId, allIds))
    .orderBy(desc(schema.prices.date))
    .limit(1);
  return result[0]?.priceAud || 0;
}

export async function calculateHoldings(profileId?: number): Promise<HoldingSnapshot[]> {
  const assetFilter = profileId
    ? and(eq(schema.assets.isActive, true), eq(schema.assets.profileId, profileId))
    : eq(schema.assets.isActive, true);
  const allAssets = await db.select().from(schema.assets).where(assetFilter);
  const allTransactions = await db.select().from(schema.transactions).orderBy(asc(schema.transactions.date));
  const yahooMap = await buildYahooSymbolToAssetIds();

  const holdings: HoldingSnapshot[] = [];

  for (const asset of allAssets) {
    const txs = allTransactions.filter(t => t.assetId === asset.id);
    if (txs.length === 0) continue;

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

    const currentPrice = await getLatestPriceForAsset(asset.id, asset.yahooSymbol, yahooMap);
    const marketValue = totalQty * currentPrice;
    const avgCost = totalCost / totalQty;

    // Per-holding CAGR based on first transaction date
    let holdingCagr = 0;
    const firstTxDate = txs[0]?.date;
    if (firstTxDate && totalCost > 0) {
      const years = (Date.now() - new Date(firstTxDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (years > 0) {
        holdingCagr = (Math.pow(marketValue / totalCost, 1 / years) - 1) * 100;
      }
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
    });
  }

  return holdings;
}

export async function calculateClosedHoldings(profileId?: number): Promise<ClosedHolding[]> {
  const assetFilter = profileId ? eq(schema.assets.profileId, profileId) : undefined;
  const allAssets = assetFilter
    ? await db.select().from(schema.assets).where(assetFilter)
    : await db.select().from(schema.assets);
  const allTransactions = await db.select().from(schema.transactions).orderBy(asc(schema.transactions.date));

  const closed: ClosedHolding[] = [];

  for (const asset of allAssets) {
    const txs = allTransactions.filter(t => t.assetId === asset.id);
    if (txs.length === 0) continue;

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

  // CAGR: get earliest transaction date for this profile's assets
  const assetIds = holdings.map(h => h.assetId);
  let cagr = 0;
  if (assetIds.length > 0) {
    const allTxs = await db.select().from(schema.transactions).orderBy(asc(schema.transactions.date));
    const firstTx = profileId
      ? allTxs.find(t => holdings.some(h => h.assetId === t.assetId))
      : allTxs[0];

    if (firstTx && totalCost > 0) {
      const startDate = new Date(firstTx.date);
      const now = new Date();
      const years = (now.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (years > 0) {
        cagr = (Math.pow(totalValue / totalCost, 1 / years) - 1) * 100;
      }
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

  return { totalValue, totalCost, profitLoss, returnPct, cagr, holdings, categoryBreakdown };
}

export async function getPortfolioValueHistory(profileId?: number): Promise<{ date: string; value: number; cost: number }[]> {
  // Include ALL assets for this profile (even inactive/closed) for accurate historical value
  const assetFilter = profileId ? eq(schema.assets.profileId, profileId) : undefined;
  const allAssets = assetFilter
    ? await db.select().from(schema.assets).where(assetFilter)
    : await db.select().from(schema.assets);
  const assetIds = new Set(allAssets.map(a => a.id));
  const allTransactions = (await db.select().from(schema.transactions).orderBy(asc(schema.transactions.date)))
    .filter(t => assetIds.has(t.assetId));

  // Build yahooSymbol → sibling asset IDs map for cross-profile price lookup
  const yahooMap = await buildYahooSymbolToAssetIds();

  // Collect all sibling asset IDs that share yahooSymbols with this profile's assets
  const allRelatedAssetIds = new Set<number>();
  for (const asset of allAssets) {
    const siblings = yahooMap.get(asset.yahooSymbol) || [];
    for (const id of siblings) allRelatedAssetIds.add(id);
  }

  // Load all prices for related assets
  const allPrices = (await db.select().from(schema.prices).orderBy(asc(schema.prices.date)))
    .filter(p => allRelatedAssetIds.has(p.assetId));

  // Build a map: yahooSymbol → sorted price entries
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

  const history: { date: string; value: number; cost: number }[] = [];

  for (const date of priceDates) {
    let totalValue = 0;
    let totalCost = 0;

    for (const asset of allAssets) {
      const txs = allTransactions.filter(t => t.assetId === asset.id && t.date <= date);
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
      }

      if (qty <= 0.0001) continue;

      const prices = pricesByYahoo.get(asset.yahooSymbol) || [];
      const price = prices.filter(p => p.date <= date).pop();

      if (price) {
        totalValue += qty * price.priceAud;
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

    for (const asset of allAssets) {
      const txs = allTransactions.filter(t => t.assetId === asset.id);
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
      }

      if (qty <= 0.0001) continue;

      const prices = pricesByYahoo.get(asset.yahooSymbol) || [];
      const price = prices[prices.length - 1];

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
