/**
 * One-shot migration: promote the legacy single-password installation to a
 * multi-user installation. Idempotent — safe to re-run.
 *
 * What it does:
 *   1. If a `settings` row exists with a `passwordHash` and there are no `user`
 *      rows yet, create a `user` whose email is taken from `settings.email` (or
 *      OWNER_EMAIL env var). Insert a `credential` `account` row pointing at the
 *      existing bcrypt hash so the owner can sign in unchanged. Mark the user as
 *      emailVerified so they don't get blocked at login.
 *   2. Backfill `profiles.user_id` to that user for any rows currently NULL.
 *   3. Carry the legacy `email_notifications` flag onto the new `user_settings`
 *      row.
 *
 * Run: `npm run migrate:multiuser`
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { db, schema } from '../src/db';

async function main() {
  const ownerEmailEnv = process.env.OWNER_EMAIL?.trim();

  const existingUsers = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
  if (existingUsers.length > 0) {
    console.log('User table is non-empty — skipping owner promotion.');
  } else {
    const settingsRow = (await db.select().from(schema.settings).limit(1))[0];
    if (!settingsRow) {
      console.log('No settings row — fresh install, nothing to migrate.');
    } else if (!settingsRow.passwordHash) {
      console.log('Settings row has no passwordHash — skipping owner promotion.');
    } else {
      const ownerEmail = ownerEmailEnv || settingsRow.email;
      if (!ownerEmail) {
        throw new Error(
          'No email available for the legacy owner. Set OWNER_EMAIL env var to the address you want to use.',
        );
      }

      const userId = randomUUID();
      const now = new Date();

      await db.insert(schema.user).values({
        id: userId,
        name: ownerEmail.split('@')[0] || 'Owner',
        email: ownerEmail,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: settingsRow.passwordHash,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.userSettings).values({
        userId,
        notificationEmail: settingsRow.email ?? null,
        emailNotifications: !!settingsRow.emailNotifications,
      });

      console.log(`Created owner user ${ownerEmail} (id=${userId}).`);
      console.log('They can sign in with their existing password (bcrypt verifier is wired in).');

      // Backfill any orphan profile rows to the new owner.
      const orphanProfiles = await db.select({ id: schema.profiles.id })
        .from(schema.profiles)
        .where(isNull(schema.profiles.userId));
      if (orphanProfiles.length > 0) {
        await db.update(schema.profiles)
          .set({ userId })
          .where(isNull(schema.profiles.userId));
        console.log(`Backfilled user_id on ${orphanProfiles.length} profile(s).`);
      }
    }
  }

  // Even if the owner user was created in a prior run, ensure orphan profiles
  // get reattached to the only user when there is exactly one user.
  const allUsers = await db.select({ id: schema.user.id }).from(schema.user);
  if (allUsers.length === 1) {
    const orphans = await db.select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(isNull(schema.profiles.userId));
    if (orphans.length > 0) {
      await db.update(schema.profiles)
        .set({ userId: allUsers[0].id })
        .where(isNull(schema.profiles.userId));
      console.log(`Reattached ${orphans.length} orphan profile(s) to the only user.`);
    }
  } else if (allUsers.length > 1) {
    const orphans = await db.select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(isNull(schema.profiles.userId));
    if (orphans.length > 0) {
      console.warn(
        `Skipping orphan-profile backfill: there are ${allUsers.length} users and ${orphans.length} orphan profile(s). ` +
          'Reassign manually.',
      );
    }
  }

  console.log('Migration complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => {
  // libSQL/Turso client keeps the process alive.
  process.exit(0);
});

// Silence unused import warnings in TS.
void eq;
