import { LegalShell } from '@/components/layout/legal-shell';

export const metadata = { title: 'Terms of Service — FolioX Tracker' };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" lastUpdated="2026-07-02">
      <p className="text-muted-foreground">
        These Terms govern your use of FolioX Tracker (&quot;the
        service&quot;), operated by FolioX Tracker (&quot;we&quot;,
        &quot;us&quot;). By creating an account or using the service, you
        agree to these Terms. If you do not agree, do not use the service.
      </p>

      <h2 className="text-xl font-semibold mt-6">1. Eligibility</h2>
      <p>
        You must be at least 18 years old to create an account. By signing
        up you represent that the information you provide is accurate and
        that you will keep it up to date.
      </p>

      <h2 className="text-xl font-semibold mt-6">2. Your account</h2>
      <p>
        You are responsible for keeping your sign-in credentials secure and
        for all activity that occurs under your account. Notify us
        immediately at hello@folioxtracker.com if you suspect unauthorised access.
      </p>

      <h2 className="text-xl font-semibold mt-6">3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul className="list-disc ml-6 space-y-1">
        <li>use the service for any unlawful purpose;</li>
        <li>access another user&apos;s account or data without permission;</li>
        <li>attempt to probe, scan, reverse-engineer, or interfere with the service or its underlying infrastructure;</li>
        <li>upload malware, send spam, or use the service to harass others;</li>
        <li>scrape or bulk-export the service&apos;s public pages;</li>
        <li>resell or sublicense the service.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6">4. Your data</h2>
      <p>
        You retain ownership of the portfolio data you enter or import.
        You grant us a non-exclusive licence to host, store, and process
        that data solely so we can provide the service to you. You can
        export your data or delete your account at any time from{' '}
        <a href="/settings" className="underline">Settings</a>.
      </p>

      <h2 className="text-xl font-semibold mt-6">5. Third-party data</h2>
      <p>
        Market prices and FX rates are obtained from third-party providers
        and are subject to their own terms. We do not warrant their
        accuracy, timeliness, or availability. See our{' '}
        <a href="/disclaimer" className="underline">Disclaimer</a> for
        details.
      </p>

      <h2 className="text-xl font-semibold mt-6">6. No financial advice</h2>
      <p>
        FolioX Tracker is informational only and does not provide
        financial, investment, tax, or legal advice. See the{' '}
        <a href="/disclaimer" className="underline">Disclaimer</a>.
      </p>

      <h2 className="text-xl font-semibold mt-6">7. Service availability</h2>
      <p>
        We provide the service on a &quot;best effort&quot; basis and do
        not guarantee uptime, performance, or freedom from defects. We
        may modify, suspend, or discontinue any part of the service at
        any time, with or without notice.
      </p>

      <h2 className="text-xl font-semibold mt-6">7a. Paid plans</h2>
      <p>
        Some features may be offered on a paid subscription. If you
        subscribe, charges are billed in advance through our payment
        processor and recur until you cancel. You can cancel at any time
        from your account; cancellation takes effect at the end of the
        current billing period and no partial refunds are issued unless
        required by law (including under the{' '}
        <em>Australian Consumer Law</em>). Prices are inclusive of GST
        where applicable. We may change prices on at least 30 days&apos;
        notice — the new price applies to the next billing cycle.
      </p>

      <h2 className="text-xl font-semibold mt-6">8. Termination</h2>
      <p>
        You may delete your account at any time. We may suspend or
        terminate your account if you breach these Terms or use the
        service in a way that risks harm to us, other users, or third
        parties. On termination, your data is deleted as described in our{' '}
        <a href="/privacy" className="underline">Privacy Policy</a>.
      </p>

      <h2 className="text-xl font-semibold mt-6">9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, the service is provided
        &quot;as is&quot; without warranty of any kind. We are not liable
        for any indirect, incidental, special, consequential, or
        exemplary damages, or for any loss of profits, revenue, data, or
        goodwill, arising from or in connection with your use of the
        service. Our total aggregate liability is limited to the amount
        you have paid us in the 12 months before the event giving rise
        to the claim, or AUD $100 if no fees have been paid.
      </p>
      <p>
        Nothing in these Terms excludes any consumer guarantee or other
        right that cannot be excluded under the{' '}
        <em>Australian Consumer Law</em> or other applicable mandatory
        law.
      </p>

      <h2 className="text-xl font-semibold mt-6">10. Changes</h2>
      <p>
        We may update these Terms from time to time. We will notify you
        of material changes via email or an in-app notice. Continued use
        of the service after the changes take effect constitutes
        acceptance of the updated Terms.
      </p>

      <h2 className="text-xl font-semibold mt-6">11. Governing law</h2>
      <p>
        These Terms are governed by the laws of New South Wales, Australia. The
        courts of New South Wales, Australia have exclusive jurisdiction over any
        dispute arising from these Terms or your use of the service.
      </p>

      <h2 className="text-xl font-semibold mt-6">12. Contact</h2>
      <p>
        Questions about these Terms? Email{' '}
        <a href="mailto:hello@folioxtracker.com" className="underline">hello@folioxtracker.com</a>.
      </p>
    </LegalShell>
  );
}
