// Stage A (enquiry → product quote) local layout pieces. Shared BR-11 data lives in ../api.ts; what it lacks is in
// ./data.ts:
//   - useItems(ids): GET /masters/items/:id → item_code / status / base_uom (quote + enquiry lines carry only item_id).
//   - itemSource: Item Master picker (GET /masters/items?status=APPROVED|ACTIVE&search=) — Item Master only, never assemblies.
//   - approvedCustomerSource: GET /lookups/customers?status=APPROVED (create-enquiry "Approved customers only").
// Shared layout from the SS-D / PS-D frames (237:40367, 238:41629):
//   - ListToolbar: Toolbar 237:40601 (glass-strong, radius 30, pl-20 pr-10 py-10, gap 10); PQ0 238:41857 uses pl-16.
//   - DetailCard: split panels (237:43080 / 239:46828): glass-strong, radius 24, p-24, gap 14.
//   - CardHead: 18/24 SemiBold title + right slot (gap 10).
//   - MiniHead / MiniRow: in-card table header (bg-subtle, radius 20, px-16 py-12) + rows (px-16 py-10, 1px bottom border).
//   - KvBox / KvRow: "Terms" block 239:46868 (bg-subtle, radius 16, px-16 py-12, gap 8; label secondary, value Medium).
//   - LockNote: "Locked" strip 239:46834 (bg-subtle, radius 14, px-14 py-10, gap 8, 16px lock, 12/16 secondary).
//   - TableError: list error state 237:41279 (header row kept; blocked inline alert + primary "Try again").
//   - Chips: drawer chip group (237:42789): label 14/20 Medium, gap 8, chips px-12 py-8 radius 16, 11/14 SemiBold +0.44.
//   - EvidenceInput: dashed evidence box (237:42811): border-strong dashed, radius 14, px-14 py-12, gap 10, 18px upload.
import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconFileText, IconLock, IconRefresh, IconUpload, IconX } from '@tabler/icons-react';
import { enumLabel } from '../../../lib/format';
import { Badge, Button, GlassCard, Ic, InlineAlert, cx, errorBody } from '../../../ui/desktop';
import type { useEvidence } from './data';

// ------------------------------------------------------------------ layout pieces
export function ListToolbar({ children, pl = 20 }: { children: ReactNode; pl?: 16 | 20 }) {
  return (
    <div className={cx('glass-strong flex w-full items-center gap-[10px] overflow-clip rounded-t-toolbar py-[10px] pr-[10px]', pl === 16 ? 'pl-[16px]' : 'pl-[20px]')}>
      {children}
    </div>
  );
}

export function DetailCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <GlassCard strong radius="rounded-[24px]" className={cx('flex flex-col items-start gap-[14px] p-[24px]', className)}>
      {children}
    </GlassCard>
  );
}

export function CardHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip">
      <h2 className="min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg">{title}</h2>
      {children}
    </div>
  );
}

export const Spacer = () => <div className="min-h-px w-px flex-1" aria-hidden />;

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="whitespace-nowrap text-[15px] font-semibold leading-[20px] text-fg">{children}</p>;
}

export function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
      <span className="text-[12px] leading-[16px] text-fg-2">{label}</span>
      <span className="text-[14px] font-medium leading-[20px] text-fg">{children}</span>
    </div>
  );
}

export type Col = { w?: number; grow?: boolean; right?: boolean };
const colStyle = (c: Col) => (c.grow ? undefined : { width: c.w });
const colCls = (c: Col) => cx('flex min-w-0 items-center overflow-clip', c.grow ? 'min-w-px flex-1' : 'shrink-0', c.right && 'justify-end');

