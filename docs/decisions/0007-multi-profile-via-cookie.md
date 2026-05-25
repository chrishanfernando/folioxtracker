# ADR 0007 — Multi-profile via cookie, not subdomain or path

| | |
| --- | --- |
| Status | Accepted |
| Date | 2026-03-11 |
| Deciders | (me) |

## Context

Multi-profile means one logged-in user can switch between multiple independent portfolios (personal, SMSF, partner's account). The active profile has to be readable on every API request so queries can scope to it.

Three models for how the server knows the active profile:

- **Cookie.** A small `profile=<n>` cookie set when the user picks a profile.
- **Subdomain.** `personal.app`, `smsf.app`. Requires DNS plumbing.
- **URL path.** `/p/2/dashboard`. Requires routing-wide refactor.
- **Header.** `X-Profile-Id`. Works for API but invisible in browser navigation.

## Decision

**Use a `profile` cookie, defaulting to `1` when absent or unparseable.** The cookie is set client-side via [`src/components/profile-context.tsx`](../../src/components/profile-context.tsx); server reads it via [`src/lib/profile.ts`](../../src/lib/profile.ts). All profile-scoped queries pull `profileId` from the request.

## Consequences

**Accepted.**

- Switching profile is instant — set cookie, refetch. No URL change, no page reload.
- Routes stay shape-stable: `/dashboard` is `/dashboard` regardless of profile. Bookmarks, browser history, and middleware patterns don't have to be profile-aware.
- API surface stays simple: every server handler reads `getProfileId(request)` and proceeds. No profile in the URL means no `[profileId]` segments to plumb.
- The default-to-profile-1 fallback means a fresh install works without explicit configuration.

**Trade-offs accepted.**

- A bookmarked URL doesn't carry the profile context. Reload from a fresh browser shows whatever profile the cookie says (or `1`). Acceptable for a single-user app.
- Two browser tabs on the same machine share the cookie, so they can't view two different profiles simultaneously. Workaround: open the second profile in a private window.
- Changing the active profile is not in the URL → not in HTTP cache keys. We lean on Next.js client-side fetching, which is fine; SSR with caching would need cookie-aware cache keys.

## Alternatives considered

- **URL path (`/p/<profileId>/...`).** Most "correct" REST shape, but requires every page and every API route to grow a `profileId` segment. Big refactor for a feature that already works. May be the right answer at v2 if multi-profile becomes a public-facing differentiator with bookmarkable per-profile views.
- **Subdomain.** Doesn't fit a self-hosted Pi context. Wildcard DNS, certificate gymnastics.
- **Header.** Fine for API; doesn't help SPA navigation. Would need a parallel cookie anyway for the browser side.
- **One DB per profile.** Over-isolated. Cross-profile aggregations (which v1 doesn't have but might in v2) become awkward.

## Revisit if

- Per-profile bookmarkable URLs become a user-visible requirement (e.g. "share a read-only link to the SMSF dashboard with my accountant").
- The product becomes multi-user; identity scoping joins profile scoping and the simple cookie model needs to extend.
