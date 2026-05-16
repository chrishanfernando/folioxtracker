// One-off: delete risk_profiles rows for a single user by email.
// Used to test the OnboardingGate's redirect for an existing account.
// Usage: npx tsx scripts/reset-risk-profile.ts <email>

import 'dotenv/config';
import { db, schema } from '../src/db';
import { eq } from 'drizzle-orm';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx tsx scripts/reset-risk-profile.ts <email>');
    process.exit(1);
  }

  const users = await db.select({ id: schema.user.id, name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);

  if (users.length === 0) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  const userId = users[0].id;
  console.log(`Found user: id=${userId} name="${users[0].name}" email=${email}`);

  const before = await db.select({ id: schema.riskProfiles.id, profileId: schema.riskProfiles.profileId, tier: schema.riskProfiles.riskTier })
    .from(schema.riskProfiles)
    .where(eq(schema.riskProfiles.userId, userId));
  console.log(`Risk-profile rows for this user: ${before.length}`);
  for (const r of before) console.log(`  - id=${r.id} profileId=${r.profileId} tier=${r.tier}`);

  if (before.length === 0) {
    console.log('Nothing to delete. User already has no risk profile — OnboardingGate should already redirect them.');
    return;
  }

  const deleted = await db.delete(schema.riskProfiles)
    .where(eq(schema.riskProfiles.userId, userId))
    .returning({ id: schema.riskProfiles.id });
  console.log(`Deleted ${deleted.length} row(s).`);

  const after = await db.select({ id: schema.riskProfiles.id })
    .from(schema.riskProfiles)
    .where(eq(schema.riskProfiles.userId, userId));
  console.log(`Remaining risk-profile rows for this user: ${after.length}`);
  console.log('Done. Log in as this user and the OnboardingGate should redirect to /risk-profile.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
