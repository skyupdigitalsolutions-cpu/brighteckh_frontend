// Figma "SQ · PDF preview · Q-00087 / Q-00086 / Q-00084" 177:137693 / 177:137869 / 177:138026.
// Paper 177:137813: 620 × 880 white, p-40, column gap 14. Top: 44px logo mark + company (14/20 SemiBold name,
// 12/16 secondary "address · GSTIN") + right title ("QUOTATION" 11/14 SemiBold brand-text, number mono 13/18).
// 1px divider. "To / Equipment / Valid until" (label 12/16 secondary, value 14/20 Medium, gap 40). Lines:
// description flex · qty (mono secondary) · amount w-110 mono, py-8 border-b. Totals right, label/value gap 16,
// value w-120. Footer terms 12/16 secondary at the bottom. Close = 44px white circle 20px right of the paper.
//
// API reality: there is NO quote PDF endpoint and send emails nothing. This is NOT a PDF: it is the same data
// rendered in the browser, labelled "Preview", with a GapNote. Letterhead = GET /br08/entity-profile (legal name,
// address, GSTIN — GSTIN may be unset). Footer terms = the revision's terms_snapshot; Figma's "Payment 30 days from
// invoice" is not stored on the quote, so it is never hard-coded. Total = "—" (open decision, G-D-2).
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import logoMark from '../../../assets/brand/logo-mark.svg';
import { GapNote, Ic, Scrim, useDismiss } from '../../../ui/desktop';
import { formatDate, formatINR } from '../../../lib/format';
import { toPaise } from '../../purchase/quotes/money';
import { lineAmount, qtyUom, useEntityProfile, type SalesQuote, type SalesRevision } from './api';

/** entity-profile fields are typed Record<string, never> in the generated schema; they are nullable strings. */
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex w-full items-start justify-end gap-[16px] text-[14px] leading-[20px]">
      <p className={strong ? 'font-medium text-fg-2' : 'text-fg-2'}>{label}</p>
      <p className={strong ? 'w-[120px] text-right font-mono font-semibold text-fg' : 'w-[120px] text-right font-mono text-fg'}>{value}</p>
    </div>
  );
}

export function QuotePreview({ open, onClose, quote, rev, companyId, customerName, equipment }: {
  open: boolean;
  onClose: () => void;
  quote: SalesQuote;
  rev: SalesRevision;
  companyId: string;
  customerName: string;
  equipment: string;
}) {
  useDismiss(open, onClose);
  const profileQ = useEntityProfile(companyId);
  if (!open) return null;
  const p = profileQ.data;
  const company = str(p?.legal_name) ?? p?.name ?? null;
  const address = str(p?.registered_address);
  const gstin = str(p?.gstin);
  const sub = [address, gstin ? `GSTIN ${gstin}` : null].filter(Boolean).join(' · ');
  const freight = toPaise(rev.freight_charge);

  return createPortal(
    <>
      <Scrim alpha={0.55} onClick={onClose} z="z-40" />
      <div role="dialog" aria-modal="true" aria-label={`Preview ${quote.quote_number}`} className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-[72px]">
        <div className="pointer-events-auto relative flex flex-col items-center gap-[12px]">
          <article className="flex min-h-[880px] w-[620px] flex-col gap-[14px] rounded-[8px] bg-surface p-[40px] text-fg">
            <header className="flex w-full items-center gap-[12px]">
              <img src={logoMark} alt="" className="h-[43px] w-[44px] shrink-0" />
              <div className="flex min-w-px flex-1 flex-col gap-[2px]">
                <p className="text-[14px] font-semibold leading-[20px]">{company ?? (profileQ.isPending ? '…' : '—')}</p>
                {sub && <p className="text-[12px] leading-[16px] text-fg-2">{sub}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-[2px]">
                <p className="text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-brand-text">QUOTATION</p>
                <p className="font-mono text-[13px] font-medium leading-[18px]">{quote.quote_number} · r{rev.revision_no}</p>
              </div>
            </header>
            <div className="h-px w-full bg-line" />
            <div className="flex w-full items-start gap-[40px]">
              {([['To', customerName], ['Equipment', equipment], ['Valid until', rev.valid_until ? formatDate(rev.valid_until) : '—']] as const).map(([l, v]) => (
                <div key={l} className="flex flex-col gap-[2px]">
                  <p className="text-[12px] leading-[16px] text-fg-2">{l}</p>
                  <p className="text-[14px] font-medium leading-[20px]">{v}</p>
                </div>
              ))}
            </div>
            {rev.lines.map((l) => (
              <div key={l.id} className="flex w-full items-center gap-[10px] border-b border-line py-[8px] text-[14px] leading-[20px]">
                <p className="min-w-px flex-1">{l.line_description}</p>
                <p className="shrink-0 whitespace-nowrap font-mono text-fg-2">{qtyUom(l)}</p>
                <p className="w-[110px] shrink-0 text-right font-mono">{lineAmount(l)}</p>
              </div>
            ))}
            <Row label="Subtotal" value={formatINR(rev.revised_pre_tax)} />
            {freight != null && freight !== 0n && <Row label="Freight" value={formatINR(rev.freight_charge)} />}
            <Row label="Tax" value={formatINR(rev.tax_total)} />
            <Row label="Total" value="—" strong />
            <div className="min-h-px flex-1" />
            {str(rev.terms_snapshot) && <p className="whitespace-pre-line text-[12px] leading-[16px] text-fg-2">{rev.terms_snapshot}</p>}
          </article>
          <div className="w-[620px]">
            <GapNote code="G-S7">No quote PDF exists in the API. This preview is drawn in the browser from the same data; it is not a file and nothing is sent to the customer. Total: composition is an open client decision (G-D-2).</GapNote>
          </div>
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="absolute -right-[64px] top-0 flex h-[44px] w-[44px] items-center justify-center rounded-full bg-surface text-fg"
          >
            <Ic icon={IconX} size={20} />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
