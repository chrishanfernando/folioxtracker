'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, AlertTriangle, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useProfile } from '@/components/profile-context';
import { formatDate } from '@/lib/format';

interface ImportResult {
  transactions: number;
  prices?: number;
  assets: number;
  skipped?: number;
  corrected?: number;
  tickers?: string[];
}

interface PreviewRow {
  date: string;
  ticker: string;
  action: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: 'new' | 'duplicate' | 'correction' | 'unknown';
}

interface PreviewData {
  rows: PreviewRow[];
  newAssets: string[];
  summary: { new: number; duplicates: number; corrections: number; unknown?: number };
  tickers: string[];
  unknownTickers?: string[];
  warning?: string;
  prices?: number;
}

interface ExistingAsset { symbol: string; name: string; displayTicker: string; yahooSymbol: string; category: string }

// Suggest a canonical mapping for an unmapped source ticker. Stake ASX tickers
// carry a ".ASX" suffix; bare tickers are assumed US (NASDAQ), with the Yahoo
// symbol using "-" for "." (e.g. BRK.B → BRK-B).
function suggestMapping(source: string, sourceTicker: string) {
  if (source === 'stake' && sourceTicker.endsWith('.ASX')) {
    const t = sourceTicker.replace('.ASX', '');
    return { symbol: `ASX:${t}`, displayTicker: t, yahooSymbol: `${t}.AX` };
  }
  return { symbol: `NASDAQ:${sourceTicker}`, displayTicker: sourceTicker, yahooSymbol: sourceTicker.replace(/\./g, '-') };
}

