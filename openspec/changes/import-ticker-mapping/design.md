## Context

Ticker resolution is currently a two-step, code-only lookup in
`src/lib/ticker-map.ts`: a source resolver (`resolveStakeTicker`,
`resolveCmcTicker`, …) maps a broker ticker to a canonical symbol, then the
import route reads `ASSET_MAP`/`INACTIVE_ASSETS` to get asset metadata. Both
maps ship empty in the repo (users populate them), so every unmapped ticker
requires a code edit + Vercel redeploy to import. Recent work made the Stake
importer *surface* unmapped tickers in the preview instead of silently dropping
them, which is the natural insertion point for a self-service mapping flow.

Constraints: strict user→profile tenancy (`resolveProfileId`, ownership helpers
return 404 not 403); AUD storage with FX context preserved; Yahoo Finance
(`yahoo-finance2`, wrapped by `src/lib/prices.ts`) is the price provider; SQLite
via Drizzle with migrations run during the `main` deploy build.

## Goals / Non-Goals

**Goals:**
- Let a user resolve an unrecognised import ticker from the import preview and
  have it persist, so future imports of that ticker resolve automatically with
  no code change or redeploy.
- Store overrides per user and per profile in the DB; DB overrides win over the
  code seed maps.
- Validate the user-supplied Yahoo symbol live before saving, so a mapping can
  never persist a symbol that will fail price fetches.
- Decouple ticker→symbol resolution from asset lookup so a resolved symbol that
  already exists as a DB asset imports even without an `ASSET_MAP` entry.

**Non-Goals:**
- Retrofitting the in-UI flow onto CMC/Swyftx/IR importers in this change. The
  override store and resolver are built source-agnostic, but only Stake wires
  up the UI here; the others follow later.
- Auto-guessing exchange/category by convention (e.g. bare US ticker →
  `NASDAQ:*`). Explicitly rejected below — the user confirms the mapping.
- Editing/importing arbitrary Yahoo symbols not tied to an import row (the
  existing manual "Add asset" flow already covers ad-hoc asset creation).
- A global/shared ticker dictionary across users.

## Decisions

### 1. New `ticker_overrides` table, keyed by (userId, profileId, source, sourceTicker)
A user-owned, profile-scoped row storing the resolution plus the asset metadata
needed to create the asset if it does not yet exist:
`userId`, `profileId`, `source` (`'stake' | 'cmc' | 'swyftx' | 'ir' | 'excel'`),
`sourceTicker`, `symbol`, `name`, `displayTicker`, `yahooSymbol`, `category`,
`createdAt`. Unique index on `(profileId, source, sourceTicker)`.

- **Why profile-scoped, not just user-scoped:** assets are profile-scoped, and
  the same user may classify a ticker differently per profile. Keying on profile
  matches how assets, transactions, and `category_targets` are already scoped.
  `userId` is stored too for ownership checks and cascade cleanup.
- **Why store asset metadata on the override, not just an asset FK:** at map
  time the asset may not exist yet (first import). Storing the metadata lets the
  importer create the asset on confirm using the same seed shape as `ASSET_MAP`.
  If the asset already exists (matched by symbol) the metadata is ignored except
  for backfill.
- **Alternative rejected — FK to `assets.id`:** would force asset creation
  before mapping and break the "map during preview, create on confirm" flow;
  also fragile if the asset is later deleted.

### 2. Resolver precedence: DB override → code seed map → unmapped
`resolveStakeTicker` (and siblings) gain an async DB-override lookup that runs
first, scoped to the active profile. Miss → fall through to the existing code
map. Miss again → unmapped (surfaced, not dropped).

- Resolvers become **async** and take a `profileId` (they are only called
  server-side inside the import routes, so this is contained).
- **Why DB-first:** lets a user correct a wrong or absent seed mapping without a
  deploy; the seed map is a starting default, the override is the source of
  truth.

### 3. Decouple resolution from asset lookup
Restructure the Stake route to: (a) resolve every row's `sourceTicker → symbol`
(override then seed); (b) for each distinct resolved symbol, look up the asset in
the DB by `(symbol, profileId)`; if found use it; if not, create it from override
metadata *or* seed `ASSET_MAP` metadata. A symbol with neither an existing asset
nor any metadata source is the only "cannot import" case.

- **Why:** fixes the current bug where a resolved symbol absent from `ASSET_MAP`
  is skipped even though the asset already exists in the DB. Asset identity is
  the DB row keyed by `(symbol, profileId)`, not the code map.

### 4. Live Yahoo validation before save
The save-override endpoint calls `fetchLivePriceAud(yahooSymbol)` (already in
`src/lib/prices.ts`). A throw / no quote → `400` with a clear message; the
override is not persisted. On success the override is written and the row
re-resolves.

- **Why validate:** an unvalidated Yahoo symbol persists silently and only
  reveals itself later as missing prices in a finance app — exactly the class of
  silent failure this change is trying to remove.
- **Alternative rejected — validate on a cron/price run instead:** too late; the
  user has moved on and the bad mapping is already saved.

### 5. UI: inline mapping on the unmapped preview row, then re-resolve
Each `unknown`-status preview row gets a "Map ticker" control opening a small
form (symbol, category, Yahoo symbol with a "Verify" action hitting the validate
endpoint). On successful save the client re-requests the preview (re-posts the
file with `preview=true`); the now-resolved row moves to `new`/`duplicate`.

- **Why re-request the preview rather than mutate client state:** resolution,
  dedup, and asset matching all live server-side; re-running the preview keeps
  one source of truth and avoids divergence.

## Risks / Trade-offs

- **Wrong exchange namespace still creates a duplicate asset.** If a user maps a
  ticker to `NASDAQ:BRK.B` while an existing asset is `NYSE:BRK.B`, they get two
  assets. → Mitigation: the map form pre-fills a suggested symbol and surfaces
  any existing DB asset whose `yahooSymbol` matches, so the user can pick the
  existing one instead of minting a duplicate.
- **Resolvers becoming async** touches every import route's call site. →
  Mitigation: change is mechanical and covered by the modified `import` spec;
  only Stake is fully rewired here, others keep working via the seed map with an
  async wrapper.
- **Yahoo validation adds a network call to the save path** and depends on an
  external service. → Mitigation: single `quote` call with the existing timeout
  handling in `prices.ts`; a validation timeout returns `503`/`400` and the user
  can retry — no partial state is written.
- **Migration runs on the production deploy.** New table only, no backfill, no
  changes to existing tables → low risk; rollback is Instant Rollback on Vercel
  (the added table is inert to older code).

## Migration Plan

1. Add `tickerOverrides` to `src/db/schema.ts`; `npx drizzle-kit generate`.
2. Land resolver + route rework behind the existing seed-map behaviour (seed map
   still resolves when no override exists, so nothing regresses pre-UI).
3. Ship the validate + save-override endpoints and the import-UI control.
4. Deploy to `main` → migration creates `ticker_overrides` on the production
   Turso DB during build. Rollback via Vercel Instant Rollback if needed; the
   orphan table is harmless to the prior build.

## Open Questions

- Should a saved override optionally **backfill** an existing asset's
  `category`/`name` when they differ, or always leave existing assets untouched?
  (Leaning: leave untouched; only use metadata on asset creation.)
- Do we expose a management screen to view/delete overrides now, or defer until
  CMC/Swyftx/IR are wired in? (Leaning: defer; deletion via a follow-up.)
