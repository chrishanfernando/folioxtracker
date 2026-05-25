# Architecture Decision Records (ADRs)

Short, dated records of decisions that shaped this codebase, with the reasoning at the time. The goal is for someone (including future-me) to understand *why* a design is the way it is, without having to re-derive it.

## Format

Each ADR follows a four-section pattern:

- **Context.** What was true when the decision was made.
- **Decision.** What we chose.
- **Consequences.** What we accept, both good and bad.
- **Alternatives considered.** What we rejected and why.

## When to write one

When a decision is non-obvious to a future reader, hard to reverse, or has trade-offs that someone might want to revisit. *Not* every code choice — just the ones where "why on earth did we…?" is a question someone might reasonably ask.

## When to supersede one

If the conditions change and the decision flips, write a new ADR that supersedes the old one. Don't edit the old; mark it as superseded with a link forward. The history is the value.

## Index

| # | Title | Status |
| --- | --- | --- |
| 0001 | [Drizzle ORM over Prisma](./0001-drizzle-over-prisma.md) | Accepted |
| 0002 | [Self-host on Raspberry Pi as primary deploy target](./0002-self-host-on-pi.md) | Accepted |
| 0003 | [Single-password auth, no users table](./0003-password-only-auth.md) | Accepted |
| 0004 | [AUD as the only base currency](./0004-aud-as-base-currency.md) | Accepted |
| 0005 | [Holdings as derived state, not a materialised table](./0005-derived-holdings.md) | Accepted |
| 0006 | [Yahoo Finance as the sole price source](./0006-yahoo-finance.md) | Accepted |
| 0007 | [Multi-profile via cookie, not subdomain or path](./0007-multi-profile-via-cookie.md) | Accepted |
| 0008 | [OpenSpec-driven development](./0008-openspec-driven-development.md) | Accepted |
