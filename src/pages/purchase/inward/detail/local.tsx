// Local pieces for the JIN detail screens (BR-02 intake). Not in the shared desktop kit, so they live here.
// - SideDrawer: the 480-wide drawer of D·P2a 177:103185 / D·P2b 177:103290 (differs from the kit Drawer, which
//   is the 520-wide P1 drawer 177:108447): surface fill, radius 28, no border, shadow -12 0 40 rgba(26,13,13,.18),
//   12px from the viewport edges; header pt-24 px-24 pb-16 gap 12 (titles gap 2); body pt-8 px-24 pb-16 gap 16;
//   footer 1px top border-default, pt-16 px-24 pb-24. Scrim rgba(0,0,0,.55) (177:103184).
// - MetaItem: JIN header "Meta grid" cell (177:108522): 12/16 secondary label, gap 2, value 14/20 Medium or
//   Data/ID 13/18 mono.
// - useUnitJobs: unit → Job map for this browser tab. GET /inward-receipts/{id} does not return the Job created for
//   a verified unit (gap G?-B-2), so the verify response is remembered per receipt in sessionStorage.
// - isUuid: input-format check for the id-entry slots (G16/G17/G18/G19). Business rules stay in the DB.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { cx, Ic } from '../../../../ui/desktop';
import { Scrim, useDismiss } from '../../../../ui/desktop/Popover';

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
export const shortId = (id: string) => id.slice(0, 8);

export function SideDrawer({ open, onClose, title, subtitle, children, footer, onSubmit, busy, width = 480 }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: () => void;
  busy?: boolean;
  width?: number;
}) {
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useDismiss(open, close);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;

  const inner = (
    <>
      <div className="flex w-full shrink-0 items-start gap-[12px] overflow-clip px-[24px] pb-[16px] pt-[24px]">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-[2px] overflow-clip">
          <h2 className="whitespace-nowrap text-[22px] font-semibold leading-[28px] text-fg">{title}</h2>
          {subtitle && <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{subtitle}</p>}
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
      <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-[16px] overflow-y-auto px-[24px] pb-[16px] pt-[8px]">{children}</div>
      {footer && (
        <div className="flex w-full shrink-0 flex-col items-start overflow-clip border-t border-line px-[24px] pb-[24px] pt-[16px]">{footer}</div>
      )}
    </>
  );
  const cls = 'fixed bottom-[12px] right-[12px] top-[12px] z-50 flex max-w-[calc(100vw-24px)] flex-col items-start overflow-clip rounded-t-card bg-surface shadow-[-12px_0px_40px_0px_rgba(26,13,13,0.18)]';
  return createPortal(
    <>
      <Scrim alpha={0.55} onClick={close} />
      {onSubmit ? (
        <form
          role="dialog"
          aria-modal="true"
          noValidate
          className={cls}
          style={{ width }}
          onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(); }}
        >
          {inner}
        </form>
      ) : (
        <div role="dialog" aria-modal="true" className={cls} style={{ width }}>{inner}</div>
      )}
    </>,
    document.body,
  );
}

export function MetaItem({ label, value, mono, title }: { label: string; value: ReactNode; mono?: boolean; title?: string }) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap" title={title}>
      <p className="text-[12px] leading-[16px] text-fg-2">{label}</p>
      <p className={cx('text-fg', mono ? 'font-mono text-[13px] font-medium leading-[18px]' : 'text-[14px] font-medium leading-[20px]')}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------- unit → job (this tab only)
export type UnitJob = { jobId: string; jobNumber: string };
type UnitJobs = Record<string, UnitJob>;

function readJobs(key: string): UnitJobs {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as UnitJobs) : {};
  } catch {
    return {};
  }
}

export function useUnitJobs(receiptId: string) {
  const key = `brightech.jin-unit-jobs.${receiptId}`;
  const [jobs, setJobs] = useState<UnitJobs>(() => readJobs(key));
  useEffect(() => { setJobs(readJobs(key)); }, [key]);
  const remember = useCallback((unitId: string, job: UnitJob) => {
    setJobs((prev) => {
      const next = { ...prev, [unitId]: job };
      try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable: keep in memory */ }
      return next;
    });
  }, [key]);
  return { jobs, remember };
}

const dmf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
/** ISO date -> "06 Nov" (IST), as in the JIN header "Customer DC" cell. */
export const formatDayMonth = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dmf.format(d);
};
