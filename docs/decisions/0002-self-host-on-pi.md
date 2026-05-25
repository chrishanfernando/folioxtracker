# ADR 0002 — Self-host on Raspberry Pi as the primary deploy target

| | |
| --- | --- |
| Status | Accepted |
| Date | 2026-03-21 |
| Deciders | (me) |

## Context

The app needs a home. Three obvious paths:

- **Vercel.** Frictionless, free for personal use, integrates with Next.js perfectly.
- **A small VPS.** Hetzner / DigitalOcean / Linode at ~$5–10/mo.
- **A device on my own network.** A Raspberry Pi I already own.

The product thesis (see [`docs/product/03-product-strategy.md`](../product/03-product-strategy.md)) leans on *privacy* and *self-host* as differentiators. The deploy story has to match.

## Decision

**Make Raspberry Pi self-host the primary deployment story; keep `vercel.json` as a secondary, opt-in path.** Ship a `setup-pi.sh` script that handles Node install, swap, env-secret generation, build, PM2, and nginx in one run.

## Consequences

**Accepted.**

- The privacy thesis stays honest. Nobody else holds the user's data.
- The setup script becomes part of the product surface. It needs the same care a UI does.
- Pi as the *primary* target forces me to keep the runtime memory profile small and the build cold-start tolerable. That discipline is healthy for any deployment target.
- Resilience improves: my data isn't dependent on a third-party SaaS continuing to exist or honour a free tier.

**Trade-offs accepted.**

- The Pi is a single point of failure in my home. If it dies, I have no portfolio dashboard until I restore the SQLite file from backup.
- Build time on a Pi is several minutes (vs seconds on Vercel). I rebuild rarely, so this is acceptable.
- Friends/family who want to use the app have to either copy my Pi setup or accept an off-ramp to Vercel that I haven't first-classed.

## Alternatives considered

- **Vercel as primary.** Easiest by far. Rejected: free tier is fine for me but a paid public deployment for users would require multi-tenant infra, which collides with the privacy thesis. Vercel kept as a secondary because it's a useful escape hatch.
- **Small VPS.** Same operational footprint as Pi but costs money and the data still leaves my house. Worse on both axes I cared about.
- **Local-only desktop app (Electron / Tauri).** Considered briefly. Loses the "any device on the LAN can use it" affordance that the Pi gives me. Heavier development.

## Revisit if

- Pi reliability becomes an ongoing pain (SD-card corruption, power events). Would consider a low-power x86 mini-PC instead.
- The product ships a managed-self-host paid tier — at that point the *primary* operational target shifts to the managed platform, but Pi self-host stays as the OSS path.
