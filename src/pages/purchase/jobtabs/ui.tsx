// Building blocks shared by the job workspace tabs (D·P4 / J2 / D·P8 / D·P9 / D·P10 frames).
// - TabCard: glass-strong, radius 24, p-20, gap 14 (D·P4 "Report" 177:103500, "Time" 177:103528 …).
// - H3: Desktop/H3 15/20 SemiBold primary (D·P4 "Findings", "Inspection time", "History", "Your review").
// - Fact: 12/16 secondary label over Data/ID 13/18 mono Medium value, gap 2 (D·P4 "Active" 177:103531).
// - CompactField: Figma "Text field" 4:451 Desktop/Default as drawn on the workspace cards (177:103547): label 14/20
//   Medium · box h-36, px-12, radius 12, bg-surface, 1px border-strong (brand 2px inside on focus, danger on error) ·
//   helper 12/16 secondary.
// - TabSkeleton: two-column loading placeholder (main flex + right 400/420).
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../../ui/desktop/Icon';

export function TabCard({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('glass-strong flex w-full flex-col items-start gap-[14px] overflow-clip rounded-[24px] p-[20px]', className)}>{children}</section>;
}

export const H3 = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h3 className={cx('text-[15px] font-semibold leading-[20px] text-fg', className)}>{children}</h3>
);

export function Fact({ label, children, mono = true }: { label: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
      <span className="text-[12px] leading-[16px] text-fg-2">{label}</span>
      <span className={mono ? 'font-mono text-[13px] font-medium leading-[18px] text-fg' : 'text-[14px] font-medium leading-[20px] text-fg'}>{children}</span>
    </div>
  );
}

export function CompactField({ label, helper, error, className, ...rest }: {
  label: ReactNode; helper?: ReactNode; error?: string | null; className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={cx('flex w-full min-w-0 flex-col items-start gap-[6px]', className)}>
      <label htmlFor={id} className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</label>
      <div className={cx('flex h-[36px] w-full items-center overflow-clip rounded-[12px] border border-line-strong bg-surface px-[12px] focus-within:ring-inside-brand', error && 'ring-inside-danger')}>
        <input id={id} aria-invalid={!!error || undefined} {...rest} className="min-w-0 flex-1 bg-transparent text-[14px] leading-[20px] text-fg placeholder:text-fg-muted focus:outline-none" />
      </div>
      {(error || helper) && <p className={cx('text-[12px] leading-[16px]', error ? 'text-st-blocked-fg' : 'text-fg-2')}>{error || helper}</p>}
    </div>
  );
}

export function TabSkeleton({ right = 400 }: { right?: number }) {
  const bar = (w: number | string) => <div className="h-[12px] animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />;
  return (
    <div className="flex w-full flex-1 items-stretch gap-[16px]" role="status" aria-label="Loading">
      <TabCard className="min-h-[480px] min-w-px flex-1">{bar(260)}{bar('80%')}{bar('60%')}{bar('70%')}</TabCard>
      <div className="flex shrink-0 flex-col gap-[16px]" style={{ width: right }}>
        <TabCard>{bar(140)}{bar(220)}</TabCard>
        <TabCard className="flex-1">{bar(120)}{bar(200)}{bar(180)}</TabCard>
      </div>
    </div>
  );
}
