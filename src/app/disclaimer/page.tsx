import { LegalShell } from '@/components/layout/legal-shell';

export const metadata = { title: 'Disclaimer — FolioX Tracker' };

export default function DisclaimerPage() {
  return (
    <LegalShell title="Disclaimer" lastUpdated="2026-07-02">
      <h2 className="text-xl font-semibold mt-2">Not financial advice</h2>
      <p>
        FolioX Tracker is a personal record-keeping and analytics tool. The
        information it displays — including holdings, valuations, allocation
        drift, rebalance suggestions, gain/loss figures, and CAGR — is for
        general informational purposes only. It is <strong>not</strong>{' '}
        financial advice, investment advice, tax advice, or a recommendation
        to buy, sell, or hold any security, cryptocurrency, or other asset.
      </p>
      <p>
        Nothing in this service constitutes a financial product or service
        regulated under the <em>Corporations Act 2001</em> (Cth) or any
        equivalent legislation. We are not licensed to provide personal
        financial advice and we do not consider your objectives, financial
        situation, or needs.
      </p>
      <p>
        Before making any investment decision, you should obtain independent
        professional advice from a licensed financial adviser, and where
        relevant, consider the product disclosure statement of any financial
        product.
      </p>

      <h2 className="text-xl font-semibold mt-6">Data accuracy</h2>
      <p>
        Market prices are sourced from third-party providers (currently Yahoo
        Finance) and may be delayed, incomplete, or inaccurate. Imports from
        broker statements (CMC Markets, Stake, Swyftx, Independent Reserve)
        rely on file formats we do not control and may misclassify or miss
        transactions. You are responsible for verifying every figure shown
        against your broker, exchange, and tax records.
      </p>
      <p>
        Calculations such as average cost, profit/loss, and category drift
        are derived from your inputs. Bugs, edge cases, currency conversions,
        and corporate actions (splits, dividends, mergers) may produce
        incorrect results.
      </p>

      <h2 className="text-xl font-semibold mt-6">No warranty</h2>
      <p>
        The service is provided &quot;as is&quot; without warranty of any
        kind, express or implied, including warranties of merchantability,
        fitness for a particular purpose, and non-infringement. To the
        maximum extent permitted by law, we disclaim liability for any loss
        or damage — direct, indirect, consequential, or otherwise — arising
        from your use of the service or reliance on its data.
      </p>

      <h2 className="text-xl font-semibold mt-6">Currency</h2>
      <p>
        Values are displayed in Australian Dollars (AUD). Foreign-currency
        holdings are converted using exchange rates from third-party
        providers and may differ from rates used by your broker, exchange,
        or tax authority.
      </p>
    </LegalShell>
  );
}