export function MiniHead({ cols, labels, gap = 12 }: { cols: Col[]; labels: ReactNode[]; gap?: number }) {
  return (
    <div role="row" className="flex w-full shrink-0 items-start overflow-clip rounded-t-popover bg-subtle px-[16px] py-[12px]" style={{ columnGap: gap }}>
      {cols.map((c, i) => (
        <div key={i} role="columnheader" className={colCls(c)} style={colStyle(c)}>
          <span className="truncate whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniRow({ cols, cells, gap = 12, to, onClick }: { cols: Col[]; cells: ReactNode[]; gap?: number; to?: string; onClick?: () => void }) {
  const inner = cols.map((c, i) => <div key={i} role="cell" className={colCls(c)} style={colStyle(c)}>{cells[i]}</div>);
  const cls = 'flex w-full shrink-0 items-center overflow-clip border-b border-line px-[16px] py-[10px]';
  if (to) return <RowLink to={to} className={cx(cls, 'hover:bg-surface')} gap={gap}>{inner}</RowLink>;
  return <div role="row" onClick={onClick} className={cls} style={{ columnGap: gap }}>{inner}</div>;
}

function RowLink({ to, className, gap, children }: { to: string; className: string; gap: number; children: ReactNode }) {
  return <Link role="row" to={to} className={className} style={{ columnGap: gap }}>{children}</Link>;
}

export function KvBox({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col items-start gap-[8px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px] text-[14px] leading-[20px]">{children}</div>;
}
export function KvRow({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex w-full items-start gap-[10px] overflow-clip">
      <span className="min-w-px flex-1 text-fg-2">{label}</span>
      <span className={cx('shrink-0 whitespace-nowrap text-fg', mono ? 'font-mono font-semibold' : 'font-medium')}>{children}</span>
    </div>
  );
}

export function LockNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[8px] overflow-clip rounded-[14px] bg-subtle px-[14px] py-[10px]">
      <Ic icon={IconLock} size={16} className="text-fg-2" />
      <p className="min-w-px flex-1 text-[12px] leading-[16px] text-fg-2">{children}</p>
    </div>
  );
}

/** List error state (237:41279): blocked inline alert under the kept header row + primary "Try again". */
export function TableError({ title, error, onRetry, retrying }: { title: string; error: unknown; onRetry: () => void; retrying?: boolean }) {
  return (
    <div className="flex w-full flex-col items-center gap-[16px] pt-[8px]">
      <InlineAlert tone="blocked" title={title}>{errorBody(error)}</InlineAlert>
      <Button kind="primary" busy={retrying} icon={<Ic icon={IconRefresh} size={18} />} onClick={onRetry}>Try again</Button>
    </div>
  );
}

export function Chips<V extends string>({ label, options, value, onChange, error }: {
  label: string; options: readonly V[]; value: V | null; onChange: (v: V) => void; error?: string | null;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full flex-col items-start gap-[8px] overflow-clip">
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
              {enumLabel(o)}
            </button>
          );
        })}
      </div>
      {error && <p className="text-[12px] leading-[16px] text-st-blocked-fg">{error}</p>}
    </div>
  );
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

export function EvidenceInput({ evidence, prompt }: { evidence: ReturnType<typeof useEvidence>; prompt: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { ev, upload, clear } = evidence;
  return (
    <>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      {!ev ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border border-dashed border-line-strong px-[14px] py-[12px] text-left hover:bg-subtle"
        >
          <Ic icon={IconUpload} size={18} className="text-fg-2" />
          <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{prompt}</span>
        </button>
      ) : (
        <div className={cx('flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border px-[14px] py-[12px]', ev.state === 'failed' ? 'border-danger' : 'border-line-strong')}>
          <Ic icon={IconFileText} size={18} className={ev.state === 'failed' ? 'text-st-blocked-fg' : 'text-fg-2'} />
          <div className="flex min-w-px flex-1 flex-col">
            <span className="truncate text-[14px] leading-[20px] text-fg">{ev.name}</span>
            <span className={cx('text-[12px] leading-[16px]', ev.state === 'failed' ? 'text-st-blocked-fg' : 'text-fg-2')}>
              {ev.state === 'uploading' ? `Uploading… ${ev.progress}%` : ev.state === 'failed' ? (ev.error || 'Upload failed.') : 'Attached'}
            </span>
          </div>
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
    </>
  );
}

/** Product condition badge. No tone domain exists for product_condition; the frames draw it neutral (237:43113). */
export const ConditionBadge = ({ value }: { value: string }) => <Badge tone="neutral" label={enumLabel(value)} />;
