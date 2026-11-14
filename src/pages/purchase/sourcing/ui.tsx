// Local building blocks for the BR-04 sourcing screens (Figma page 177:102060). Built here because the shared kit
// has no equivalent at these exact values (reported to the coordinator):
// - SectionCard: "Stock check" 177:103579 / "Offers" 177:103709 — glass-strong, radius 24, p-20, gap 14
//   (`pad=24 gap=16` = S1 "Line 1" 177:121864 / "Suppliers" 177:121908).
// - CardHead: 18/24 SemiBold title + right slot, gap 10 (177:103580).
// - GridHead / GridRow: compact table of the workspace cards — header bg-subtle radius 18, px-14 py-10, gap 16
//   (177:103583); row px-14 py-12, 1px bottom border (177:103623); highlighted row = brand-subtle + 1px brand border,
//   radius 16, no bottom border (177:103602). `gap` 12 on the offers table (177:103713).
// - Cell: fixed-width (or grow) cell; align right for numbers.
// - ItemTwo: code (Data/ID, secondary) over name (Body strong) (177:103604).
// - ContextChip: bg-subtle radius 18, pl-12 pr-14 py-8, gap 8, 16px icon, 12/16 secondary (177:103568);
//   `warn` = warning bg/fg (177:103574).
// - MetaField: 12/16 label over value, gap 2 (D·P6 Meta 177:103684) or 3 (S1 Grid 177:121869), value 14/20 Medium
//   or Data/ID mono.
// - TimelineItem: Figma "Timeline item" 7:408 / 7:416 / 7:424 (tone dot asset 18px, 2px connector, body pb-20 gap 2).
//   Items are separate children of their card, so the list that holds them uses the card gap (16 on S1 History).
import type { ReactNode } from 'react';
import { cx, Ic, type TablerIcon } from '../../../ui/desktop/Icon';
import timelineDotProgress from '../../../assets/figma/sourcing/timeline-dot.svg';
import timelineDotNeutral from '../../../assets/figma/sourcing/timeline-dot-neutral.svg';
import timelineDotSuccess from '../../../assets/figma/sourcing/timeline-dot-success.svg';

export type TimelineTone = 'neutral' | 'progress' | 'success';
const TIMELINE_DOT: Record<TimelineTone, string> = { neutral: timelineDotNeutral, progress: timelineDotProgress, success: timelineDotSuccess };

export function SectionCard({ children, className, pad = 20, fill }: { children: ReactNode; className?: string; pad?: 20 | 24; fill?: boolean }) {
  return (
    <section
      className={cx(
        'glass-strong flex w-full flex-col items-start overflow-clip rounded-[24px]',
        pad === 24 ? 'gap-[16px] p-[24px]' : 'gap-[14px] p-[20px]',
        fill && 'min-h-px flex-1',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHead({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip">
      <h2 className="min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg">{title}</h2>
      {right}
    </div>
  );
}

export function GridHead({ children, gap = 16 }: { children: ReactNode; gap?: 12 | 16 }) {
  return (
    <div role="row" className="flex w-full shrink-0 items-start overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]" style={{ gap }}>
      {children}
    </div>
  );
}

export function GridRow({ children, highlight, onClick, gap = 16, last }: {
  children: ReactNode; highlight?: boolean; onClick?: () => void; gap?: 12 | 16; last?: boolean;
}) {
  return (
    <div
      role="row"
      onClick={onClick}
      className={cx(
        'flex w-full shrink-0 items-center overflow-clip px-[14px] py-[12px]',
        highlight ? 'rounded-[16px] border border-brand-border bg-brand-subtle' : !last && 'border-b border-line',
        !highlight && last && 'border-b border-line',
        onClick && 'cursor-pointer',
      )}
      style={{ gap }}
    >
      {children}
    </div>
  );
}

export function HCell({ w, grow, align, children }: { w?: number; grow?: boolean; align?: 'right'; children: ReactNode }) {
  return (
    <div role="columnheader" className={cx('flex items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0', align === 'right' && 'justify-end')} style={grow ? undefined : { width: w }}>
      <span className="whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{children}</span>
    </div>
  );
}

export function Cell({ w, grow, align, children, className }: { w?: number; grow?: boolean; align?: 'right'; children: ReactNode; className?: string }) {
  return (
    <div role="cell" className={cx('flex min-w-0 items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0', align === 'right' && 'justify-end', className)} style={grow ? undefined : { width: w }}>
      {children}
    </div>
  );
}

/** Data/Number (mono 14/20), `strong` = Data/Number strong (SemiBold). */
export const Num = ({ children, strong }: { children: ReactNode; strong?: boolean }) => (
  <span className={cx('whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg', strong && 'font-semibold')}>{children}</span>
);
/** Body 14/20 secondary. */
export const Muted = ({ children }: { children: ReactNode }) => (
  <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{children}</span>
);

export function ItemTwo({ code, name, codeMuted = true }: { code: ReactNode; name: ReactNode; codeMuted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
      <span className={cx('truncate font-mono text-[13px] font-medium leading-[18px]', codeMuted ? 'text-fg-2' : 'text-fg')}>{code}</span>
      <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{name}</span>
    </div>
  );
}

export function ContextChip({ icon, children, warn }: { icon: TablerIcon; children: ReactNode; warn?: boolean }) {
  return (
    <div className={cx('flex shrink-0 items-center gap-[8px] overflow-clip rounded-[18px] py-[8px] pl-[12px] pr-[14px]', warn ? 'bg-warn-bg text-warn-fg' : 'bg-subtle text-fg-2')}>
      <Ic icon={icon} size={16} className={warn ? 'text-warn-fg' : 'text-fg'} />
      <span className="whitespace-nowrap text-[12px] leading-[16px]">{children}</span>
    </div>
  );
}

export function MetaField({ label, children, mono, gap = 2 }: { label: string; children: ReactNode; mono?: boolean; gap?: 2 | 3 }) {
  return (
    <div className="flex shrink-0 flex-col items-start overflow-clip whitespace-nowrap" style={{ gap }}>
      <span className="text-[12px] leading-[16px] text-fg-2">{label}</span>
      <span className={mono ? 'font-mono text-[13px] font-medium leading-[18px] text-fg' : 'text-[14px] font-medium leading-[20px] text-fg'}>{children}</span>
    </div>
  );
}

export function TimelineItem({ title, meta, detail, last, tone = 'progress' }: {
  title: ReactNode; meta: ReactNode; detail?: ReactNode; last?: boolean; tone?: TimelineTone;
}) {
  return (
    <div className="flex w-full items-start gap-[12px]">
      <div className="flex shrink-0 flex-col items-center gap-[4px] self-stretch overflow-clip">
        <div className="relative h-[12px] w-[12px] shrink-0">
          <img alt="" src={TIMELINE_DOT[tone]} className="absolute inset-[-25%] block h-[18px] w-[18px] max-w-none" />
        </div>
        {!last && <div className="min-h-px w-[2px] flex-1 bg-line" />}
      </div>
      <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip pb-[20px]">
        <p className="w-full text-[14px] font-medium leading-[20px] text-fg">{title}</p>
        <p className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{meta}</p>
        {detail && <p className="w-full text-[14px] leading-[20px] text-fg-2">{detail}</p>}
      </div>
    </div>
  );
}

const dmf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
/** ISO → "10 Nov" (IST) — offer "Valid until" / RFQ list "Needed by" columns. */
export const formatDayMonth = (iso: string | null | undefined) => (iso ? dmf.format(new Date(iso)) : '—');
