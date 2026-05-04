import { CMC_TICKER_MAP, resolveCmcTicker } from '@/lib/ticker-map';

export interface ParsedCmcEmailTransaction {
  date: string;
  assetSymbol: string;
  cmcTicker: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  unitPriceAud: number;
  totalAud: number;
  accountNumber: string;
  confirmationNo: string;
}

export function parseCmcConfirmationPdf(pdfText: string): ParsedCmcEmailTransaction | null {
  try {
    // Determine action from header
    const isBuy = /BUY\s+CONFIRMATION/i.test(pdfText);
    const isSell = /SELL\s+CONFIRMATION/i.test(pdfText);
    if (!isBuy && !isSell) return null;
    const action = isBuy ? 'BUY' : 'SELL';

    // Extract account number (appears near top of document, typically a numeric string)
    const accountMatch = pdfText.match(/(?:Account|A\/C)\s*(?:No\.?|Number)?\s*:?\s*(\d{6,})/i);
    const accountNumber = accountMatch?.[1] ?? '';

    // Extract confirmation number
    const confirmMatch = pdfText.match(/Confirmation\s+No\.?\s*:?\s*(\d+)/i);
    const confirmationNo = confirmMatch?.[1] ?? '';

    // Extract transaction date (DD/MM/YYYY)
    const dateMatch = pdfText.match(/Transaction\s+Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (!dateMatch) return null;
    const [day, month, year] = dateMatch[1].split('/');
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    // Extract financial product ticker
    // The PDF has "Financial Product" followed by the ticker and name
    const productMatch = pdfText.match(/Financial\s+Product\s*:?\s*(\S+)/i);
    if (!productMatch) return null;
    const cmcTicker = productMatch[1].replace(/[,;]$/, '');

    // Resolve to internal asset symbol
    let assetSymbol: string | null = CMC_TICKER_MAP[cmcTicker] ?? null;
    if (!assetSymbol) {
      assetSymbol = resolveCmcTicker(cmcTicker);
    }
    if (!assetSymbol) return null;

    // Extract quantity, price, and consideration from the table
    // Look for the pattern: quantity, price, consideration (dollar amount)
    const quantityMatch = pdfText.match(/(\d+)\s+([\d,.]+)\s+\$([\d,.]+)/);
    if (!quantityMatch) return null;

    const quantity = parseInt(quantityMatch[1]);
    const unitPriceAud = parseFloat(quantityMatch[2].replace(/,/g, ''));

    // Extract total amount payable
    const totalMatch = pdfText.match(/Total\s+Amount\s+Payable[^$]*\$([\d,.]+)/i);
    const totalAud = totalMatch
      ? parseFloat(totalMatch[1].replace(/,/g, ''))
      : quantity * unitPriceAud;

    if (!quantity || !unitPriceAud) return null;

    return {
      date,
      assetSymbol,
      cmcTicker,
      action,
      quantity,
      unitPriceAud,
      totalAud,
      accountNumber,
      confirmationNo,
    };
  } catch (error) {
    console.error('Failed to parse CMC confirmation PDF:', error);
    return null;
  }
}
