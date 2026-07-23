## Why

Today, resolving a broker ticker to an internal asset lives in **code**
(`src/lib/ticker-map.ts`). Any ticker the maps don't know is skipped on import,
and the only way to make it importable is a code edit plus a redeploy. That is
workable while the operator is the only importer, but it does not scale to other
users, who will routinely hit tickers no one has hand-mapped — leaving them
unable to import their own holdings without developer intervention.

## What Changes

- Add a **per-user, per-profile ticker-overrides** store in the database. An
  override maps a `(source, sourceTicker)` pair to a canonical asset
  (`symbol`, `name`, `displayTicker`, `yahooSymbol`, `category`). DB overrides
  take precedence over the code maps; the code maps (`ASSET_MAP`,
  `STAKE_US_TICKER_MAP`, etc.) become **seed defaults** only.
- Add an **in-UI "map this ticker" flow** on the import preview. When a row is
  surfaced as unmapped, the user resolves it inline: enter the canonical
  exchange-namespaced symbol + category, and **confirm the Yahoo symbol,
  validated live against the price provider before the override is saved**. On
  save the override persists and the row resolves for the rest of that import
  and all future imports — no redeploy.
- **Decouple ticker resolution from asset lookup** in the importers (starting
  with Stake, structured to be reused by CMC/Swyftx/IR). The resolver maps
  `ticker → canonical symbol`; asset lookup/creation then runs against the DB by
  symbol. A resolved symbol that already exists as an asset in the DB imports
  even when it is **absent from `ASSET_MAP`** (today the Stake route skips it).
- Preserve existing behaviour: two-phase preview/confirm UX, strict
  user→profile tenancy, and unresolved tickers with no override still surfaced
  as **unmapped** (not silently dropped).

## Capabilities

### New Capabilities
- `ticker-mapping`: user-owned, profile-scoped overrides that map a broker's
  source ticker to a canonical asset, with live Yahoo-symbol validation and
  precedence over the built-in code maps.

### Modified Capabilities
- `import`: ticker resolution now consults DB overrides before the code maps;
  importers match assets that already exist in the DB by canonical symbol even
  without an `ASSET_MAP` entry; the preview lets users resolve unmapped tickers
  inline and re-resolve without re-uploading.

## Impact

- **DB migration**: new `ticker_overrides` table (Drizzle schema +
  `drizzle-kit generate`); runs against production Turso on the next `main`
  deploy. No changes to existing tables.
- **Code**: `src/lib/ticker-map.ts` (resolvers gain a DB-override lookup),
  `src/lib/import-parser.ts` and `src/app/api/import/stake/route.ts` (resolve
  vs. asset-lookup decoupling), a new resolve API route + a
  `POST /api/import/ticker-override` (or similar) endpoint with live Yahoo
  validation via `fetchLivePriceAud`, and the import UI
  (`src/app/(authed)/import/page.tsx`) unmapped-row mapping control.
- **APIs**: new endpoint(s) for creating/validating overrides; import preview
  response gains per-unmapped-row affordances. No breaking changes to existing
  import request/response contracts.
- **No new env vars or dependencies** (reuses `yahoo-finance2` already wired in
  `src/lib/prices.ts`).
- Affected specs: new `ticker-mapping`, modified `import`.
