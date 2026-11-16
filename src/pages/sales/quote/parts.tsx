// Presentational pieces of the Sales quote view (S-D section 177:137224). Read-only: Sales never edits a price.
// Rule 1 (Figma 9:393 / 9:220): supplier cost, margin, reference/procurement offers and estimate ids are ABSENT
// for Sales — nothing here reads reference_offer_line_id, procurement_offer_line_id, estimate_revision_id,
// source_estimate_cost_line_id, higher_discount_* or discount_requested_by_id.
import type { ReactNode } from 'react';
import { IconLock } from '@tabler/icons-react';
import { Badge, GapNote, Ic, cx } from '../../../ui/desktop';
import { enumLabel, formatINR } from '../../../lib/format';
import type { Tone } from '../../../lib/tones';
import { paiseToDec, toPaise } from '../../purchase/quotes/money';
import { lineAmount, qtyUom, type QuoteLine, type SalesQuote, type SalesRevision, type SalesStage, type ResponseEvent } from './api';

// ------------------------------------------------------------------ badges
const STAGE_TONE: Record<SalesStage, Tone> = {
  TO_SEND: 'progress', AWAITING: 'progress', IN_DISCUSSION: 'progress', ACCEPTED: 'success', REJECTED: 'blocked', EXPIRED: 'blocked', OTHER: 'neutral',
};
/** Response-card badge (177:138958): AWAITING RESPONSE, or the latest response type of this revision. */
export function OutcomeBadge({ stage, latest }: { stage: SalesStage; latest?: ResponseEvent }) {
  const label = stage === 'AWAITING' ? 'AWAITING RESPONSE' : latest ? enumLabel(latest.response_type) : enumLabel(stage);
  return <Badge tone={STAGE_TONE[stage]} label={label} />;
}
/** Locked-banner badge (177:138922): SENT while awaiting, else the derived outcome (BR-04 status stays SENT). */
export function BannerBadge({ rev, stage, latest }: { rev: SalesRevision; stage: SalesStage; latest?: ResponseEvent }) {
  if (stage === 'AWAITING' || stage === 'TO_SEND' || !latest) return <Badge tone={rev.quote_status === 'SUPERSEDED' ? 'neutral' : 'progress'} label={enumLabel(rev.quote_status)} />;
  return <Badge tone={STAGE_TONE[stage]} label={enumLabel(latest.response_type)} />;
}

// ------------------------------------------------------------------ small pieces
/** 177:137388 "Price set by Purchase · read-only": bg-subtle radius 14, pl-10 pr-12 py-6, gap 6, 14px lock, 12/16 secondary. */
export function LockChip({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-[6px] overflow-clip rounded-[14px] bg-subtle py-[6px] pl-[10px] pr-[12px]">
      <Ic icon={IconLock} size={14} className="text-fg-2" />
      <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{children}</span>
    </div>
  );
}
/** 177:138972 footnote: 14px lock + 12/16 secondary, gap 8. */
export function LockNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-[8px] overflow-clip">
      <Ic icon={IconLock} size={14} className="text-fg-2" />
      <p className="text-[12px] leading-[16px] text-fg-2">{children}</p>
    </div>
  );
}
/** 177:138919 Locked banner: bg-subtle radius 18, px-16 py-12, gap 10, 18px lock, 14/20 secondary, badge right. */
export function LockedBanner({ children, badge }: { children: ReactNode; badge: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip rounded-[18px] bg-subtle px-[16px] py-[12px]">
      <Ic icon={IconLock} size={18} className="text-fg-2" />
      <p className="min-w-px flex-1 text-[14px] leading-[20px] text-fg-2">{children}</p>
      {badge}
    </div>
  );
}
/** 177:137392 meta item: label 12/16 secondary, value 14/20 Medium (mono 13/18 Medium for ids), gap 2. */
export function MetaItem({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
      <p className="text-[12px] leading-[16px] text-fg-2">{label}</p>
      <p className={mono ? 'font-mono text-[13px] font-medium leading-[18px] text-fg' : 'text-[14px] font-medium leading-[20px] text-fg'}>{value}</p>
    </div>
  );
}
/** 177:138959 detail row: label w-90 secondary, value Medium flex-1, gap 10. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full items-start gap-[10px] overflow-clip text-[14px] leading-[20px]">
      <p className="w-[90px] shrink-0 text-fg-2">{label}</p>
      <div className="min-w-px flex-1 break-words font-medium text-fg">{children}</div>
    </div>
  );
}
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('glass-strong flex flex-col items-start overflow-clip rounded-[24px] p-[24px]', className)}>{children}</section>;
}


// ------------------------------------------------------------------ line tables
/** To-send pane table (177:137404 header row + 177:137413 rows): Description · Qty 90 · Unit price 130 · Amount 130. */
export function PaneLines({ lines }: { lines: QuoteLine[] }) {
  return (
    <div role="table" className="flex w-full flex-col gap-[14px]">
      <div role="row" className="flex w-full items-start gap-[12px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
        {([['Description', 0], ['Qty', 90], ['Unit price', 130], ['Amount', 130]] as const).map(([t, w]) => (
          <div key={t} role="columnheader" className={cx('flex items-center overflow-clip', w ? 'shrink-0 justify-end' : 'min-w-px flex-1')} style={w ? { width: w } : undefined}>
            <span className="whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{t}</span>
          </div>
        ))}
      </div>
      {lines.map((l) => (
        <div key={l.id} role="row" className="flex w-full items-center gap-[12px] overflow-clip border-b border-line px-[14px] py-[10px]">
          <p role="cell" className="min-w-px flex-1 truncate text-[14px] font-medium leading-[20px] text-fg">{l.line_description}</p>
          <p role="cell" className="w-[90px] shrink-0 whitespace-nowrap text-right font-mono text-[14px] leading-[20px] text-fg">{qtyUom(l)}</p>
          <p role="cell" className="w-[130px] shrink-0 whitespace-nowrap text-right font-mono text-[14px] leading-[20px] text-fg">{formatINR(l.net_unit_price_pre_tax)}</p>
          <p role="cell" className="w-[130px] shrink-0 whitespace-nowrap text-right font-mono text-[14px] font-semibold leading-[20px] text-fg">{lineAmount(l)}</p>
        </div>
      ))}
    </div>
  );
}

