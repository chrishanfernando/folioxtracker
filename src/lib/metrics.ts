import { db, schema } from '@/db';
import { inArray, desc } from 'drizzle-orm';

/**
 * Product-metrics aggregation. Two data sources:
 *
 *  1. Acquisition / activation / retention are derived from the `user` and
 *     `session` tables, which Better Auth already maintains. This works
 *     retroactively (no instrumentation needed) and is the "Phase 0" surface.
 *  2. Feature adoption / engagement / reliability come from `analytics_events`
 *     ("Phase 1"), captured going forward via src/lib/analytics.ts.
 *
 * Volumes are small (a glance product), so aggregation is done in TypeScript
 * rather than with database-specific date SQL. Keep it that way until a single
 * query returns more than a few thousand rows.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal place
}

function isoWeekKey(d: Date): string {
  // Year-Www label, Monday-based, good enough for a trend axis.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface FunnelStage {
  label: string;
  count: number;
  pctOfTop: number;
}

export interface MetricsOverview {
  generatedAt: string;
  totals: {
    users: number;
    verifiedUsers: number;
    activatedUsers: number;
    wau: number;
    eventsLast30d: number;
  };
  funnel: FunnelStage[];
  verificationRate: number;
  retention: {
    d7: number; // % of users aged 7–30d who returned after their first day
    d30: number; // % of users aged 30–90d active in the last 30d
    cohortNote: string;
  };
  wauTrend: { week: string; users: number }[];
  featureAdoption: { feature: string; users: number; pctOfActive: number }[];
  eventVolume: { name: string; count: number }[];
  importerHealth: { source: string; imports: number; rowsInserted: number }[];
  errors: { total: number; byRoute: { route: string; count: number }[] };
  recentSignups: { email: string; createdAt: string; verified: boolean; activated: boolean }[];
}

interface ParsedEvent {
  userId: string | null;
  name: string;
  props: Record<string, unknown>;
  createdAt: Date;
}

export async function getMetricsOverview(): Promise<MetricsOverview> {
  // --- Source tables ---------------------------------------------------------
  const users = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      emailVerified: schema.user.emailVerified,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user);

  const sessions = await db
    .select({ userId: schema.session.userId, createdAt: schema.session.createdAt })
    .from(schema.session);

  const eventRows = await db
    .select({
      userId: schema.analyticsEvents.userId,
      name: schema.analyticsEvents.name,
      props: schema.analyticsEvents.props,
      createdAt: schema.analyticsEvents.createdAt,
    })
    .from(schema.analyticsEvents)
    .orderBy(desc(schema.analyticsEvents.createdAt))
    .limit(50_000);

  const events: ParsedEvent[] = eventRows.map((r) => {
    let props: Record<string, unknown> = {};
    if (r.props) {
      try {
        props = JSON.parse(r.props) as Record<string, unknown>;
      } catch {
        props = {};
      }
    }
    return { userId: r.userId, name: r.name, props, createdAt: r.createdAt as Date };
  });

  // --- Activation: users with at least one transaction ----------------------
  // transactions -> assets -> profiles -> userId
  const activatedUserIds = new Set<string>();
  const profileRows = await db
    .select({ id: schema.profiles.id, userId: schema.profiles.userId })
    .from(schema.profiles);
  const profileToUser = new Map<number, string>();
  for (const p of profileRows) if (p.userId) profileToUser.set(p.id, p.userId);

  const assetRows = await db
    .select({ id: schema.assets.id, profileId: schema.assets.profileId })
    .from(schema.assets);
  const assetToUser = new Map<number, string>();
  for (const a of assetRows) {
    const uid = profileToUser.get(a.profileId);
    if (uid) assetToUser.set(a.id, uid);
  }

  const assetIds = assetRows.map((a) => a.id);
  if (assetIds.length > 0) {
    const txAssetRows = await db
      .select({ assetId: schema.transactions.assetId })
      .from(schema.transactions)
      .where(inArray(schema.transactions.assetId, assetIds));
    for (const t of txAssetRows) {
      const uid = assetToUser.get(t.assetId);
      if (uid) activatedUserIds.add(uid);
    }
  }

  // --- Sessions per user / activity -----------------------------------------
  const sessionsByUser = new Map<string, Date[]>();
  for (const s of sessions) {
    const list = sessionsByUser.get(s.userId) ?? [];
    list.push(s.createdAt as Date);
    sessionsByUser.set(s.userId, list);
  }
  const loggedInUserIds = new Set(sessionsByUser.keys());

  // --- Totals ----------------------------------------------------------------
  const totalUsers = users.length;
  const verifiedUsers = users.filter((u) => u.emailVerified).length;

  const sevenDaysAgo = daysAgo(7);
  const wauUserIds = new Set<string>();
  for (const [uid, dates] of sessionsByUser) {
    if (dates.some((d) => d >= sevenDaysAgo)) wauUserIds.add(uid);
  }
  for (const e of events) {
    if (e.userId && e.createdAt >= sevenDaysAgo) wauUserIds.add(e.userId);
  }

  const thirtyDaysAgo = daysAgo(30);
  const eventsLast30d = events.filter((e) => e.createdAt >= thirtyDaysAgo).length;

  // --- Funnel ----------------------------------------------------------------
  const funnel: FunnelStage[] = [
    { label: 'Signed up', count: totalUsers, pctOfTop: 100 },
    { label: 'Email verified', count: verifiedUsers, pctOfTop: pct(verifiedUsers, totalUsers) },
    { label: 'Logged in', count: loggedInUserIds.size, pctOfTop: pct(loggedInUserIds.size, totalUsers) },
    { label: 'Activated (1st transaction)', count: activatedUserIds.size, pctOfTop: pct(activatedUserIds.size, totalUsers) },
  ];

  // --- Retention -------------------------------------------------------------
  // D7: users aged 7–30 days who had activity on a day other than signup day.
  const ninetyDaysAgo = daysAgo(90);
  let d7Denom = 0;
  let d7Num = 0;
  let d30Denom = 0;
  let d30Num = 0;
  for (const u of users) {
    const created = u.createdAt as Date;
    const userSessions = sessionsByUser.get(u.id) ?? [];
    const ageDays = (Date.now() - created.getTime()) / DAY_MS;

    if (ageDays >= 7 && ageDays <= 30) {
      d7Denom++;
      const returned = userSessions.some((d) => d.getTime() - created.getTime() >= DAY_MS);
      if (returned) d7Num++;
    }
    if (ageDays >= 30 && ageDays <= 90 && created >= ninetyDaysAgo) {
      d30Denom++;
      const activeRecently = userSessions.some((d) => d >= thirtyDaysAgo);
      if (activeRecently) d30Num++;
    }
  }

  // --- WAU trend (last 12 weeks) --------------------------------------------
  const weekBuckets = new Map<string, Set<string>>();
  const twelveWeeksAgo = daysAgo(7 * 12);
  const addToWeek = (d: Date, uid: string) => {
    if (d < twelveWeeksAgo) return;
    const key = isoWeekKey(d);
    const set = weekBuckets.get(key) ?? new Set<string>();
    set.add(uid);
    weekBuckets.set(key, set);
  };
  for (const [uid, dates] of sessionsByUser) for (const d of dates) addToWeek(d, uid);
  for (const e of events) if (e.userId) addToWeek(e.createdAt, e.userId);
  const wauTrend = [...weekBuckets.entries()]
    .map(([week, set]) => ({ week, users: set.size }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // --- Feature adoption ------------------------------------------------------
  const FEATURES: { feature: string; event: string }[] = [
    { feature: 'Log transaction', event: 'transaction_created' },
    { feature: 'Import file', event: 'import_completed' },
    { feature: 'Set targets', event: 'target_set' },
    { feature: 'View rebalance', event: 'rebalance_viewed' },
    { feature: 'Apply portfolio template', event: 'portfolio_template_applied' },
    { feature: 'View dashboard', event: 'dashboard_viewed' },
    { feature: 'Export data', event: 'account_exported' },
  ];
  const usersByEvent = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.userId) continue;
    const set = usersByEvent.get(e.name) ?? new Set<string>();
    set.add(e.userId);
    usersByEvent.set(e.name, set);
  }
  // "Active" denominator = users seen (session or event) in the last 30 days.
  const activeUserIds = new Set<string>();
  for (const [uid, dates] of sessionsByUser) if (dates.some((d) => d >= thirtyDaysAgo)) activeUserIds.add(uid);
  for (const e of events) if (e.userId && e.createdAt >= thirtyDaysAgo) activeUserIds.add(e.userId);
  const activeDenom = Math.max(activeUserIds.size, 1);
  const featureAdoption = FEATURES.map((f) => {
    const u = usersByEvent.get(f.event)?.size ?? 0;
    return { feature: f.feature, users: u, pctOfActive: pct(u, activeDenom) };
  });

  // --- Event volume (last 30 days) ------------------------------------------
  const volume = new Map<string, number>();
  for (const e of events) {
    if (e.createdAt < thirtyDaysAgo) continue;
    volume.set(e.name, (volume.get(e.name) ?? 0) + 1);
  }
  const eventVolume = [...volume.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // --- Importer health -------------------------------------------------------
  const importAgg = new Map<string, { imports: number; rowsInserted: number }>();
  for (const e of events) {
    if (e.name !== 'import_completed') continue;
    const source = typeof e.props.source === 'string' ? e.props.source : 'unknown';
    const inserted = typeof e.props.inserted === 'number' ? e.props.inserted : 0;
    const agg = importAgg.get(source) ?? { imports: 0, rowsInserted: 0 };
    agg.imports++;
    agg.rowsInserted += inserted;
    importAgg.set(source, agg);
  }
  const importerHealth = [...importAgg.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.imports - a.imports);

  // --- Errors (last 30 days) -------------------------------------------------
  const errorEvents = events.filter((e) => e.name === 'error_occurred' && e.createdAt >= thirtyDaysAgo);
  const errorByRoute = new Map<string, number>();
  for (const e of errorEvents) {
    const route = typeof e.props.route === 'string' ? e.props.route : 'unknown';
    errorByRoute.set(route, (errorByRoute.get(route) ?? 0) + 1);
  }
  const errors = {
    total: errorEvents.length,
    byRoute: [...errorByRoute.entries()]
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count),
  };

  // --- Recent signups --------------------------------------------------------
  const recentSignups = [...users]
    .sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime())
    .slice(0, 10)
    .map((u) => ({
      email: u.email,
      createdAt: (u.createdAt as Date).toISOString(),
      verified: !!u.emailVerified,
      activated: activatedUserIds.has(u.id),
    }));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      users: totalUsers,
      verifiedUsers,
      activatedUsers: activatedUserIds.size,
      wau: wauUserIds.size,
      eventsLast30d,
    },
    funnel,
    verificationRate: pct(verifiedUsers, totalUsers),
    retention: {
      d7: pct(d7Num, d7Denom),
      d30: pct(d30Num, d30Denom),
      cohortNote: `D7 cohort: ${d7Denom} user(s) aged 7–30d · D30 cohort: ${d30Denom} user(s) aged 30–90d`,
    },
    wauTrend,
    featureAdoption,
    eventVolume,
    importerHealth,
    errors,
    recentSignups,
  };
}
