'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, Download, AlertTriangle, X } from 'lucide-react';
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
  status: 'new' | 'duplicate' | 'correction';
}

interface PreviewData {
  rows: PreviewRow[];
  newAssets: string[];
  summary: { new: number; duplicates: number; corrections: number };
  tickers: string[];
  warning?: string;
  prices?: number;
}

function PreviewTable({ preview, onConfirm, onCancel, confirming }: {
  preview: PreviewData;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  const statusColors: Record<string, string> = {
    new: 'bg-green-500/10 text-green-500 border-green-500/30',
    duplicate: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    correction: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  };

  return (
    <div className="space-y-4">
      {preview.warning && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
          <span className="text-yellow-500">{preview.warning}</span>
        </div>
      )}

      <div className="flex gap-4 text-sm">
        <span className="text-green-500 font-medium">{preview.summary.new} new</span>
        {preview.summary.duplicates > 0 && <span className="text-yellow-500 font-medium">{preview.summary.duplicates} duplicates</span>}
        {preview.summary.corrections > 0 && <span className="text-blue-500 font-medium">{preview.summary.corrections} corrections</span>}
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
                  <span className={row.action === 'BUY' ? 'text-green-500' : 'text-red-500'}>{row.action}</span>
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
  const [backfilling, setBackfilling] = useState(false);
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

  async function handleBackfill() {
    setBackfilling(true);
    try {
      const res = await profileFetch('/api/prices/backfill', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const ok = data.results.filter((r: { weekly: number; daily: number }) => r.weekly > 0 || r.daily > 0).length;
        const total = data.results.reduce((sum: number, r: { weekly: number; daily: number }) => sum + r.weekly + r.daily, 0);
        toast.success(`Fetched ${total.toLocaleString()} prices for ${ok}/${data.results.length} assets`);
      } else {
        toast.error(data.error || 'Backfill failed');
      }
    } catch {
      toast.error('Backfill failed');
    } finally {
      setBackfilling(false);
    }
  }

  function renderImportCard(
    title: string,
    description: string,
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
  ) {
    return (
      <Card key={key}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!preview && (
            <>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-4" />
                <input
                  type="file"
                  accept={accept}
                  onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {file && <p className="mt-2 text-sm text-muted-foreground">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
              </div>

              <Button
                onClick={() => file && handlePreview(file, url, setPreview, key)}
                disabled={!file || importing !== null}
                className="w-full"
              >
                {importing === key ? 'Parsing...' : `Import ${label}`}
              </Button>
            </>
          )}

          {preview && file && (
            <PreviewTable
              preview={preview}
              onConfirm={() => handleConfirm(file, url, setResult, setPreview, key, label)}
              onCancel={() => setPreview(null)}
              confirming={importing === key}
            />
          )}

          {result && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="font-semibold text-green-500">Import Successful</p>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>{result.assets} assets referenced</li>
                <li>{result.transactions} new transactions imported</li>
                {(result.prices ?? 0) > 0 && <li>{result.prices} price records imported</li>}
                {(result.skipped ?? 0) > 0 && <li>{result.skipped} duplicates skipped</li>}
                {(result.corrected ?? 0) > 0 && <li>{result.corrected} existing transactions corrected</li>}
                {result.tickers && <li>Tickers: {result.tickers.join(', ')}</li>}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Import Data</h1>

      <div className="space-y-6">
        {renderImportCard(
          'Portfolio Spreadsheet (Excel)',
          'Upload your portfolio Excel file (.xlsx). Only the "Tx" sheet is required. This replaces all existing Excel-sourced transactions.',
          '.xlsx,.xls', excelFile, setExcelFile, 'excel', '/api/import', 'Excel Transactions',
          excelPreview, setExcelPreview, excelResult, setExcelResult,
        )}

        {renderImportCard(
          'CMC Markets (CSV)',
          'Upload a CMC Markets account statement CSV. Buys and sells are extracted automatically.',
          '.csv', cmcFile, setCmcFile, 'cmc', '/api/import/cmc', 'CMC Transactions',
          cmcPreview, setCmcPreview, cmcResult, setCmcResult,
        )}

        {renderImportCard(
          'Stake (Excel)',
          'Upload a Stake investment activity export (.xlsx). Reads both Aus and Wall St equities sheets.',
          '.xlsx,.xls', stakeFile, setStakeFile, 'stake', '/api/import/stake', 'Stake Transactions',
          stakePreview, setStakePreview, stakeResult, setStakeResult,
        )}

        {renderImportCard(
          'Swyftx (CSV)',
          'Upload a Swyftx transaction report CSV. Buys, sells, and cross-crypto trades are extracted.',
          '.csv', swyftxFile, setSwyftxFile, 'swyftx', '/api/import/swyftx', 'Swyftx Transactions',
          swyftxPreview, setSwyftxPreview, swyftxResult, setSwyftxResult,
        )}

        {renderImportCard(
          'Independent Reserve (CSV)',
          'Upload an Independent Reserve transaction history CSV. BTC, ETH, and XRP trades are extracted.',
          '.csv', irFile, setIrFile, 'ir', '/api/import/ir', 'Independent Reserve Transactions',
          irPreview, setIrPreview, irResult, setIrResult,
        )}

        <Card>
          <CardHeader>
            <CardTitle>Fetch Historical Prices</CardTitle>
            <CardDescription>
              Download historical prices from Yahoo Finance for all active assets,
              going back to your earliest transaction. This may take a minute.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackfill} disabled={backfilling} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {backfilling ? 'Fetching prices... (this takes ~1 min)' : 'Fetch Historical Prices from Yahoo Finance'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
