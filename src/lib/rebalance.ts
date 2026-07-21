import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { calculateHoldings } from './calculations';

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
        // No existing holdings in this category — the recommender reports how much
        // to invest in the category but does not name specific products to buy.
        // (The app deliberately does not recommend specific ETFs for a user; browse
        // /portfolios for general example allocations.)
        suggestedAssets = [];
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
