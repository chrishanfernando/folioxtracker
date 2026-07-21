# TODO — Launch backlog

Consolidated from the four-pass pre-launch review (features / security / quality / UX)
and the fees-cost-transparency work. Updated 2026-07-18.

Already shipped, for context: all 8 security findings (PR #43), error boundaries +
branded 404 (PR #45), mobile nav overflow + dashboard error state (PR #46),
transactional imports + Sentry in `apiError` + dead-code removal (PR #47),
fees & cost transparency (PR #48).

---

## 1. Launch blockers

- [x] **Replace `{{BRAND}}` / `{{LEGAL_ENTITY}}` / `{{SUPPORT_EMAIL}}` placeholders** —
      resolved 2026-07-21. Brand = **FolioX Tracker** (domain `folioxtracker.com`),
      legal entity = FolioX Tracker, support/contact = `hello@folioxtracker.com`. Swept
      landing, legal pages, root/login/app-shell chrome, email templates, and
      `.env.example`. Verify with `grep -rn "{{[A-Z_]*}}" src/` (should be empty).
- [ ] **Reconcile the local working tree** — the local checkout sits on the old
      `security/launch-security-fixes` branch with uncommitted WIP (Sentry
      instrumentation files, env/middleware/auth edits, landing-page changes).
      Much of it may already be on `main` via phase 3; diff each file against
      `origin/main`, commit what's still needed (notably
      `src/instrumentation.ts`, `src/instrumentation-client.ts`,
      `sentry.server.config.ts`, `sentry.edge.config.ts` — includes the
      `captureRequestError as onRequestError` fix), and drop the rest. Then
      delete the stale `drizzle/0004_aromatic_clea.sql` +
      `drizzle/meta/0004_aromatic_clea_snapshot.json.wip` (superseded by
      migration 0007 on main).
- [ ] **Set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` in production** — error
      reporting in `apiError()`, `error.tsx`, and `global-error.tsx` is already
      wired but no-ops until the DSN exists.

## 2. Fees feature follow-ups (openspec/changes/fees-cost-transparency)

- [ ] **Task 9.2 — manual smoke test**: `git checkout main && git pull`, run the
      dev server, import `public/samples/cmc-markets-sample.csv`, confirm
      `fee_aud` populates ($10.00 on the first row), visit `/fees` (headline,
      table, comparison, drag projection), toggle a holding's MER override.
- [ ] **Task 4.7 — Independent Reserve fee extraction**: deferred because
      `public/samples/independent-reserve-sample.csv` doesn't match the shipped
      parser's column layout (sample looks hand-authored, not exported). Obtain
      a real sanitised IR export, then map its `Fee` column (AUD leg) into
      `feeAud` in `parseIndependentReserveCsv`.
- [ ] **Archive the change** after 9.2 passes: `/opsx:archive fees-cost-transparency`.
- [ ] Inline fee/brokerage editing in the `/holdings/[id]` transaction table
      (API already supports `feeAud` on PATCH; deferred in task 4.2's note).
- [ ] Link the `public/samples/` files from the import page so users can see the
      expected formats (also listed under UX below — same work item).

## 3. Testing & tooling

- [ ] **Add a test runner (vitest) + unit tests for the money-math** — zero tests
      exist. Priority targets, all pure logic: `src/lib/calculations.ts`,
      `src/lib/rebalance.ts`, `src/lib/fees.ts` (weighted MER, drag projection,
      brokerage aggregation, CMC fee-derivation guard), and the four parsers in
      `src/lib/import-parser.ts` (the sample CSVs in `public/samples/` are
      ready-made fixtures). Add to CI.
- [ ] **Fix repo-wide eslint** — `npm run lint` crashes on every file
      (`contextOrFilename.getFilename is not a function`): eslint 10 is
      incompatible with the eslint-plugin-react bundled in eslint-config-next.
      Pin eslint to ^9 until Next's config catches up, then confirm CI's lint
      step actually lints.
- [ ] Migrate `src/middleware.ts` to the `proxy.ts` convention — Next 16.2 logs
      a deprecation warning on every dev start.

## 4. Performance & architecture

- [ ] **Adopt SWR or React Query** for the authed pages — every page refetches
      everything on mount with a "Loading..." flash; no cache, dedupe, or
      revalidation. Biggest perceived-performance win available. Start with
      dashboard + holdings.
- [ ] **Batch the per-row dedupe queries in the CMC and Stake import routes**
      (`src/app/api/import/cmc/route.ts`, `stake/route.ts`) — they SELECT per
      transaction row (N+1). IR/Swyftx share the pattern (now inside
      transactions, but still per-row). Prefetch existing keys per asset and
      match in memory.
- [ ] **Extract the duplicated profile menu** in
      `src/components/layout/app-shell.tsx` — the rename/create/select dropdown
      is implemented twice (desktop sidebar + mobile top bar), ~150 duplicated
      lines; every fix must currently be made twice.
- [ ] **Lazy-load recharts** via `next/dynamic` — heaviest client dependency,
      imported statically on dashboard, charts, holdings detail, and fees pages.
- [ ] Dashboard 60s auto-refresh (`dashboard/page.tsx` interval) bypasses the
      error handling `fetchData` has — a background failure silently
      `setData(json)`s whatever comes back. Route it through `fetchData`.

## 5. UX polish

- [ ] **OnboardingGate blank screen** (`src/components/onboarding-gate.tsx`) —
      renders `null` while checking and hard-redirects new users to
      `/risk-profile` with no framing. Show a spinner + one-line "setting up
      your profile" message.
- [ ] **Distinct error states on remaining pages** — dashboard has one (PR #46);
      holdings, transactions, rebalance, charts, and fees still conflate
      fetch-failure with empty ("no data" after an error reads as data loss).
- [ ] **Verify-email cross-device flow** (`src/app/verify-email/page.tsx`) —
      pending address comes from `localStorage`, so opening the link on another
      device shows no email context. Fall back gracefully / pass email in URL.
- [ ] **Delete-profile affordance** — profiles can be created and renamed but
      never deleted from the UI (API/cascade implications: assets, transactions,
      prices, category targets, CMC mappings).
- [ ] Link `public/samples/` from the import page (see §2).
- [ ] Import flow: surface the "replaces all Excel-sourced transactions"
      semantics before the preview step, not only in the preview warning text.

## 6. SEO / metadata / analytics

- [ ] **Root metadata** (`src/app/layout.tsx`) — bare "Portfolio Tracker"
      title/description. Add a title template, `metadataBase`, description, and
      OpenGraph/Twitter cards (landing page has better metadata but no OG).
- [ ] **`robots.ts` + `sitemap.ts`** for the public pages (landing, legal).
- [ ] **Analytics decision** — the landing page promises "no third-party
      tracking". `src/lib/analytics.ts` + `/admin/metrics` (phase 3) may already
      cover product metrics; if more is wanted, keep it self-hosted
      (Plausible/Umami) so the claim stays true.

## 7. Security & dependency watch

- [ ] **Full CSP rollout** — `next.config.ts` currently ships only
      `frame-ancestors 'none'`. Add a real `Content-Security-Policy`
      (script-src/style-src etc.) in Report-Only first, then enforce.
- [ ] Add `preload` to the HSTS header once the domain is submitted to the
      HSTS preload list (noted in `next.config.ts`).
- [ ] **Remaining npm audit moderates (6)** — all from postcss bundled inside
      Next itself; no stable fix (only a canary). Re-run `npm audit` when
      Next 16.3 ships.
- [ ] Periodic dependency review — better-auth and mailparser/imapflow parse
      untrusted input (auth requests, inbound email); keep them current.

## 8. Product backlog (P1+, from fees design.md "out of scope")

- [ ] Brokerage YTD / per-platform breakdown UI (column already captured).
- [ ] Editable gross-return assumption in the fee-drag projection (fixed 7% v1).
- [ ] Contribution-aware (DCA) projections — depends on a recurring-contributions
      feature.
- [ ] MER staleness handling — `STATIC_MER_BPS` values are issuer-published as of
      authoring; consider a "last reviewed" note or periodic refresh.

## 9. Repo housekeeping

- [ ] Old PR #23 (`feature/multi-user-auth`) is still open on GitHub — close or
      rebase; the feature appears long since merged via other branches.
- [ ] `New Portfolio.xlsx`, `local.db`, `ci.db` live in the repo root
      (gitignored, but consider moving personal data out of the project dir).
- [ ] `local.db` has an empty `__drizzle_migrations` table, so
      `npm run build` (which runs `drizzle-kit migrate`) fails locally against
      it — either baseline the migrations table or recreate local.db from
      migrations.
- [ ] Delete merged remote branches (security/launch-security-fixes,
      feature/error-boundaries, feature/ux-launch-fixes,
      quality/import-transactions, feature/fees-cost-transparency once merged).
