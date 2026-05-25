# ADR 0001 — Drizzle ORM over Prisma

| | |
| --- | --- |
| Status | Accepted |
| Date | 2026-03-04 |
| Deciders | (me) |

## Context

Choosing an ORM/query layer for a SQLite/libSQL app that runs on Vercel and on a Raspberry Pi. The two viable options at the time were Prisma and Drizzle.

The constraints that mattered:

- **Bundle size and cold-start.** Vercel functions and Pi memory both punish heavy runtimes.
- **TypeScript ergonomics.** I want the schema to be the source of truth in TS, not in a separate DSL file.
- **Migration story.** I need to evolve the schema as the product evolves.
- **libSQL / Turso compatibility.** Local SQLite for dev, libSQL remote for prod.

## Decision

**Use Drizzle ORM with Drizzle Kit for migrations.** Schema lives in `src/db/schema.ts` as pure TypeScript; queries use Drizzle's type-safe query builder; migrations are generated with `drizzle-kit generate` and applied with `drizzle-kit push`.

## Consequences

**Accepted.**

- The schema-in-TS pattern makes the type system the source of truth. Refactors are caught at the editor.
- Drizzle's runtime is small and works fine on a Pi.
- Drizzle Kit's `push` command is fast for local iteration; `generate` produces migration SQL when stability matters.
- Query syntax stays close to SQL, which I prefer — no opaque "magic" methods that hide query plans.

**Trade-offs accepted.**

- Drizzle's ecosystem is younger than Prisma's. Fewer Stack Overflow answers, fewer integrations.
- No built-in migration *runner* with rollback semantics — `push` is one-way. For this app's scale that's fine; for a multi-engineer prod app it would be insufficient.
- Some Drizzle APIs were still in flux at adoption time, requiring occasional `as any` workarounds in places. Tracked, accepted as cost of being early.

## Alternatives considered

- **Prisma.** Heavier runtime, larger bundle, separate `.prisma` schema language. Better introspection tooling. Rejected primarily for bundle size and the schema-language overhead — for a single-engineer project, the duplicate truth (schema file + TS types) is friction, not value.
- **Kysely.** Strong type-safe query builder, but less batteries-included for migrations. Would have been a fine choice; Drizzle's combined query + migration story tipped it.
- **Raw SQL with a thin types layer.** Fastest in absolute terms; surrenders the refactor-safety net the type system provides. Not worth it at this scale.

## Revisit if

- Drizzle's API stability becomes an ongoing problem (more than a couple of breaking changes per year).
- The app grows multiple engineers; rollback-capable migrations matter more.
- The DB shifts off SQLite/libSQL to something where Drizzle has weaker support.