// Inline form to resolve one unmapped ticker to a canonical asset. Saving
// persists a profile-scoped override; the caller re-runs the preview so the
// row re-resolves.
function TickerMapForm({ source, sourceTicker, onSaved }: { source: string; sourceTicker: string; onSaved: () => void }) {
  const { profileFetch } = useProfile();
  const s = suggestMapping(source, sourceTicker);
  const [symbol, setSymbol] = useState(s.symbol);
  const [name, setName] = useState('');
  const [displayTicker, setDisplayTicker] = useState(s.displayTicker);
  const [yahooSymbol, setYahooSymbol] = useState(s.yahooSymbol);
  const [category, setCategory] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState<'verify' | 'save' | null>(null);
  const [assets, setAssets] = useState<ExistingAsset[]>([]);

  useEffect(() => {
    profileFetch('/api/assets').then(r => r.json()).then((a) => Array.isArray(a) && setAssets(a)).catch(() => {});
  }, [profileFetch]);

  // An existing asset with the same Yahoo symbol → offer to reuse it rather
  // than mint a duplicate under a different exchange namespace.
  const match = assets.find(a => a.yahooSymbol.toLowerCase() === yahooSymbol.trim().toLowerCase());

  async function verify() {
    setBusy('verify');
    try {
      const res = await profileFetch('/api/import/ticker-override/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yahooSymbol: yahooSymbol.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) { setVerified(true); toast.success(`${yahooSymbol} verified · $${data.priceAud.toFixed(2)}`); }
      else { setVerified(false); toast.error(data.error || 'Could not verify symbol'); }
    } catch { toast.error('Could not verify symbol'); }
    finally { setBusy(null); }
  }

  async function save() {
    setBusy('save');
    try {
      const res = await profileFetch('/api/import/ticker-override', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, sourceTicker, symbol: symbol.trim(), name: name.trim(), displayTicker: displayTicker.trim(), yahooSymbol: yahooSymbol.trim(), category: category.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) { toast.success(`Mapped ${sourceTicker} → ${symbol}`); onSaved(); }
      else { toast.error(data.error || 'Could not save mapping'); }
    } catch { toast.error('Could not save mapping'); }
    finally { setBusy(null); }
  }

  const inputCls = 'w-full text-xs border rounded px-2 py-1 bg-background';
  const canSave = symbol.trim() && name.trim() && displayTicker.trim() && yahooSymbol.trim() && category.trim() && busy === null;

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <div className="text-xs font-medium">Map <span className="font-mono">{sourceTicker}</span></div>
      {match && (
        <button
          type="button"
          onClick={() => { setSymbol(match.symbol); setName(match.name); setDisplayTicker(match.displayTicker); setCategory(match.category); setYahooSymbol(match.yahooSymbol); }}
          className="w-full text-left text-[11px] text-blue-500 bg-blue-500/10 border border-blue-500/30 rounded px-2 py-1"
        >
          Matches existing asset <span className="font-mono">{match.symbol}</span> ({match.name}) — click to reuse it and avoid a duplicate
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-muted-foreground">Symbol
          <input className={inputCls} value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="NASDAQ:XYZ" />
        </label>
        <label className="text-[11px] text-muted-foreground">Category
          <input className={inputCls} value={category} onChange={e => setCategory(e.target.value)} placeholder="USA / World / China…" />
        </label>
        <label className="text-[11px] text-muted-foreground">Name
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Company / ETF name" />
        </label>
        <label className="text-[11px] text-muted-foreground">Display ticker
          <input className={inputCls} value={displayTicker} onChange={e => setDisplayTicker(e.target.value)} placeholder="XYZ" />
        </label>
        <label className="text-[11px] text-muted-foreground col-span-2">Yahoo symbol
          <div className="flex gap-2">
            <input className={inputCls} value={yahooSymbol} onChange={e => { setYahooSymbol(e.target.value); setVerified(false); }} placeholder="XYZ" />
            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={verify} disabled={busy !== null || !yahooSymbol.trim()}>
              {busy === 'verify' ? 'Verifying…' : verified ? '✓ Verified' : 'Verify'}
            </Button>
          </div>
        </label>
      </div>
      <div className="flex justify-end">
        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={!canSave}>
          {busy === 'save' ? 'Saving…' : 'Save mapping'}
        </Button>
      </div>
    </div>
  );
}

function PreviewTable({ preview, onConfirm, onCancel, confirming, source, onRemapped }: {
  preview: PreviewData;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
  source: string;
  onRemapped: () => void;
}) {
  const statusColors: Record<string, string> = {
    new: 'bg-green-500/10 text-gain border-green-500/30',
    duplicate: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    correction: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    unknown: 'bg-red-500/10 text-loss border-red-500/30',
  };

  return (
    <div className="space-y-4">
      {preview.warning && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
          <span className="text-yellow-500">{preview.warning}</span>
        </div>
      )}

      {(preview.summary.unknown ?? 0) > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-loss shrink-0" />
            <span className="text-loss">
              {preview.summary.unknown} row{(preview.summary.unknown ?? 0) === 1 ? '' : 's'} skipped — unmapped ticker
              {(preview.unknownTickers?.length ?? 0) > 0 ? `: ${preview.unknownTickers!.join(', ')}` : ''}. Map {(preview.unknownTickers?.length ?? 0) === 1 ? 'it' : 'them'} below to import.
            </span>
          </div>
          {(preview.unknownTickers ?? []).map(t => (
            <TickerMapForm key={t} source={source} sourceTicker={t} onSaved={onRemapped} />
          ))}
        </div>
      )}

      <div className="flex gap-4 text-sm">
        <span className="text-gain font-medium">{preview.summary.new} new</span>
        {preview.summary.duplicates > 0 && <span className="text-yellow-500 font-medium">{preview.summary.duplicates} duplicates</span>}
        {preview.summary.corrections > 0 && <span className="text-blue-500 font-medium">{preview.summary.corrections} corrections</span>}
        {(preview.summary.unknown ?? 0) > 0 && <span className="text-loss font-medium">{preview.summary.unknown} unmapped</span>}
        {preview.newAssets.length > 0 && <span className="text-muted-foreground">New assets: {preview.newAssets.join(', ')}</span>}
        {(preview.prices ?? 0) > 0 && <span className="text-muted-foreground">{preview.prices} prices</span>}
      </div>

      <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Ticker</th>
              <th className="text-left px-3 py-2 font-medium">Action</th>
              <th className="text-right px-3 py-2 font-medium">Qty</th>
              <th className="text-right px-3 py-2 font-medium">Price</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
              <th className="text-center px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-1.5 text-muted-foreground">{formatDate(row.date)}</td>
                <td className="px-3 py-1.5 font-medium">{row.ticker}</td>
                <td className="px-3 py-1.5">
                  <span className={row.action === 'BUY' ? 'text-gain' : 'text-loss'}>{row.action}</span>
                </td>
                <td className="px-3 py-1.5 text-right">{row.quantity < 1 ? row.quantity.toFixed(8) : row.quantity}</td>
                <td className="px-3 py-1.5 text-right">${row.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-1.5 text-right">${row.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="px-3 py-1.5 text-center">
                  <Badge variant="outline" className={`text-[10px] ${statusColors[row.status]}`}>
                    {row.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={confirming}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button onClick={onConfirm} disabled={confirming || (preview.summary.new === 0 && preview.summary.corrections === 0)}>
          {confirming ? 'Importing...' : `Confirm Import (${preview.summary.new + preview.summary.corrections} transactions)`}
        </Button>
      </div>
    </div>
  );
}

export default function ImportPage() {
  const { profileFetch, activeProfile } = useProfile();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [cmcFile, setCmcFile] = useState<File | null>(null);
  const [stakeFile, setStakeFile] = useState<File | null>(null);
  const [swyftxFile, setSwyftxFile] = useState<File | null>(null);
  const [irFile, setIrFile] = useState<File | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [excelResult, setExcelResult] = useState<ImportResult | null>(null);
  const [cmcResult, setCmcResult] = useState<ImportResult | null>(null);
  const [stakeResult, setStakeResult] = useState<ImportResult | null>(null);
  const [swyftxResult, setSwyftxResult] = useState<ImportResult | null>(null);
  const [irResult, setIrResult] = useState<ImportResult | null>(null);

  // Preview state
  const [excelPreview, setExcelPreview] = useState<PreviewData | null>(null);
  const [cmcPreview, setCmcPreview] = useState<PreviewData | null>(null);
  const [stakePreview, setStakePreview] = useState<PreviewData | null>(null);
  const [swyftxPreview, setSwyftxPreview] = useState<PreviewData | null>(null);
  const [irPreview, setIrPreview] = useState<PreviewData | null>(null);

  async function handlePreview(file: File, url: string, setPreview: (p: PreviewData | null) => void, key: string) {
    setImporting(key);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('preview', 'true');
    try {
      const res = await profileFetch(url, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.preview) {
        setPreview(data);
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error('Failed to preview file');
    } finally {
      setImporting(null);
    }
  }

  async function handleConfirm(file: File, url: string, setResult: (r: ImportResult | null) => void, setPreview: (p: PreviewData | null) => void, key: string, label: string) {
    setImporting(key);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await profileFetch(url, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setPreview(null);
        toast.success(`Imported ${data.transactions} transactions from ${label}`);
      } else {
        toast.error(data.error || 'Import failed');
      }
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(null);
    }
  }

  function renderImportCard(
    title: string,
    description: string,
    columns: string,
    example: string,
    accept: string,
    file: File | null,
    setFile: (f: File | null) => void,
    key: string,
    url: string,
    label: string,
    preview: PreviewData | null,
    setPreview: (p: PreviewData | null) => void,
    result: ImportResult | null,
    setResult: (r: ImportResult | null) => void,
    sampleHref?: string,
    sampleLabel?: string,
  ) {
    return (
      <Card key={key}>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
            {sampleHref && (
              <a
                href={sampleHref}
                download
                className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3 w-3" /> {sampleLabel || 'Sample'}
              </a>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/80 mt-1">
            <span className="font-medium">Columns:</span> {columns}
          </p>
          <p className="text-[11px] text-muted-foreground/70 font-mono mt-0.5 break-all">
            <span className="font-sans font-medium not-italic">Example:</span> {example}
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-2">
          {!preview && !result && (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 border rounded-md px-2 py-1.5 bg-muted/30">
                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="file"
                  accept={accept}
                  onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
                  className="block w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>
              <Button
                size="sm"
                onClick={() => file && handlePreview(file, url, setPreview, key)}
                disabled={!file || importing !== null}
              >
                {importing === key ? 'Parsing…' : 'Preview'}
              </Button>
            </div>
          )}

          {preview && file && (
            <PreviewTable
              preview={preview}
              onConfirm={() => handleConfirm(file, url, setResult, setPreview, key, label)}
              onCancel={() => setPreview(null)}
              confirming={importing === key}
              source={key}
              onRemapped={() => handlePreview(file, url, setPreview, key)}
            />
          )}

          {result && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-md p-2 flex items-center gap-2 text-xs">
              <CheckCircle className="h-4 w-4 text-gain shrink-0" />
              <span className="text-gain font-medium">Imported</span>
              <span className="text-muted-foreground">
                {result.transactions} tx
                {(result.prices ?? 0) > 0 && ` · ${result.prices} prices`}
                {(result.skipped ?? 0) > 0 && ` · ${result.skipped} skipped`}
                {(result.corrected ?? 0) > 0 && ` · ${result.corrected} corrected`}
                {' · '}{result.assets} assets
              </span>
              <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs" onClick={() => { setResult(null); setFile(null); }}>
                Import another
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Import Data</h1>
        <a
          href="/samples/README.md"
          target="_blank"
          rel="noopener"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Download className="h-3 w-3" /> All sample files
        </a>
      </div>

      <div className="space-y-3">
        {renderImportCard(
          'CMC Markets (CSV)',
          'Account statement CSV. Buys and sells are extracted automatically.',
          'Date, Type (CB/CS), Description, Debit, Credit',
          '15/03/2024, CB, "Bght 4 BIDU:US @ 273.8475", 1095.39, 0',
          '.csv', cmcFile, setCmcFile, 'cmc', '/api/import/cmc', 'CMC Transactions',
          cmcPreview, setCmcPreview, cmcResult, setCmcResult,
          '/samples/cmc-markets-sample.csv', 'Sample CSV',
        )}

        {renderImportCard(
          'Stake (Excel)',
          'Investment activity export (.xlsx). Reads both Aus and Wall St equities sheets.',
          'Trade Date, Settlement Date, Symbol, Name, Side, Trade Identifier, Units, Avg. Price, Value, Fees, GST, Total Value, Currency, AUD/USD Rate',
          '2024-03-15, 2024-03-17, AAPL, Apple Inc, Buy, TX12345, 10, 172.50, 1725.00, 3.00, 0.30, 1728.30, USD, 1.52',
          '.xlsx,.xls', stakeFile, setStakeFile, 'stake', '/api/import/stake', 'Stake Transactions',
          stakePreview, setStakePreview, stakeResult, setStakeResult,
          '/samples/stake-format-notes.txt', 'Format notes',
        )}

        {renderImportCard(
          'Swyftx (CSV)',
          'Transaction report CSV. Buys, sells, and cross-crypto trades are extracted.',
          'Date, Time, Event, Asset, Amount, Currency, Value, Fee, Fee Currency, AUD Value',
          '15/03/2024, 14:32, buy, BTC, 0.025, AUD, 1750.00, 0.5, AUD, 1750.00',
          '.csv', swyftxFile, setSwyftxFile, 'swyftx', '/api/import/swyftx', 'Swyftx Transactions',
          swyftxPreview, setSwyftxPreview, swyftxResult, setSwyftxResult,
          '/samples/swyftx-sample.csv', 'Sample CSV',
        )}

        {renderImportCard(
          'Independent Reserve (CSV)',
          'Transaction history CSV. BTC, ETH, and XRP trades are extracted.',
          'Settled, Date, Type, TradeGuid, OrderGuid, Status, Pair, Currency, Credit, Debit',
          'Yes, 11 Jan 2024 09:46:30 +11:00, Trade, abc-123, ord-456, Filled, Xbt-Aud, AUD, 0, 500.00',
          '.csv', irFile, setIrFile, 'ir', '/api/import/ir', 'Independent Reserve Transactions',
          irPreview, setIrPreview, irResult, setIrResult,
          '/samples/independent-reserve-sample.csv', 'Sample CSV',
        )}

        {renderImportCard(
          'Custom Portfolio Spreadsheet (Excel)',
          'Manage your own portfolio in a spreadsheet and upload it here. Replaces all existing spreadsheet-sourced transactions. An optional "Prices" sheet imports price history.',
          'Tx sheet: Date, Asset, Action (BUY/SELL), Quantity, Unit Price (Local), FX Rate, Unit Price (AUD), Split Multiplier, Adjusted Qty, Total (AUD), Comment. Prices sheet (optional): Date, then one column per asset symbol with the AUD price on that date.',
          'Tx: 2024-03-15, AAPL, BUY, 10, 172.50, 1.52, 262.20, 1, 10, 2622.00, "Bought on dip" — Prices: 2024-03-15, 262.20, 0.65, …',
          '.xlsx,.xls', excelFile, setExcelFile, 'excel', '/api/import', 'Excel Transactions',
          excelPreview, setExcelPreview, excelResult, setExcelResult,
          '/samples/generic-portfolio-template.csv', 'Sample template',
        )}

      </div>
    </AppShell>
  );
}
