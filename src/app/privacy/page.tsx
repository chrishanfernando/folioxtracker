import { LegalShell } from '@/components/layout/legal-shell';

export const metadata = { title: 'Privacy Policy — FolioX Tracker' };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" lastUpdated="2026-07-02">
      <p className="text-muted-foreground">
        This Privacy Policy explains how FolioX Tracker (operated by
        {' '}FolioX Tracker, &quot;we&quot;, &quot;us&quot;)
        collects, uses, and protects your personal information. We comply
        with the <em>Australian Privacy Principles</em> under the{' '}
        <em>Privacy Act 1988</em> (Cth) and, where applicable, the GDPR.
      </p>

      <h2 className="text-xl font-semibold mt-6">1. What we collect</h2>
      <p>When you create an account and use the service, we collect:</p>
      <ul className="list-disc ml-6 space-y-1">
        <li>
          <strong>Account info</strong>: name, email address, password
          (hashed; we never store plaintext), and — if you sign in with
          Google — your Google account ID, profile name, email, and
          profile picture URL.
        </li>
        <li>
          <strong>Portfolio data you provide</strong>: profiles, asset
          tickers, transactions (date, action, quantity, price),
          allocation targets, broker/exchange labels, and any optional
          notes you enter.
        </li>
        <li>
          <strong>Imported data</strong>: contents of broker statements
          (CMC Markets, Stake, Swyftx, Independent Reserve) you upload.
        </li>
        <li>
          <strong>Usage info</strong>: IP address, browser/user-agent, and
          session timestamps stored in our session store for security and
          abuse prevention.
        </li>
      </ul>
      <p>We do not collect bank account numbers, brokerage credentials, or
        government identifiers.</p>

      <h2 className="text-xl font-semibold mt-6">2. How we use it</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li>To provide the core service (display your holdings, calculate drift, send alerts).</li>
        <li>To send transactional emails — verification, password resets, and rebalance notifications you have enabled.</li>
        <li>To detect and prevent fraud, abuse, or security incidents.</li>
        <li>
          To understand which features are used so we can improve the product,
          via a small set of first-party, anonymised usage events (for example,
          that a transaction was logged or a file imported). These events never
          include dollar amounts, holdings, or free text, and you can opt out
          under Settings → Privacy &amp; Analytics.
        </li>
        <li>To comply with legal obligations.</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your personal information, and we
        do <strong>not</strong> use your data to train machine-learning
        models.
      </p>

      <h2 className="text-xl font-semibold mt-6">3. Third parties we share with</h2>
      <p>We share the minimum necessary information with:</p>
      <ul className="list-disc ml-6 space-y-1">
        <li>
          <strong>Turso (libSQL)</strong> — hosts our database. Your
          portfolio data and account record are stored there.
        </li>
        <li>
          <strong>Vercel</strong> — hosts the application. Server logs may
          temporarily contain IP addresses and request metadata.
        </li>
        <li>
          <strong>Resend</strong> — sends transactional email
          (verification, password reset, alerts). Resend processes your
          email address and the email content.
        </li>
        <li>
          <strong>Google</strong> — authenticates you when you choose
          &quot;Continue with Google.&quot; Subject to Google&apos;s
          privacy policy.
        </li>
        <li>
          <strong>Yahoo Finance</strong> — provides market prices. Yahoo
          does not receive any of your personal data; we query public
          symbols only.
        </li>
      </ul>
      <p>
        We do not use third-party advertising, tracking pixels, or
        third-party analytics SDKs. Product-usage analytics are
        <strong> first-party only</strong> — anonymised events are stored in our
        own database (Turso, above) and never shared with an analytics vendor.
        You can opt out at any time under Settings → Privacy &amp; Analytics.
      </p>

      <h2 className="text-xl font-semibold mt-6">4. Cookies</h2>
      <p>
        We use a single essential cookie to keep you signed in
        (Better Auth session cookie). It is HTTP-only, Secure in
        production, and SameSite=Lax. We do not use marketing or
        cross-site tracking cookies.
      </p>

      <h2 className="text-xl font-semibold mt-6">5. Where your data lives</h2>
      <p>
        Our database is hosted by Turso on AWS (primary region:
        ap-southeast-2, Sydney). Our application is hosted by Vercel
        (edge and serverless functions run in the region closest to the
        request). Data may be processed in countries other than your own
        (including the United States). By using the service you consent
        to the transfer of your information to those locations.
      </p>

      <h2 className="text-xl font-semibold mt-6">6. How long we keep it</h2>
      <p>
        We retain your account and portfolio data for as long as your
        account is active. When you delete your account from{' '}
        <a href="/settings" className="underline">Settings</a>, your
        profiles, assets, transactions, prices, allocation targets, and
        account record are erased from our database immediately.
      </p>
      <p>
        Server logs (request metadata, IP addresses) are retained for up
        to 30 days for security and debugging, then automatically purged.
        Backups may persist for up to 30 days before being overwritten.
      </p>

      <h2 className="text-xl font-semibold mt-6">7. Your rights</h2>
      <p>You can, at any time:</p>
      <ul className="list-disc ml-6 space-y-1">
        <li>
          <strong>Access and export</strong> your data — Settings →
          Danger Zone → Export downloads a JSON copy of everything we
          hold about you.
        </li>
        <li>
          <strong>Correct</strong> inaccurate information — edit your
          profiles, transactions, and account email directly in the app.
        </li>
        <li>
          <strong>Delete</strong> your account and all associated data —
          Settings → Danger Zone → Delete account.
        </li>
        <li>
          <strong>Withdraw consent</strong> for marketing emails —
          disable notifications in Settings (transactional emails like
          password resets cannot be disabled while your account is
          active).
        </li>
        <li>
          <strong>Complain</strong> to a privacy regulator. In Australia
          that is the Office of the Australian Information Commissioner
          (<a className="underline" href="https://www.oaic.gov.au/">oaic.gov.au</a>).
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-6">8. Security</h2>
      <p>
        Passwords are hashed with scrypt (legacy accounts may still use
        bcrypt; both are one-way). Sessions are signed and stored
        server-side. Connections to the application are encrypted with
        HTTPS. No system is perfectly secure — please choose a strong,
        unique password and notify us at hello@folioxtracker.com if you suspect
        unauthorised access.
      </p>

      <h2 className="text-xl font-semibold mt-6">9. Children</h2>
      <p>
        The service is not intended for children under 18, and we do not
        knowingly collect personal information from minors. If you
        believe a minor has created an account, contact us and we will
        delete it.
      </p>

      <h2 className="text-xl font-semibold mt-6">10. Changes</h2>
      <p>
        We may update this policy from time to time. Material changes
        will be notified via email or an in-app notice at least 7 days
        before they take effect.
      </p>

      <h2 className="text-xl font-semibold mt-6">11. Contact</h2>
      <p>
        For privacy questions or to exercise the rights above, email{' '}
        <a href="mailto:hello@folioxtracker.com" className="underline">hello@folioxtracker.com</a>.
      </p>
    </LegalShell>
  );
}
