import * as XLSX from 'xlsx';
import { CMC_TICKER_MAP, SWYFTX_TICKER_MAP, IR_TICKER_MAP, resolveCmcTicker } from './ticker-map';

export interface ParsedTransaction {
  date: string;
  asset: string;
  action: string;
  quantity: number;
  unitPriceLocal: number | null;
  fxRate: number | null;
  unitPriceAud: number;
  splitMultiplier: number;
  adjustedQty: number;
  totalAud: number;
  comment: string | null;
}

function excelDateToISO(serial: number): string {
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

export function parseTransactionsFromExcel(buffer: ArrayBuffer): ParsedTransaction[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets['Tx'];
  if (!ws) throw new Error('No "Tx" sheet found in workbook');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown as unknown[][];
  const transactions: ParsedTransaction[] = [];

  // Skip header row (row 0), data starts at row 1
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || !row[1]) continue; // Skip empty rows

    const dateRaw = row[0];
    const assetSymbol = String(row[1]).trim();
    const action = String(row[3] || '').trim().toUpperCase();

    if (!action || (action !== 'BUY' && action !== 'SELL')) continue;

    const date = typeof dateRaw === 'number' ? excelDateToISO(dateRaw) : String(dateRaw);
    const quantity = Math.abs(Number(row[4]) || 0);
    const unitPriceLocal = row[5] != null ? Number(row[5]) : null;
    const fxRate = row[6] != null ? Number(row[6]) : null;
    const unitPriceAud = Number(row[7]) || 0;
    const splitMultiplier = Number(row[8]) || 1;
    const adjustedQty = Number(row[9]) || quantity * splitMultiplier;
    const totalAud = Math.abs(Number(row[12]) || (unitPriceAud * quantity));
    const comment = row[18] ? String(row[18]) : null;

    transactions.push({
      date,
      asset: assetSymbol,
      action,
      quantity,
      unitPriceLocal,
      fxRate,
      unitPriceAud,
      splitMultiplier,
      adjustedQty,
      totalAud,
      comment,
    });
  }

  return transactions;
}

export interface ParsedCmcTransaction {
  date: string;
  assetSymbol: string; // Our internal symbol key (e.g., 'NYSE:BABA')
  cmcTicker: string;   // Original CMC ticker (e.g., 'BABA:US')
  action: 'BUY' | 'SELL';
  quantity: number;
  unitPriceAud: number;
  totalAud: number;
  feeAud: number | null;
}

// CMC folds brokerage into the ledger Debit/Credit amount rather than listing
// it in its own column. For AUD trades it is exactly recoverable as the gap
// between the cash movement and qty × price. Guard against FX/odd rows: a
// negative or implausibly large gap means "not a simple AUD trade" → unknown.
function deriveCmcFeeAud(action: 'BUY' | 'SELL', quantity: number, unitPrice: number, totalAud: number): number | null {
  const tradeValue = quantity * unitPrice;
  const gap = action === 'BUY' ? totalAud - tradeValue : tradeValue - totalAud;
  const fee = Math.round(gap * 100) / 100;
  if (fee < 0 || fee > Math.max(100, tradeValue * 0.05)) return null;
  return fee;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

export function parseCmcCsv(text: string): ParsedCmcTransaction[] {
  const lines = text.split('\n');
  const transactions: ParsedCmcTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);
    if (fields.length < 7) continue;

    const [dateStr, , type, description, debitStr, creditStr] = fields;

    if (type !== 'CB' && type !== 'CS') continue;

    // Parse: "Bght 4 BIDU:US @ 273.8475" or "Sold 9 GOLD @ 226.8800 AUD"
    const match = description.match(/^(Bght|Sold)\s+(\d+)\s+(\S+)\s+@\s+([\d\s,.]+?)(?:\s+AUD)?$/);
    if (!match) continue;

    const action = match[1] === 'Bght' ? 'BUY' : 'SELL';
    const quantity = parseInt(match[2]);
    const cmcTicker = match[3];
    const unitPriceAud = parseFloat(match[4].replace(/[\s,]/g, ''));

    // Try explicit map first, then auto-resolve by convention
    let assetSymbol: string | null = CMC_TICKER_MAP[cmcTicker] ?? null;
    if (!assetSymbol) {
      assetSymbol = resolveCmcTicker(cmcTicker);
    }
    if (!assetSymbol) {
      console.warn(`Unknown CMC ticker: ${cmcTicker}`);
      continue;
    }

    // DD/MM/YYYY → YYYY-MM-DD
    const [day, month, year] = dateStr.split('/');
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    // Total from Debit (buys) or Credit (sells) - includes brokerage
    const totalAud = action === 'BUY'
      ? parseFloat(debitStr.replace(/,/g, '') || '0')
      : parseFloat(creditStr.replace(/,/g, '') || '0');

    if (!quantity || !unitPriceAud || !totalAud) continue;

    const feeAud = deriveCmcFeeAud(action, quantity, unitPriceAud, totalAud);
    transactions.push({ date, assetSymbol, cmcTicker, action, quantity, unitPriceAud, totalAud, feeAud });
  }

  return transactions;
}

