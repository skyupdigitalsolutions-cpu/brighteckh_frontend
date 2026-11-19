// Stage D local pieces (F-D 247:51039 · A-D 247:55207). The BR-11 Finance / admin frames draw a slightly different table,
// drawer and chip treatment from the kit, so these are local (values from get_design_context):
// - FinToolbar   FA0 toolbar 247:54070: glass-strong, radius 30, pl-16 pr-10 py-10, gap 10, no shadow.
// - FinTableCard FA0 table card 247:54078: glass-strong, radius 24, p-16, no shadow (kit TableCard = radius 28 + shadow).
// - FinHead / FinRow: header row 247:54079 bg-subtle, radius 18, px-14 py-10, gap 10 (kit THead = radius 20, px-16 py-12);
//   data row 247:54092 px-14 py-13, gap 10, 1px bottom border-default. Cells reuse the kit TH / TD.
// - FinSkeleton  "Skeleton row" 5:439 (FA0 loading 247:54349): surface fill, h-40, px-16, gap 16, 12px bars radius 4
//   (96 · 220 · 120 · 80 · 140) in bg-disabled.
// - OpenQuestion the "Open question Gnn" note (AS0 247:55436): warning-bg, 1px solid warning-border, radius 14, px-14 py-10,
//   gap 10, 16px alert icon, 12/16 warning-fg. (Kit GapNote = dashed API-gap note; this one marks a CLIENT-UNCONFIRMED value.)
// - PolicyChip   AS0 option chips 247:55427: px-12 py-8, radius 16, 1px border, 11/14 SemiBold +0.44; selected = brand-subtle +
//   brand-border + primary text; else bg-subtle + border-default + secondary; disabled = opacity 50 + muted text.
// - SideDrawer   FA1 drawer 247:55094: 600 wide, 12px viewport inset, surface fill, 1px border-default, radius 28, p-28, gap 16
//   (header / body / footer in one column, no footer divider). Kit Drawer has 520 / glass border / footer divider and a
//   pt-28 pb-20 header, so the FA1 panel is local; it reuses the kit Scrim (.55) + useDismiss.
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconAlertTriangle, IconLock, IconX } from '@tabler/icons-react';
import { GlassCard, Ic, Scrim, cx, useDismiss } from '../../../ui/desktop';

export function FinToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="glass-strong flex w-full items-center gap-[10px] overflow-clip rounded-t-toolbar py-[10px] pl-[16px] pr-[10px]">
      {children}
    </div>
  );
}

export function FinTableCard({ children }: { children: ReactNode }) {
  return (
    <GlassCard strong radius="rounded-[24px]" className="flex min-h-[586px] w-full flex-1 flex-col items-stretch p-[16px]">
      {children}
    </GlassCard>
  );
}

export function FinHead({ children }: { children: ReactNode }) {
  return (
    <div role="row" className="flex w-full shrink-0 items-start gap-[10px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
      {children}
    </div>
  );
}

export function FinRow({ children, onOpen, label }: { children: ReactNode; onOpen: () => void; label: string }) {
  return (
    <div
      role="row"
      tabIndex={0}
      aria-label={label}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className="flex w-full shrink-0 cursor-pointer items-center gap-[10px] overflow-clip border-b border-line px-[14px] py-[13px] transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
    >
      {children}
    </div>
  );
}

const SKELETON = [96, 220, 120, 80, 140];
export function FinSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-[40px] w-full shrink-0 items-center gap-[16px] bg-surface px-[16px]">
          {SKELETON.map((w, j) => <div key={j} className="h-[12px] shrink-0 animate-pulse rounded-[4px] bg-disabled" style={{ width: w }} />)}
        </div>
      ))}
    </div>
  );
}

export function OpenQuestion({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border border-warn-border bg-warn-bg px-[14px] py-[10px] text-warn-fg">
      <Ic icon={IconAlertTriangle} size={16} />
      <p className="min-w-px flex-1 text-[12px] leading-[16px]">{children}</p>
    </div>
  );
}

export function PolicyChip({ label, on, disabled, onClick }: { label: string; on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex shrink-0 items-start overflow-clip rounded-[16px] border px-[12px] py-[8px] text-[11px] font-semibold leading-[14px] tracking-[0.44px] whitespace-nowrap',
        on ? 'border-brand-border bg-brand-subtle text-fg' : 'border-line bg-subtle text-fg-2',
        disabled ? 'cursor-not-allowed opacity-50' : !on && 'hover:bg-surface',
        disabled && !on && 'text-fg-muted',
      )}
    >
      {label}
    </button>
  );
}

/** Gated-action reason strip (Figma "Gated action" 5:409 reason): blocked-bg, radius 6, px-12 py-10, gap 8, 16px lock, 14/20 Medium. */
export function ReasonStrip({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[8px] overflow-clip rounded-t-md bg-st-blocked-bg px-[12px] py-[10px] text-st-blocked-fg">
      <Ic icon={IconLock} size={16} />
      <p className="text-[14px] font-medium leading-[20px]">{children}</p>
    </div>
  );
}

export function SideDrawer({ open, onClose, busy, title, subtitle, children, footer }: {
  open: boolean; onClose: () => void; busy?: boolean; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  const close = () => { if (!busy) onClose(); };
  useDismiss(open, close);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <>
      <Scrim alpha={0.55} onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed bottom-[12px] right-[12px] top-[12px] z-50 flex w-[600px] max-w-[calc(100vw-24px)] flex-col items-stretch gap-[16px] overflow-clip rounded-t-card border border-line bg-surface p-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex w-full shrink-0 items-start gap-[12px] overflow-clip">
          <div className="flex min-w-px flex-1 flex-col gap-[4px] overflow-clip">
            <h2 className="text-[22px] font-semibold leading-[28px] text-fg">{title}</h2>
            {subtitle && <p className="truncate text-[14px] leading-[20px] text-fg-2">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-clip rounded-t-popover bg-subtle text-fg hover:bg-disabled"
          >
            <Ic icon={IconX} size={20} />
          </button>
        </div>
        <div className="flex min-h-px w-full flex-1 flex-col items-stretch gap-[14px] overflow-y-auto">{children}</div>
        {footer && <div className="flex w-full shrink-0 flex-col gap-[12px]">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
