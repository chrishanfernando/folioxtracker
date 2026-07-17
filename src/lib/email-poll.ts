import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as pdfParse from 'pdf-parse';
import { parseCmcConfirmationPdf } from '@/lib/cmc-email-parser';
import { importCmcTransactions } from '@/lib/cmc-import';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { recordCronRun } from '@/lib/cron-runs';

interface PollResult {
  processed: number;
  imported: number;
  skipped: number;
  errors: string[];
}

const PARSE_TIMEOUT_MS = 10_000;
const MAX_MESSAGE_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${PARSE_TIMEOUT_MS}ms`)),
      PARSE_TIMEOUT_MS,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
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

  // Load account mappings. Only verified mappings are eligible for ingestion;
  // unverified mappings are tracked so we can leave the email unread + record skip.
  const mappings = await db.select().from(schema.cmcAccountMappings);
  const verifiedAccountToProfile = new Map(
    mappings.filter(m => m.verified).map(m => [m.cmcAccountNumber, m.profileId]),
  );
  const knownUnverifiedAccounts = new Set(
    mappings.filter(m => !m.verified).map(m => m.cmcAccountNumber),
  );

  if (verifiedAccountToProfile.size === 0 && knownUnverifiedAccounts.size === 0) {
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
      const messages = client.fetch(
        { seen: false },
        { source: true, envelope: true },
      );

      for await (const msg of messages) {
        try {
          if (!msg.source) continue;

          if (msg.source.length > MAX_MESSAGE_BYTES) {
            result.errors.push(`Message ${msg.seq} exceeds ${MAX_MESSAGE_BYTES} bytes; skipped`);
            result.skipped++;
            continue;
          }

          const parsed = await withTimeout(simpleParser(msg.source), 'simpleParser');
          const from = parsed.from?.text?.toLowerCase() || '';

          if (!from.includes('cmc')) {
            continue;
          }

          const pdfAttachments = (parsed.attachments || []).filter(
            a => a.contentType === 'application/pdf' || a.filename?.endsWith('.pdf'),
          );

          if (pdfAttachments.length === 0) continue;

          let markRead = true;

          for (const attachment of pdfAttachments) {
            if (!attachment.content || attachment.content.length > MAX_ATTACHMENT_BYTES) {
              result.errors.push(
                `Attachment ${attachment.filename || 'unnamed'} exceeds ${MAX_ATTACHMENT_BYTES} bytes; skipped`,
              );
              result.skipped++;
              markRead = false;
              continue;
            }

            type PdfParseFn = (b: Buffer) => Promise<{ text: string }>;
            const pdf = ((pdfParse as unknown as { default?: PdfParseFn }).default ||
              (pdfParse as unknown as PdfParseFn));
            let pdfData: { text: string };
            try {
              pdfData = await withTimeout(pdf(attachment.content), 'pdf-parse');
            } catch (err) {
              result.errors.push(
                `Failed to parse PDF ${attachment.filename || 'unnamed'}: ${err instanceof Error ? err.message : 'unknown'}`,
              );
              markRead = false;
              continue;
            }

            const tx = parseCmcConfirmationPdf(pdfData.text);

            if (!tx) {
              result.errors.push(`Could not parse PDF: ${attachment.filename || 'unnamed'}`);
              continue;
            }

            const profileId = verifiedAccountToProfile.get(tx.accountNumber);
            if (!profileId) {
              if (knownUnverifiedAccounts.has(tx.accountNumber)) {
                result.errors.push(
                  `mapping unverified for CMC account ${tx.accountNumber} (confirmation ${tx.confirmationNo})`,
                );
              } else {
                result.errors.push(
                  `Unknown CMC account ${tx.accountNumber} (confirmation ${tx.confirmationNo})`,
                );
              }
              result.skipped++;
              markRead = false;
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

          if (markRead) {
            await client.messageFlagsAdd(msg.seq, ['\\Seen'], { uid: false });
          }
        } catch (err) {
          result.errors.push(`Error processing message: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    result.errors.push(`IMAP connection error: ${err instanceof Error ? err.message : String(err)}`);
  }

  await recordCronRun('email_poll', result.errors.length > 0 ? 'error' : 'ok', {
    processed: result.processed,
    skipped: result.skipped,
    errors: result.errors.length,
  });

  return result;
}