// A fully-computed Stake buy/sell row, tagged with its raw broker ticker.
// Resolution of `stakeTicker` → canonical asset symbol is deliberately NOT done
// here: the import route owns it so it can consult profile-scoped DB overrides
// (which the parser has no access to). See `resolveAssetSymbol` in ticker-map.ts.
export interface ParsedStakeRow {
  date: string;
  stakeTicker: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  unitPriceLocal: number;
  unitPriceAud: number;
  totalAud: number;
  localCurrency: string;
  fxRate: number | null;
  feeAud: number | null;
}

export function parseStakeXlsx(buffer: ArrayBuffer): ParsedStakeRow[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const rows_: ParsedStakeRow[] = [];

  // Process both Aus and Wall St sheets
  for (const sheetName of ['Aus Equities', 'Wall St Equities']) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown as unknown[][];
    if (rows.length < 2) continue;

    const isUS = sheetName === 'Wall St Equities';

    // Row 0 is headers, data starts at row 1
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;

      // Columns: Trade Date, Settlement Date, Symbol, Name, Side, Trade Identifier, Units, Avg. Price, Value, Fees, GST, Total Value, Currency, [AUD/USD rate]
      const tradeDate = String(row[0]); // Already YYYY-MM-DD
      const stakeTicker = String(row[2]).trim();
      const side = String(row[4]).trim();
      const units = Number(row[6]) || 0;
      const avgPrice = Number(row[7]) || 0;
      const fees = Number(row[9]) || 0;
      const gst = Number(row[10]) || 0;
      const totalValue = Number(row[11]) || 0;
      // Brokerage = Fees + GST in the sheet's local currency.
      const feeLocal = fees + gst;

      if (!units || !avgPrice || (side !== 'Buy' && side !== 'Sell')) continue;

      const action = side === 'Buy' ? 'BUY' : 'SELL';

      if (isUS) {
        // Wall St: prices in USD, AUD/USD rate column is USD→AUD multiplier
        const rateStr = String(row[13] || '').replace('$', '');
        const usdToAud = parseFloat(rateStr) || 1;
        rows_.push({
          date: tradeDate,
          stakeTicker,
          action,
          quantity: units,
          unitPriceLocal: avgPrice,
          unitPriceAud: avgPrice * usdToAud,
          totalAud: totalValue * usdToAud,
          localCurrency: 'USD',
          fxRate: usdToAud,
          feeAud: Math.round(feeLocal * usdToAud * 100) / 100,
        });
      } else {
        // Aus: already in AUD
        rows_.push({
          date: tradeDate,
          stakeTicker,
          action,
          quantity: units,
          unitPriceLocal: avgPrice,
          unitPriceAud: avgPrice,
          totalAud: totalValue,
          localCurrency: 'AUD',
          fxRate: null,
          feeAud: Math.round(feeLocal * 100) / 100,
        });
      }
    }
  }

  return rows_;
}

export interface ParsedSwyftxTransaction {
  date: string;
  assetSymbol: string;
  swyftxTicker: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  unitPriceAud: number;
  totalAud: number;
  feeAud: number | null;
}

export function parseSwyftxCsv(text: string): ParsedSwyftxTransaction[] {
  const lines = text.split('\n');
  const transactions: ParsedSwyftxTransaction[] = [];

  // Find the crypto transactions header row
  let dataStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Date,Time,Event,Asset,')) {
      dataStart = i + 1;
      break;
    }
  }
  if (dataStart === -1) return transactions;

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith(',,sub total') || line.startsWith('Fiat Transactions')) break;

    const fields = parseCsvLine(line);
    if (fields.length < 10) continue;

    const dateStr = fields[0];
    const event = fields[2];
    const asset = fields[3];
    const amount = parseFloat(fields[4]) || 0;
    const currency = fields[5];
    const value = parseFloat(fields[6]) || 0;
    // "Fees" column — AUD-denominated for AUD-settled trades.
    const feesRaw = parseFloat(fields[8]);
    const feeAud = Number.isFinite(feesRaw) && feesRaw >= 0 ? Math.round(feesRaw * 100) / 100 : null;
    const audValue = parseFloat(fields[9]) || 0;

    if (!dateStr || !event || !amount) continue;

    // Parse date: D/MM/YYYY → YYYY-MM-DD
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) continue;
    const date = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;

    if (event === 'buy' && currency === 'AUD') {
      // Buying crypto with AUD
      const assetSymbol = SWYFTX_TICKER_MAP[asset];
      if (!assetSymbol) continue;

      transactions.push({
        date,
        assetSymbol,
        swyftxTicker: asset,
        action: 'BUY',
        quantity: amount,
        unitPriceAud: amount > 0 ? audValue / amount : 0,
        totalAud: audValue,
        feeAud,
      });
    } else if (event === 'sell' && currency === 'AUD') {
      // Selling crypto for AUD
      const assetSymbol = SWYFTX_TICKER_MAP[asset];
      if (!assetSymbol) continue;

      transactions.push({
        date,
        assetSymbol,
        swyftxTicker: asset,
        action: 'SELL',
        quantity: amount,
        unitPriceAud: amount > 0 ? audValue / amount : 0,
        totalAud: audValue,
        feeAud,
      });
    } else if (event === 'sell' && currency && currency !== 'AUD') {
      // Cross-crypto trade: selling Asset for Currency (e.g., sell ETH for BTC)
      // Leg 1: SELL the source asset
      const sourceSymbol = SWYFTX_TICKER_MAP[asset];
      if (sourceSymbol) {
        transactions.push({
          date,
          assetSymbol: sourceSymbol,
          swyftxTicker: asset,
          action: 'SELL',
          quantity: amount,
          unitPriceAud: amount > 0 ? audValue / amount : 0,
          totalAud: audValue,
          // Cross-crypto trade fee attaches to the sell leg only, so the one
          // fee isn't double-counted across both synthesized legs.
          feeAud,
        });
      }

      // Leg 2: BUY the target asset (Currency column = target, Value column = qty received)
      const targetSymbol = SWYFTX_TICKER_MAP[currency];
      if (targetSymbol && value > 0) {
        transactions.push({
          date,
          assetSymbol: targetSymbol,
          swyftxTicker: currency,
          action: 'BUY',
          quantity: value,
          unitPriceAud: value > 0 ? audValue / value : 0,
          totalAud: audValue,
          feeAud: null,
        });
      }
    }
  }

  return transactions;
}