/** Sent-detail lines (177:138926): no header row; description flex · qty (mono secondary) · amount w-130; py-10. */
export function DetailLines({ lines }: { lines: QuoteLine[] }) {
  return (
    <div role="table" className="flex w-full flex-col gap-[14px]">
      {lines.map((l) => (
        <div key={l.id} role="row" className="flex w-full items-center gap-[12px] overflow-clip border-b border-line py-[10px] text-[14px] leading-[20px]">
          <p role="cell" className="min-w-px flex-1 font-medium text-fg">{l.line_description}</p>
          <p role="cell" className="shrink-0 whitespace-nowrap font-mono text-fg-2">{qtyUom(l)}</p>
          <p role="cell" className="w-[130px] shrink-0 whitespace-nowrap text-right font-mono font-semibold text-fg">{lineAmount(l)}</p>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ totals
function TotalRow({ label, value, strong, gap }: { label: ReactNode; value: ReactNode; strong?: boolean; gap: 16 | 24 }) {
  return (
    <div className={cx('flex items-start justify-end overflow-clip text-[14px] leading-[20px]', gap === 24 ? 'gap-[24px]' : 'w-full gap-[16px]')}>
      <p className={cx('shrink-0 whitespace-nowrap text-fg-2', strong && 'font-medium')}>{label}</p>
      <p className={cx('w-[140px] shrink-0 text-right font-mono text-fg', strong && 'font-semibold')}>{value}</p>
    </div>
  );
}

/** Revision 0 → this revision, as a signed amount and percent. null when not derivable (rev 0, same price, bad data). */
function vsRevisionZero(quote: SalesQuote, rev: SalesRevision) {
  const r0 = quote.revisions.find((r) => r.revision_no === 0);
  if (!r0 || rev.revision_no === 0) return null;
  const a = toPaise(r0.revised_pre_tax);
  const b = toPaise(rev.revised_pre_tax);
  if (a == null || b == null || a === 0n || a === b) return null;
  const diff = b - a;
  const bp = (diff * 10000n) / a; // hundredths of a percent, truncated toward zero
  const abs = bp < 0n ? -bp : bp;
  const pct = `${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
  const sign = diff < 0n ? '−' : '+';
  return { amount: `${sign}${formatINR(paiseToDec(diff < 0n ? -diff : diff))}`, pct: `${sign}${pct} %` };
}

/**
 * Totals (177:137458 pane: items-end, gap 4, label/value gap 24, value w-140; 177:138946 detail: rows gap 14 via the
 * card, label/value gap 16). API reality: Figma's "Subtotal · Discount 5 % · Tax · Total" is not what the API holds.
 * - Subtotal = revised_pre_tax (the server's sum of the line amounts, pre-tax).
 * - Figma's "Discount n %" is a comparison with revision 0, not an applied discount, so it is shown only when
 *   derivable (revision > 0 and a different price) and labelled exactly "Change vs revision 0".
 * - Freight (stored separately) only when non-zero. Tax = tax_total as typed by Purchase.
 * - Total: composition is an open client decision and the API returns none → "—" + GapNote (same as Purchase G-D-2).
 */
export function Totals({ quote, rev, variant }: { quote: SalesQuote; rev: SalesRevision; variant: 'pane' | 'detail' }) {
  const gap = variant === 'pane' ? 24 : 16;
  const vs = vsRevisionZero(quote, rev);
  const freight = toPaise(rev.freight_charge);
  const rows = (
    <>
      <TotalRow gap={gap} label="Subtotal" value={formatINR(rev.revised_pre_tax)} />
      {vs && <TotalRow gap={gap} label={`Change vs revision 0 (${vs.pct})`} value={vs.amount} />}
      {freight != null && freight !== 0n && <TotalRow gap={gap} label="Freight" value={formatINR(rev.freight_charge)} />}
      <TotalRow gap={gap} label="Tax" value={formatINR(rev.tax_total)} />
      <TotalRow gap={gap} label="Total" value="—" strong />
    </>
  );
  return (
    <>
      {variant === 'pane' ? <div className="flex w-full flex-col items-end gap-[4px] overflow-clip">{rows}</div> : rows}
      <GapNote code="G-D-2">Quote total composition (freight / inspection fee) is an open client decision; the API stores pre-tax, tax and freight separately and returns no total.</GapNote>
    </>
  );
}
