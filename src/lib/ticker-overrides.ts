// Profile-scoped ticker resolution that layers user-supplied DB overrides on top
// of the built-in code seed maps in ticker-map.ts. An override wins over the
// seed map so an unmapped import ticker can be resolved from the UI without a
// redeploy (see openspec/changes/import-ticker-mapping).
import { db, schema } from '@/db';
import { and, eq } from 'drizzle-orm';
import { ASSET_MAP, INACTIVE_ASSETS, AssetInfo, resolveStakeTicker } from './ticker-map';

export type ImportSource = 'stake' | 'cmc' | 'swyftx' | 'ir' | 'excel';

export interface ResolvedAsset {
  symbol: string;
  // Metadata to create the asset if it does not yet exist for the profile.
  // Undefined when the ticker resolved to a symbol by convention alone (e.g. an
  // ASX suffix) with no seed/override metadata — the caller may still match an
  // existing DB asset by symbol.
  info?: AssetInfo;
}

/**
 * Look up a profile-scoped DB override for a broker's source ticker. Returns the
 * canonical asset metadata, or null when no override exists.
 */
export async function resolveOverride(
  source: ImportSource,
  sourceTicker: string,
  profileId: number,
): Promise<AssetInfo | null> {
  const rows = await db
    .select()
    .from(schema.tickerOverrides)
    .where(and(
      eq(schema.tickerOverrides.profileId, profileId),
      eq(schema.tickerOverrides.source, source),
      eq(schema.tickerOverrides.sourceTicker, sourceTicker),
    ))
    .limit(1);
  if (rows.length === 0) return null;
  const o = rows[0];
  return {
    symbol: o.symbol,
    name: o.name,
    displayTicker: o.displayTicker,
    yahooSymbol: o.yahooSymbol,
    category: o.category,
    platform: 'Stake',
  };
}

/**
 * Resolve a broker source ticker to a canonical asset symbol (+ optional
 * metadata), consulting the profile's DB overrides first and the code seed maps
 * second. Returns null when neither resolves it — the caller surfaces the row as
 * unmapped rather than dropping it.
 *
 * Only the Stake source is wired to the seed map here; the override lookup is
 * source-agnostic so CMC/Swyftx/IR can adopt this seam without another rewrite.
 */
export async function resolveAssetSymbol(
  source: ImportSource,
  sourceTicker: string,
  profileId: number,
): Promise<ResolvedAsset | null> {
  const override = await resolveOverride(source, sourceTicker, profileId);
  if (override) return { symbol: override.symbol, info: override };

  const seedSymbol = seedResolve(source, sourceTicker);
  if (!seedSymbol) return null;

  const info = ASSET_MAP[seedSymbol] ?? INACTIVE_ASSETS[seedSymbol];
  return { symbol: seedSymbol, info };
}

function seedResolve(source: ImportSource, sourceTicker: string): string | null {
  switch (source) {
    case 'stake':
      return resolveStakeTicker(sourceTicker);
    default:
      // Other sources keep their existing in-route resolution for now; this
      // seam exists so they can migrate to override-first resolution later.
      return null;
  }
}
