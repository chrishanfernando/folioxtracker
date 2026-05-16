import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { calculateHoldings } from './calculations';
import { TIER_PROFILES, type RiskTier, type EtfRecommendation } from './risk-profiling';
import { fetchLivePriceAud } from './prices';

/**
 * Look up tier-recommended ETFs for a given profile, filtered by category.
 * Returns the ETFs the user should hold in that category according to their
 * saved risk tier, or [] if no risk profile is saved.
 */
async function tierEtfsForCategory(profileId: number | undefined, category: string): Promise<EtfRecommendation[]> {
  if (!profileId) return [];
  const rows = await db.select({ riskTier: schema.riskProfiles.riskTier })
    .from(schema.riskProfiles)
    .where(eq(schema.riskProfiles.profileId, profileId))
    .limit(1);
  if (rows.length === 0) return [];
  const tier = rows[0].riskTier as RiskTier;
  const profile = TIER_PROFILES[tier];
  if (!profile) return [];
  return profile.etfs.filter(e => e.category === category);
}

export interface CategoryAllocation {
  category: string;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  driftPct: number;
  threshold: number;
  needsRebalance: boolean;
}

export interface BuyRecommendation {
  category: string;
  amountToInvest: number;
  suggestedAssets: { displayTicker: string; symbol: string; amount: number; units: number; currentPrice: number }[];
}

export interface BuyRecommendationResult {
  recommendations: BuyRecommendation[];
  projectedAllocation: { category: string; currentPct: number; projectedPct: number; targetPct: number }[];
  totalInvested: number;
}

export async function calculateDrift(profileId?: number): Promise<CategoryAllocation[]> {
  const holdings = await calculateHoldings(profileId);
  const targetFilter = profileId ? eq(schema.categoryTargets.profileId, profileId) : undefined;
  const targets = targetFilter
    ? await db.select().from(schema.categoryTargets).where(targetFilter)
    : await db.select().from(schema.categoryTargets);

  const totalValue = holdings.reduce((sum, h) => sum + h.marketValueAud, 0);

  const categoryValues = new Map<string, number>();
  for (const h of holdings) {
    categoryValues.set(h.category, (categoryValues.get(h.category) || 0) + h.marketValueAud);
  }

  const allCategories = [...new Set([
    ...holdings.map(h => h.category),
    ...targets.map(t => t.category),
  ])];
  const targetMap = new Map(targets.map(t => [t.category, t]));

  return allCategories.map(category => {
    const target = targetMap.get(category);
    const currentValue = categoryValues.get(category) || 0;
    const currentPct = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    const targetPct = target?.targetPct ?? 0;
    const threshold = target?.threshold ?? 5;
    const driftPct = currentPct - targetPct;

    return {
      category,
      currentValue,
      currentPct,
      targetPct,
      driftPct,
      threshold,
      needsRebalance: targetPct > 0 && Math.abs(driftPct) > threshold,
    };
  });
}

export async function calculateBuyRecommendations(amountToInvest: number, profileId?: number): Promise<BuyRecommendationResult> {
  const drift = await calculateDrift(profileId);
  const holdings = await calculateHoldings(profileId);
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValueAud, 0);
  const newTotal = totalValue + amountToInvest;

  const underweight = drift.filter(d => d.targetPct > 0 && d.currentPct < d.targetPct);

  const recommendations: BuyRecommendation[] = [];
  let remaining = amountToInvest;
  const investPerCategory = new Map<string, number>();

  if (underweight.length > 0) {
    underweight.sort((a, b) => (a.currentPct - a.targetPct) - (b.currentPct - b.targetPct));

    for (const cat of underweight) {
      const targetValue = (cat.targetPct / 100) * newTotal;
      const needed = targetValue - cat.currentValue;
      const amount = Math.min(needed, remaining);
      if (amount <= 0) continue;

      remaining -= amount;
      investPerCategory.set(cat.category, amount);

      const categoryHoldings = holdings.filter(h => h.category === cat.category);
      let suggestedAssets: BuyRecommendation['suggestedAssets'];

      if (categoryHoldings.length > 0) {
        suggestedAssets = categoryHoldings.map(h => {
          const perAsset = amount / categoryHoldings.length;
          const price = h.currentPriceAud;
          return {
            displayTicker: h.displayTicker,
            symbol: h.symbol,
            amount: perAsset,
            currentPrice: price,
            units: price > 0 ? perAsset / price : 0,
          };
        });
      } else {
        // No existing holdings in this category — fall back to the ETFs the
        // user's risk tier recommends for this category. Split the per-category
        // amount proportionally to each ETF's portfolio weight, fetch live
        // prices on the fly so the buy recommender works for brand-new users.
        const tierEtfs = await tierEtfsForCategory(profileId, cat.category);
        if (tierEtfs.length === 0) {
          suggestedAssets = [];
        } else {
          const totalAllocInCategory = tierEtfs.reduce((s, e) => s + e.allocationPct, 0);
          suggestedAssets = await Promise.all(tierEtfs.map(async (etf) => {
            const ratio = totalAllocInCategory > 0 ? etf.allocationPct / totalAllocInCategory : 1 / tierEtfs.length;
            const perAsset = amount * ratio;
            const yahooSymbol = `${etf.ticker}.AX`;
            const price = await fetchLivePriceAud(yahooSymbol);
            return {
              displayTicker: etf.ticker,
              symbol: yahooSymbol,
              amount: perAsset,
              currentPrice: price,
              units: price > 0 ? perAsset / price : 0,
            };
          }));
        }
      }

      recommendations.push({
        category: cat.category,
        amountToInvest: amount,
        suggestedAssets,
      });

      if (remaining <= 0) break;
    }
  }

  const projectedAllocation = drift.map(d => {
    const addedAmount = investPerCategory.get(d.category) || 0;
    const projectedValue = d.currentValue + addedAmount;
    return {
      category: d.category,
      currentPct: d.currentPct,
      projectedPct: newTotal > 0 ? (projectedValue / newTotal) * 100 : 0,
      targetPct: d.targetPct,
    };
  });

  return {
    recommendations,
    projectedAllocation,
    totalInvested: amountToInvest - remaining,
  };
}
