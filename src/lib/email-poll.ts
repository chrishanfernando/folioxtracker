import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as pdfParse from 'pdf-parse';
import { parseCmcConfirmationPdf } from '@/lib/cmc-email-parser';
import { importCmcTransactions } from '@/lib/cmc-import';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { eq } from 'drizzle-orm';

interface PollResult {
  processed: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export async function pollCmcEmails(): Promise<PollResult> {
  if (!env.EMAIL_POLL_ENABLED) {
    return { processed: 0, imported: 0, skipped: 0, errors: ['IMAP feature disabled'] };
  }

  const host = env.IMAP_HOST;
  const port = env.IMAP_PORT;
  const user = env.IMAP_USER;
  const pass = env.IMAP_PASSWORD;

  if (!host || !user || !pass) {
    return { processed: 0, imported: 0, skipped: 0, errors: ['IMAP not configured'] };
  }

  // Load account mappings
  const mappings = await db.select().from(schema.cmcAccountMappings);
  const accountToProfile = new Map(mappings.map(m => [m.cmcAccountNumber, m.profileId]));

  if (accountToProfile.size === 0) {
    return { processed: 0, imported: 0, skipped: 0, errors: ['No CMC account mappings configured'] };
  }

  const result: PollResult = { processed: 0, imported: 0, skipped: 0, errors: [] };

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Search for unread messages (from CMC Markets)
      const messages = client.fetch(
        { seen: false },
        { source: true, envelope: true },
      );

      for await (const msg of messages) {
        try {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const from = parsed.from?.text?.toLowerCase() || '';

          // Only process CMC Markets emails
          if (!from.includes('cmc')) {
            continue;
          }

          // Extract PDF attachments
          const pdfAttachments = (parsed.attachments || []).filter(
            a => a.contentType === 'application/pdf' || a.filename?.endsWith('.pdf'),
          );

          if (pdfAttachments.length === 0) continue;

          for (const attachment of pdfAttachments) {
            const pdf = (pdfParse as any).default || pdfParse;
            const pdfData = await pdf(attachment.content);
            const tx = parseCmcConfirmationPdf(pdfData.text);

            if (!tx) {
              result.errors.push(`Could not parse PDF: ${attachment.filename || 'unnamed'}`);
              continue;
            }

            // Look up profile from account number
            const profileId = accountToProfile.get(tx.accountNumber);
            if (!profileId) {
              result.errors.push(`Unknown CMC account ${tx.accountNumber} (confirmation ${tx.confirmationNo})`);
              continue;
            }

            const importResult = await importCmcTransactions(
              [{ date: tx.date, assetSymbol: tx.assetSymbol, cmcTicker: tx.cmcTicker, action: tx.action, quantity: tx.quantity, unitPriceAud: tx.unitPriceAud, totalAud: tx.totalAud }],
              profileId,
              'CMC Email',
            );

            result.imported += importResult.imported;
            result.skipped += importResult.skipped;
          }

          result.processed++;

          // Mark as read
          await client.messageFlagsAdd(msg.seq, ['\\Seen'], { uid: false });
        } catch (err) {
          result.errors.push(`Error processing message: ${err}`);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    result.errors.push(`IMAP connection error: ${err}`);
  }

  // Update last poll timestamp
  await db.update(schema.settings).set({ lastEmailPoll: new Date().toISOString() });

  return result;
}
