// Stage B local presentation pieces, values from the BR-11 order frames (SS-D 237:40367 · PS-D 238:41629).
// - Card: glass-strong, 1px glass border, radius 24; padding per frame (draft split cards p-24 gap-14 · 244:51778;
//   pipeline side cards p-18 gap-12 · 243:49582; lines card p-20 gap-12 · 244:52033).
// - H2 (Desktop/H2 18/24 SemiBold, draft cards) / H3 (Desktop/H3 15/20 SemiBold, pipeline cards).
// - MiniHead / MiniRow: the in-card tables. Pipeline side cards (243:49585): header bg-subtle radius 18 px-14 py-10
//   gap 10, rows px-14 py-9 border-b. Draft cards (244:51785): header radius 20 px-16 py-12, rows px-16 py-10.
// - Chips: drawer option chips (244:52607): px-12 py-8 radius 16, 11/14 SemiBold +0.44; selected brand-subtle + brand
//   border + primary, else bg-subtle + border-default + secondary. Gap 8, label 14/20 Medium, group gap 8.
// - CompactInput: Figma "Text field" 4:451 as drawn in the BR-11 drawers (240:48834): h-36, px-12, radius 12, surface,
//   1px border-strong; focus 2px brand inside (244:52627 draws border-focus), error 2px danger.
// - EvidenceUpload: dashed border-strong, radius 14, px-14 py-12, gap 10, 18px upload icon, 14/20 secondary (240:48844).
// - OpenQuestion: designer's CLIENT-UNCONFIRMED note (244:52143): warning-bg, 1px warning-border, radius 14, px-14 py-10,
//   gap 10, 16px alert, 12/16 warning-fg.
// - KVBox: bg-subtle radius 16 px-16 py-12 gap 8 rows (244:51821): label 14/20 secondary flex-1 · value 14/20 Medium
//   (mono SemiBold for money / qty).
// - Pipeline: per line box bg-subtle radius 16 px-16 py-12 gap 8 (244:52036): Top (item 14/20 Medium · "qty × price"
//   Data/Number secondary · total Data/Number strong · optional action), 12px bar (border-default track, radius 6,
//   2px gaps), counts (flex-wrap gap 6/14; 8px dot · 12/16 secondary label · Data/Number strong value, muted when 0).
//   Segment colours as drawn: pending #F5A300, reserved #5B8DFF, sourcing #7B6FD6, shipped #2BA597, delivered #1F9D5C.
import { useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { IconAlertTriangle, IconFileText, IconLock, IconRefresh, IconUpload, IconX } from '@tabler/icons-react';
import { enumLabel, formatQty } from '../../../lib/format';
import type { Tone } from '../../../lib/tones';
import { Badge, Ic, cx } from '../../../ui/desktop';
import type { OrderLine } from '../api';
import { num } from './data';
import type { useEvidence } from './evidence';

// ------------------------------------------------------------------ cards + headings
export function Card({ children, className, pad = 18, style }: { children: ReactNode; className?: string; pad?: 18 | 20 | 24; style?: CSSProperties }) {
  return (
    <section
      style={style}
      className={cx(
        'glass-strong flex flex-col items-start overflow-clip rounded-[24px]',
        pad === 24 ? 'gap-[14px] p-[24px]' : pad === 20 ? 'gap-[12px] p-[20px]' : 'gap-[12px] p-[18px]',
        className,
      )}
    >
      {children}
    </section>
  );
}
export function H2({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip">
      <h2 className="min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg">{children}</h2>
      {right}
    </div>
  );
}
export function H3({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip">
      <h3 className="min-w-px flex-1 text-[15px] font-semibold leading-[20px] text-fg">{children}</h3>
      {right}
    </div>
  );
}
export const Muted = ({ children, small }: { children: ReactNode; small?: boolean }) => (
  <p className={cx('w-full text-fg-2', small ? 'text-[12px] leading-[16px]' : 'text-[14px] leading-[20px]')}>{children}</p>
);

// ------------------------------------------------------------------ mini tables
type Size = 'side' | 'draft';
export function MiniHead({ children, size = 'side' }: { children: ReactNode; size?: Size }) {
  return (
    <div role="row" className={cx('flex w-full shrink-0 items-start gap-[10px] overflow-clip bg-subtle', size === 'side' ? 'rounded-[18px] px-[14px] py-[10px]' : 'rounded-[20px] px-[16px] py-[12px]')}>
      {children}
    </div>
  );
}
export function MiniRow({ children, size = 'side', onClick, selected }: { children: ReactNode; size?: Size; onClick?: () => void; selected?: boolean }) {
  const cls = cx(
    'flex w-full shrink-0 items-center gap-[10px] overflow-clip border-b border-line text-left',
    size === 'side' ? 'px-[14px] py-[9px]' : 'px-[16px] py-[10px]',
    onClick && 'cursor-pointer hover:bg-surface',
    selected && 'bg-surface',
  );
  return onClick
    ? <button type="button" role="row" className={cls} onClick={onClick}>{children}</button>
    : <div role="row" className={cls}>{children}</div>;
}
export function Th({ w, grow, right, children }: { w?: number; grow?: boolean; right?: boolean; children: ReactNode }) {
  return (
    <div role="columnheader" className={cx('flex items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0', right && 'justify-end')} style={grow ? undefined : { width: w }}>
      <span className="truncate whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{children}</span>
    </div>
  );
}
export function Td({ w, grow, right, children }: { w?: number; grow?: boolean; right?: boolean; children: ReactNode }) {
  return (
    <div role="cell" className={cx('flex min-w-0 items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0', right && 'justify-end')} style={grow ? undefined : { width: w }}>
      {children}
    </div>
  );
}
export const TStrong = ({ children }: { children: ReactNode }) => <span className="truncate whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{children}</span>;
export const TId = ({ children }: { children: ReactNode }) => <span className="truncate whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-fg">{children}</span>;
export const TNum = ({ children, strong }: { children: ReactNode; strong?: boolean }) => (
  <span className={cx('whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg', strong && 'font-semibold')}>{children}</span>
);
export const TText = ({ children }: { children: ReactNode }) => <span className="truncate whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{children}</span>;
export const Dash = () => <span className="text-[14px] leading-[20px] text-fg-2">—</span>;

// ------------------------------------------------------------------ key / value block
export function KVBox({ rows }: { rows: { label: ReactNode; value: ReactNode; mono?: boolean }[] }) {
  return (
    <div className="flex w-full flex-col items-start gap-[8px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px] text-[14px] leading-[20px]">
      {rows.map((r, i) => (
        <div key={i} className="flex w-full items-start gap-[10px] overflow-clip">
          <p className="min-w-px flex-1 font-normal text-fg-2">{r.label}</p>
          <p className={cx('shrink-0 whitespace-nowrap text-fg', r.mono ? 'font-mono font-semibold' : 'font-medium')}>{r.value}</p>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ designer note + lock note
export function OpenQuestion({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border border-warn-border bg-warn-bg px-[14px] py-[10px]">
      <Ic icon={IconAlertTriangle} size={16} className="shrink-0 text-warn-fg" />
      <p className="min-w-px flex-1 text-[12px] leading-[16px] text-warn-fg">{children}</p>
    </div>
  );
}
export function LockedNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[8px] overflow-clip rounded-[14px] bg-subtle px-[14px] py-[10px]">
      <Ic icon={IconLock} size={16} className="shrink-0 text-fg-2" />
      <p className="min-w-px flex-1 text-[12px] leading-[16px] text-fg-2">{children}</p>
    </div>
  );
}
/** Gate reason strip (Figma "Gated action" reason 5:334): blocked-bg, radius 6, px-12 py-10, 16px lock, 14/20 Medium. */
export function ReasonStrip({ children, tone = 'blocked' }: { children: ReactNode; tone?: 'blocked' | 'success' }) {
  return (
    <div className={cx('flex w-full items-center gap-[8px] overflow-clip rounded-t-md px-[12px] py-[10px]', tone === 'blocked' ? 'bg-st-blocked-bg text-st-blocked-fg' : 'bg-st-success-bg text-st-success-fg')}>
      <Ic icon={IconLock} size={16} className="shrink-0" />
      <p className="text-[14px] font-medium leading-[20px]">{children}</p>
    </div>
  );
}

// ------------------------------------------------------------------ drawer controls
export function Chips<V extends string>({ label, options, value, onChange, error, format = enumLabel }: {
  label: ReactNode; options: readonly V[]; value: V | null; onChange: (v: V) => void; error?: string | null; format?: (v: V) => string;
}) {
  return (
    <div role="radiogroup" className="flex w-full flex-col items-start gap-[8px] overflow-clip">
      <p className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</p>
      <div className="flex w-full flex-wrap items-start gap-[8px]">
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o)}
              className={cx(
                'flex shrink-0 items-start overflow-clip whitespace-nowrap rounded-[16px] border px-[12px] py-[8px] text-[11px] font-semibold leading-[14px] tracking-[0.44px]',
                on ? 'border-brand-border bg-brand-subtle text-fg' : 'border-line bg-subtle text-fg-2 hover:bg-surface',
              )}
            >
              {format(o)}
            </button>
          );
        })}
      </div>
      {error && <p className="text-[12px] leading-[16px] text-st-blocked-fg">{error}</p>}
    </div>
  );
}

