// FI1 / FI2 shared invoice pieces (F-D 247:52557 / 247:53559).
// Lines table: Item grow · HSN 90 (Data/Number) · Qty 70 right · Rate 110 right · Taxable 120 right (Data/Number strong);
// rows py-9 with a bottom border. Totals 247:52611: right-aligned rows, gap 6, label 14/20 secondary + value 140 wide
// right (Data/Number); "Invoice total" label Medium + value SemiBold.
// Tax rows are the server's paise: INTRA_STATE → CGST + SGST, INTER_STATE → IGST. The rate in the label is the server's
// line rate, shown only when every line carries the same one. No tax is computed here.
import { formatPaise, formatQty } from '../../../../lib/format';
import { T } from '../text';
import { DetailRow, HeadRow, Td, Th } from '../ui';

export type InvoiceLineView = {
  key: string; description: string; hsn: string; qty: string; rate: string; taxable: string;
  cgstRate: string; sgstRate: string; igstRate: string;
};

const W = { hsn: 90, qty: 70, rate: 110, taxable: 120 };

export function InvoiceLinesTable({ lines }: { lines: InvoiceLineView[] }) {
  return (
    <div className="flex w-full flex-col">
      <HeadRow>
        <Th grow>Item</Th><Th w={W.hsn}>HSN</Th><Th w={W.qty} right>Qty</Th><Th w={W.rate} right>Rate</Th><Th w={W.taxable} right>Taxable</Th>
      </HeadRow>
      {lines.map((l) => (
        <DetailRow key={l.key}>
          <Td grow><span className={T.strong} title={l.description}>{l.description}</span></Td>
          <Td w={W.hsn}><span className={T.num}>{l.hsn}</span></Td>
          <Td w={W.qty} right><span className={T.num}>{l.qty}</span></Td>
          <Td w={W.rate} right><span className={T.num}>{formatPaise(l.rate)}</span></Td>
          <Td w={W.taxable} right><span className={T.numStrong}>{formatPaise(l.taxable)}</span></Td>
        </DetailRow>
      ))}
    </div>
  );
}

const pct = (rates: string[]) => {
  const u = [...new Set(rates.map((r) => formatQty(r)))];
  return u.length === 1 ? ` ${u[0]} %` : '';
};

export function TaxTotals({ regime, lines, sub, cgst, sgst, igst, total, words }: {
  regime: 'INTRA_STATE' | 'INTER_STATE'; lines: InvoiceLineView[]; sub: string; cgst: string; sgst: string; igst: string; total: string; words?: string;
}) {
  const rows: [string, string, boolean?][] = [['Taxable value', sub]];
  if (regime === 'INTRA_STATE') {
    rows.push([`CGST${pct(lines.map((l) => l.cgstRate))}`, cgst], [`SGST${pct(lines.map((l) => l.sgstRate))}`, sgst]);
  } else {
    rows.push([`IGST${pct(lines.map((l) => l.igstRate))}`, igst]);
  }
  rows.push(['Invoice total', total, true]);
  return (
    <div className="flex w-full flex-col items-end gap-[6px] overflow-clip text-[14px] leading-[20px]">
      {rows.map(([k, v, strong]) => (
        <div key={k} className="flex items-start gap-[24px] overflow-clip">
          <p className={strong ? 'whitespace-nowrap font-medium text-fg-2' : 'whitespace-nowrap text-fg-2'}>{k}</p>
          <p className={strong ? 'w-[140px] text-right font-mono font-semibold text-fg' : 'w-[140px] text-right font-mono text-fg'}>{formatPaise(v)}</p>
        </div>
      ))}
      {words && <p className="text-[12px] leading-[16px] text-fg-2">{words}</p>}
    </div>
  );
}