export interface ParsedIRTransaction {
  date: string;
  assetSymbol: string;
  irCurrency: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  unitPriceAud: number;
  totalAud: number;
}

export function parseIndependentReserveCsv(text: string): ParsedIRTransaction[] {
  const lines = text.split('\n');
  const transactions: ParsedIRTransaction[] = [];

  // Skip "sep=," line and header
  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Settled,')) {
      dataStart = i + 1;
      break;
    }
  }
  if (dataStart === 0) return transactions;

  // Group rows by TradeGuid — each trade has an AUD leg and a crypto leg
  const tradeMap = new Map<string, { currency: string; credit: number; debit: number; date: string }[]>();

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);
    if (fields.length < 8) continue;

    const dateStr = fields[1]; // Date column
    const tradeGuid = fields[3];
    const currency = fields[7];
    const credit = parseFloat(fields[8]) || 0;
    const debit = parseFloat(fields[9]) || 0;

    if (!tradeGuid || !currency) continue;

    if (!tradeMap.has(tradeGuid)) tradeMap.set(tradeGuid, []);
    tradeMap.get(tradeGuid)!.push({ currency, credit, debit, date: dateStr });
  }

  for (const [, legs] of tradeMap) {
    const audLeg = legs.find(l => l.currency === 'AUD');
    const cryptoLeg = legs.find(l => l.currency !== 'AUD');
    if (!audLeg || !cryptoLeg) continue;

    const assetSymbol = IR_TICKER_MAP[cryptoLeg.currency];
    if (!assetSymbol) {
      console.warn(`Unknown IR currency: ${cryptoLeg.currency}`);
      continue;
    }

    // AUD Debit = buying crypto, AUD Credit = selling crypto
    const isBuy = audLeg.debit > 0;
    const audAmount = isBuy ? audLeg.debit : audLeg.credit;
    const cryptoAmount = isBuy ? cryptoLeg.credit : cryptoLeg.debit;

    if (!audAmount || !cryptoAmount) continue;

    // Parse date: "11 Jan 2024 09:46:30 +11:00" → YYYY-MM-DD
    const dateMatch = audLeg.date.match(/(\d+)\s+(\w+)\s+(\d{4})/);
    if (!dateMatch) continue;
    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const date = `${dateMatch[3]}-${months[dateMatch[2]] || '01'}-${dateMatch[1].padStart(2, '0')}`;

    transactions.push({
      date,
      assetSymbol,
      irCurrency: cryptoLeg.currency,
      action: isBuy ? 'BUY' : 'SELL',
      quantity: cryptoAmount,
      unitPriceAud: cryptoAmount > 0 ? audAmount / cryptoAmount : 0,
      totalAud: audAmount,
    });
  }

  // Sort by date ascending
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  return transactions;
}

export interface ParsedPrice {
  date: string;
  asset: string;
  priceAud: number;
}

export function parsePricesFromExcel(buffer: ArrayBuffer): ParsedPrice[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets['Prices'];
  if (!ws) throw new Error('No "Prices" sheet found in workbook');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown as unknown[][];
  const prices: ParsedPrice[] = [];

  // Row 0: "PRICE ON DATE (AUD)" header
  // Row 1: column headers (asset symbols)
  const headers = rows[1] as string[];

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;

    const dateRaw = row[0];
    const date = typeof dateRaw === 'number' ? excelDateToISO(dateRaw) : String(dateRaw);

    for (let j = 1; j < headers.length; j++) {
      const asset = String(headers[j]).trim();
      const price = Number(row[j]);
      if (!asset || isNaN(price) || price <= 0) continue;

      prices.push({ date, asset, priceAud: price });
    }
  }

  return prices;
}
