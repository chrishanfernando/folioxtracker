## 1. Schema & migration

- [x] 1.1 Add `tickerOverrides` table to `src/db/schema.ts` (`id`, `userId` → user cascade, `profileId` → profiles, `source`, `sourceTicker`, `symbol`, `name`, `displayTicker`, `yahooSymbol`, `category`, `createdAt`) with a unique index on `(profileId, source, sourceTicker)`.
- [x] 1.2 `npx drizzle-kit generate` and review the generated migration; verify a CI-style build applies it (`TURSO_DATABASE_URL="file:/tmp/check.db" npm run build`).
- [x] 1.3 Add `tickerOverrides` cascade cleanup to `user.deleteUser.beforeDelete` in `src/lib/auth.ts` (the manual profile-data cascade).

## 2. Override resolution layer

- [x] 2.1 Add a `resolveOverride(source, sourceTicker, profileId)` helper (new `src/lib/ticker-overrides.ts`) that reads the DB override for the active profile and returns the canonical `AssetInfo` or null.
- [x] 2.2 Make the Stake resolver DB-first: resolve override → seed map → null. Thread `profileId` through; keep the function usable server-side only.
- [x] 2.3 Add a source-agnostic `resolveAssetSymbol(source, ticker, profileId)` seam so CMC/Swyftx/IR can adopt it later without another rewrite.

## 3. Decouple resolution from asset lookup (Stake route)

- [x] 3.1 Rework `src/app/api/import/stake/route.ts`: resolve every row to a canonical symbol, then look up assets by `(symbol, profileId)` in the DB.
- [x] 3.2 Use an existing DB asset when present even if the symbol is absent from `ASSET_MAP`; otherwise create the asset from override metadata or seed `ASSET_MAP` metadata (seed `merBps` via `lookupMerBps`).
- [x] 3.3 Keep unresolved rows surfaced as `unknown` (preserve the existing `unknown[]` preview behaviour) and report skipped unknown tickers on confirm.

## 4. Validate + save-override API

- [x] 4.1 Add `POST /api/import/ticker-override/validate` (or a `validate=true` mode) that calls `fetchLivePriceAud(yahooSymbol)`; return `200` with the quote on success, `400` naming the symbol on failure. Follow the route pattern (`requireUser` → `resolveProfileId` → `parseJsonBody` with a `.strict()` Zod schema → `apiError`).
- [x] 4.2 Add `POST /api/import/ticker-override` that re-validates the Yahoo symbol server-side, then upserts the override scoped to the owned profile; 404 on non-owned profile.
- [x] 4.3 Add a Zod schema on `validation/primitives` (`source` enum, `sanitizedString` fields, canonical `symbol`, `category`).

## 5. Import UI — inline mapping

- [x] 5.1 In `src/app/(authed)/import/page.tsx`, add a "Map ticker" control to each `unknown` preview row (symbol, category, Yahoo symbol + "Verify" hitting the validate endpoint).
- [x] 5.2 On successful save, re-run the preview (re-post the file with `preview=true` via `profileFetch`) so the row re-resolves; keep loading/error/empty states.
- [x] 5.3 Pre-fill a suggested symbol and surface any existing DB asset whose `yahooSymbol` matches, so the user can reuse it instead of minting a duplicate asset.

## 6. Verification

- [x] 6.1 `npx tsc --noEmit` clean.
- [x] 6.2 CI-style build with migration: `TURSO_DATABASE_URL="file:/tmp/check.db" npm run build`.
- [ ] 6.3 Manual smoke: import a Stake file with an unmapped US ticker → map it inline with a valid Yahoo symbol → row re-resolves and confirm inserts it; re-import same file → deduped; invalid Yahoo symbol → rejected, row stays `unknown`.
- [x] 6.4 Tenancy check: an override created on profile A does not resolve the same ticker imported under profile B; cross-profile save returns 404.
- [ ] 6.5 `openspec validate "import-ticker-mapping"` passes; then `/opsx:archive` after 9.x-style smoke sign-off.
