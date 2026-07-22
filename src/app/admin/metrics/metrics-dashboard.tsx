'use client';

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { MetricsOverview } from '@/lib/metrics';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-3xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function MetricsDashboard({ data }: { data: MetricsOverview }) {
  const verifyLow = data.verificationRate < 60 && data.totals.users > 0;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Product Metrics</h1>
        <span className="text-xs text-muted-foreground">
          Generated {new Date(data.generatedAt).toLocaleString()}
        </span>
      </div>

      {/* Top-line stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total users" value={data.totals.users} />
        <StatCard label="Email verified" value={`${data.verificationRate}%`} sub={`${data.totals.verifiedUsers} of ${data.totals.users}`} />
        <StatCard label="Activated" value={data.totals.activatedUsers} sub="logged ≥1 transaction" />
        <StatCard label="Weekly active" value={data.totals.wau} sub="last 7 days" />
      </div>

      {verifyLow && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-6 text-sm">
            <strong>⚠ Email-verification drop-off.</strong> Only {data.verificationRate}% of sign-ups
            verify their email. Verification is required to use the app, so everyone below this line is
            lost before activation. This is usually the highest-leverage funnel fix — check deliverability
            and the verification email copy.
          </CardContent>
        </Card>
      )}

      {/* Acquisition funnel */}
      <Card>
        <CardHeader>
          <CardTitle>Acquisition → Activation funnel</CardTitle>
          <CardDescription>Derived from the user/session tables — works retroactively.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.funnel.map((stage) => (
            <div key={stage.label}>
              <div className="flex justify-between text-sm mb-1">
                <span>{stage.label}</span>
                <span className="text-muted-foreground">{stage.count} · {stage.pctOfTop}%</span>
              </div>
              <div className="h-3 rounded bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.max(stage.pctOfTop, 1)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Retention */}
        <Card>
          <CardHeader>
            <CardTitle>Retention</CardTitle>
            <CardDescription>{data.retention.cohortNote}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-8">
            <div>
              <div className="text-3xl font-bold">{data.retention.d7}%</div>
              <div className="text-xs text-muted-foreground">D7 — returned after first day</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{data.retention.d30}%</div>
              <div className="text-xs text-muted-foreground">D30 — active in last 30 days</div>
            </div>
          </CardContent>
        </Card>

        {/* WAU trend */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly active users</CardTitle>
            <CardDescription>Last 12 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            {data.wauTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.wauTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="users" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feature adoption */}
      <Card>
        <CardHeader>
          <CardTitle>Feature adoption</CardTitle>
          <CardDescription>% of users active in the last 30 days who have ever used each feature.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.featureAdoption.every((f) => f.users === 0) ? (
            <p className="text-sm text-muted-foreground">
              No feature events captured yet. Adoption fills in as users interact with the app.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.featureAdoption} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <YAxis type="category" dataKey="feature" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Adoption']} />
                <Bar dataKey="pctOfActive" radius={[0, 4, 4, 0]}>
                  {data.featureAdoption.map((f, i) => (
                    <Cell key={i} fill={f.pctOfActive >= 30 ? 'var(--primary)' : 'var(--muted-foreground)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Importer health */}
        <Card>
          <CardHeader>
            <CardTitle>Importer health</CardTitle>
            <CardDescription>Usage and rows inserted per source (all time).</CardDescription>
          </CardHeader>
          <CardContent>
            {data.importerHealth.length === 0 ? (
              <p className="text-sm text-muted-foreground">No imports captured yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="font-medium py-1">Source</th>
                    <th className="font-medium py-1 text-right">Imports</th>
                    <th className="font-medium py-1 text-right">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {data.importerHealth.map((row) => (
                    <tr key={row.source} className="border-t">
                      <td className="py-1.5 font-mono">{row.source}</td>
                      <td className="py-1.5 text-right">{row.imports}</td>
                      <td className="py-1.5 text-right">{row.rowsInserted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Event volume */}
        <Card>
          <CardHeader>
            <CardTitle>Event volume (30d)</CardTitle>
            <CardDescription>{data.totals.eventsLast30d} events in the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.eventVolume.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events captured yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.eventVolume.map((row) => (
                    <tr key={row.name} className="border-t first:border-t-0">
                      <td className="py-1.5 font-mono">{row.name}</td>
                      <td className="py-1.5 text-right">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Errors (30d)</CardTitle>
          <CardDescription>Unhandled server errors captured via the API error handler.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.errors.total === 0 ? (
            <p className="text-sm text-muted-foreground">No errors captured. 🎉</p>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="font-semibold">{data.errors.total} total</div>
              {data.errors.byRoute.map((r) => (
                <div key={r.route} className="flex justify-between">
                  <span className="font-mono">{r.route}</span>
                  <span>{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent signups */}
      <Card>
        <CardHeader>
          <CardTitle>Recent sign-ups</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="font-medium py-1">Email</th>
                  <th className="font-medium py-1">Joined</th>
                  <th className="font-medium py-1">Verified</th>
                  <th className="font-medium py-1">Activated</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSignups.map((u) => (
                  <tr key={u.email} className="border-t">
                    <td className="py-1.5">{u.email}</td>
                    <td className="py-1.5">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-1.5">{u.verified ? '✓' : '—'}</td>
                    <td className="py-1.5">{u.activated ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