let fid = 0;
export function CompactInput({ label, helper, error, className, mono, ...rest }: {
  label: ReactNode; helper?: ReactNode; error?: string | null; className?: string; mono?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  const [id] = useState(() => `so-f-${++fid}`);
  return (
    <div className={cx('flex w-full min-w-0 flex-col items-start gap-[6px]', className)}>
      <label htmlFor={id} className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</label>
      <div className={cx('flex h-[36px] w-full items-center overflow-clip rounded-[12px] border border-line-strong bg-surface px-[12px] focus-within:ring-inside-brand', error && 'ring-inside-danger')}>
        <input
          id={id}
          aria-invalid={!!error || undefined}
          {...rest}
          className={cx('min-w-0 flex-1 bg-transparent text-[14px] leading-[20px] text-fg placeholder:text-fg-muted focus:outline-none', mono && 'font-mono')}
        />
      </div>
      {(error || helper) && <p className={cx('text-[12px] leading-[16px]', error ? 'text-st-blocked-fg' : 'text-fg-2')}>{error || helper}</p>}
    </div>
  );
}
export function Row2({ children }: { children: ReactNode }) {
  return <div className="flex w-full items-start gap-[12px] overflow-clip [&>*]:min-w-px [&>*]:flex-1">{children}</div>;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

export function EvidenceUpload({ label, prompt, evidence, error }: {
  label?: ReactNode; prompt: string; evidence: ReturnType<typeof useEvidence>; error?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { ev, upload, clear } = evidence;
  return (
    <div className="flex w-full flex-col items-start gap-[6px]">
      {label && <p className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</p>}
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      {!ev ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cx('flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border border-dashed px-[14px] py-[12px] text-left hover:bg-subtle', error ? 'border-danger' : 'border-line-strong')}
        >
          <Ic icon={IconUpload} size={18} className="shrink-0 text-fg-2" />
          <span className="truncate text-[14px] leading-[20px] text-fg-2">{prompt}</span>
        </button>
      ) : (
        <div className={cx('flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border border-dashed px-[14px] py-[12px]', ev.state === 'failed' ? 'border-danger' : 'border-line-strong')}>
          <Ic icon={ev.state === 'uploaded' ? IconUpload : IconFileText} size={18} className={ev.state === 'failed' ? 'shrink-0 text-st-blocked-fg' : 'shrink-0 text-fg-2'} />
          <span className={cx('min-w-px flex-1 truncate text-[14px] leading-[20px]', ev.state === 'failed' ? 'text-st-blocked-fg' : 'text-fg-2')}>
            {ev.name} · {ev.state === 'uploading' ? `uploading ${ev.progress}%` : ev.state === 'failed' ? (ev.error || 'upload failed') : 'uploaded'}
          </span>
          {ev.state === 'failed' && (
            <button type="button" aria-label="Retry upload" onClick={() => upload(ev.file)} className="flex h-[20px] w-[20px] shrink-0 items-center justify-center text-fg-2 hover:text-fg">
              <Ic icon={IconRefresh} size={16} />
            </button>
          )}
          {ev.state !== 'uploading' && (
            <button type="button" aria-label="Remove file" onClick={clear} className="flex h-[20px] w-[20px] shrink-0 items-center justify-center text-fg-2 hover:text-fg">
              <Ic icon={IconX} size={16} />
            </button>
          )}
        </div>
      )}
      {error && <p className="text-[12px] leading-[16px] text-st-blocked-fg">{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ header meta (order header card 244:52012)
export function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-[4px] overflow-clip whitespace-nowrap">
      <p className="text-[12px] leading-[16px] text-fg-2">{label}</p>
      {children}
    </div>
  );
}

/** Derived (non-enum) state badge — e.g. NOT RECORDED, PASS / FAIL. */
export const StateBadge = ({ tone, label }: { tone: Tone; label: string }) => <Badge tone={tone} label={label} />;

// ------------------------------------------------------------------ quantity pipeline (244:52036)
const SEG = { pending: '#F5A300', reserved: '#5B8DFF', sourcing: '#7B6FD6', shipped: '#2BA597', delivered: '#1F9D5C' } as const;

export function PipelineLine({ line, label, price, total, action }: { line: OrderLine; label: string; price: string; total: string; action?: ReactNode }) {
  const accepted = num(line.accepted_qty);
  const delivered = num(line.delivered_qty);
  const shippedOnly = Math.max(0, num(line.shipped_qty) - delivered);
  const parts = [
    { key: 'delivered', v: delivered, c: SEG.delivered },
    { key: 'shipped', v: shippedOnly, c: SEG.shipped },
    { key: 'reserved', v: num(line.reserved_qty), c: SEG.reserved },
    { key: 'sourcing', v: num(line.sourcing_authorised_qty), c: SEG.sourcing },
    { key: 'pending', v: num(line.reservation_pending_qty), c: SEG.pending },
  ].filter((p) => p.v > 0);
  const used = parts.reduce((t, p) => t + p.v, 0);
  const rest = Math.max(0, accepted - used);
  const uom = line.uom;
  return (
    <div className="flex w-full flex-col items-start gap-[8px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px]">
      <div className="flex w-full items-center gap-[12px] text-[14px] leading-[20px]">
        <p className="min-w-px flex-1 font-medium text-fg">{label}</p>
        <p className="shrink-0 whitespace-nowrap font-mono text-fg-2">{formatQty(line.accepted_qty, uom)} × {price}</p>
        <p className="shrink-0 whitespace-nowrap font-mono font-semibold text-fg">{total}</p>
        {action}
      </div>
      <div className="flex h-[12px] w-full items-start gap-[2px] overflow-clip rounded-[6px] bg-line" aria-hidden>
        {parts.map((p) => <div key={p.key} className="h-[12px] min-w-px" style={{ flexGrow: p.v, flexBasis: 0, background: p.c }} />)}
        {rest > 0 && <div className="h-[12px] min-w-px" style={{ flexGrow: rest, flexBasis: 0 }} />}
      </div>
      <div className="flex w-full flex-wrap items-start gap-x-[14px] gap-y-[6px] overflow-clip">
        <Count dot={SEG.pending} label="Reservation pending" v={line.reservation_pending_qty} />
        <Count dot={SEG.reserved} label="Reserved" v={line.reserved_qty} />
        <Count dot={SEG.sourcing} label="Sourcing authorised" v={line.sourcing_authorised_qty} />
        <Count dot={SEG.shipped} label="Shipped" v={line.shipped_qty} />
        <Count dot={SEG.delivered} label="Delivered" v={line.delivered_qty} />
        <Count label="Invoiced" v={line.invoiced_qty} />
        <Count label="Outstanding delivery" v={line.outstanding_delivery_qty} />
      </div>
    </div>
  );
}
function Count({ dot, label, v }: { dot?: string; label: string; v: string | null }) {
  const zero = num(v) === 0;
  return (
    <div className="flex shrink-0 items-center gap-[6px] overflow-clip whitespace-nowrap">
      {dot && <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: dot }} aria-hidden />}
      <span className="text-[12px] leading-[16px] text-fg-2">{label}</span>
      <span className={cx('font-mono text-[14px] font-semibold leading-[20px]', zero ? 'text-fg-muted' : 'text-fg')}>{formatQty(v ?? '0')}</span>
    </div>
  );
}

/** Pipeline summary block (244:52146): bg-subtle radius 16 px-16 py-12 gap 32; "label  value" pairs gap 8. */
export function OrderFacts({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  return (
    <div className="flex w-full flex-wrap items-start gap-x-[32px] gap-y-[8px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px] text-[14px] leading-[20px]">
      {facts.map((f) => (
        <div key={f.label} className="flex shrink-0 items-start gap-[8px] overflow-clip whitespace-nowrap">
          <p className="font-normal text-fg-2">{f.label}</p>
          <p className="font-medium text-fg">{f.value}</p>
        </div>
      ))}
    </div>
  );
}

/** Loading bars for the detail skeleton. */
export const Bar = ({ w }: { w: number | string }) => <span className="block h-[12px] animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />;
