import { notFound } from 'next/navigation';
import { getAdminUser } from '@/lib/auth-helpers';
import { getMetricsOverview } from '@/lib/metrics';
import { MetricsDashboard } from './metrics-dashboard';

// Internal product-metrics dashboard. Server component: it loads the aggregate
// and hands it to a client component for charts. Access is gated to the emails
// in ADMIN_EMAILS; everyone else gets a 404 so the route isn't discoverable.
export const dynamic = 'force-dynamic';

export default async function AdminMetricsPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const overview = await getMetricsOverview();
  return <MetricsDashboard data={overview} />;
}
