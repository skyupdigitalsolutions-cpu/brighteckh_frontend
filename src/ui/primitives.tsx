// Shared components, translated from Figma "01 · Components" (Button 4:392, Status badge 3:14,
// Priority flag 3:21, Text field 4:451, Inline alert 5:332, Empty state 5:438, Skeleton 5:439).
import { useEffect, type ButtonHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { IconAlertTriangle, IconCheck, IconInfoCircle, IconLock, IconRefresh } from '@tabler/icons-react';
import type { Priority } from '../api/types';
import { enumLabel } from '../lib/format';
import { toneOf, type Tone, type ToneDomain } from '../lib/tones';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

// ---------------------------------------------------------------- Button
type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: ButtonKind; size?: 'mobile' | 'desktop'; icon?: ReactNode; block?: boolean; busy?: boolean;
};
export function Button({ kind = 'primary', size = 'mobile', icon, block, busy, className, children, disabled, ...rest }: ButtonProps) {
  const isDisabled = disabled || busy;
  const base = size === 'mobile' ? 'h-[52px] px-5 text-[17px] leading-6' : 'h-9 px-4 text-sm leading-5';
  const kinds: Record<ButtonKind, string> = {
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'bg-surface text-fg border border-line-strong hover:bg-subtle',
    ghost: 'text-fg hover:bg-subtle',
    danger: 'bg-danger text-white hover:opacity-90',
  };
  return (
    <button
      type="button"
      {...rest}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors',
        base,
        isDisabled ? (kind === 'ghost' ? 'text-fg-disabled' : 'bg-disabled text-fg-disabled border-transparent') : kinds[kind],
        block && 'w-full',
        className,
      )}
    >
      {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Status badge / priority flag
const TONE_CLS: Record<Tone, string> = {
  neutral: 'bg-st-neutral-bg border-st-neutral-bd text-st-neutral-fg',
  progress: 'bg-st-progress-bg border-st-progress-bd text-st-progress-fg',
  success: 'bg-st-success-bg border-st-success-bd text-st-success-fg',
  blocked: 'bg-st-blocked-bg border-st-blocked-bd text-st-blocked-fg',
};
/** Label = the exact API enum value, underscores shown as spaces. */
export function StatusBadge({ domain, value }: { domain: ToneDomain; value: string }) {
  const tone = toneOf(domain, value);
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 rounded border px-2 py-[3px]', TONE_CLS[tone])} data-enum={value}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      <span className="whitespace-nowrap text-[11px] font-semibold leading-[14px] tracking-[0.04em]">{enumLabel(value)}</span>
    </span>
  );
}

export function PriorityFlag({ priority }: { priority: Priority }) {
  const cls = priority === 'CRITICAL' ? 'bg-danger text-white border-transparent'
    : priority === 'URGENT' ? 'bg-warn-bg border-warn-border text-warn-fg' : 'border-line text-fg-2';
  return (
    <span className={cx('inline-flex shrink-0 items-center rounded border px-2 py-[3px] text-[11px] font-semibold leading-[14px] tracking-[0.04em]', cls)}>
      {priority}
    </span>
  );
}

// ---------------------------------------------------------------- Card + key/value rows
export function Card({ children, className, title }: { children: ReactNode; className?: string; title?: ReactNode }) {
  return (
    <section className={cx('flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-4', className)}>
      {title && <h2 className="text-base font-medium leading-6">{title}</h2>}
      {children}
    </section>
  );
}
export function KV({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-[120px] shrink-0 text-sm leading-5 text-fg-2">{label}</dt>
      <dd className={cx('min-w-0 flex-1 break-words', mono ? 'font-mono text-[13px] font-medium leading-[18px]' : 'text-base leading-6')}>{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- Inline alert
const ALERT_ICON: Record<Tone, ReactNode> = {
  blocked: <IconLock size={20} stroke={2} />, progress: <IconInfoCircle size={20} stroke={2} />,
  success: <IconCheck size={20} stroke={2} />, neutral: <IconInfoCircle size={20} stroke={2} />,
};
const ALERT_CLS: Record<Tone, string> = {
  blocked: 'bg-st-blocked-bg text-st-blocked-fg', progress: 'bg-st-progress-bg text-st-progress-fg',
  success: 'bg-st-success-bg text-st-success-fg', neutral: 'bg-st-neutral-bg text-st-neutral-fg',
};
export function InlineAlert({ tone, title, children, icon }: { tone: Tone; title: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div role={tone === 'blocked' ? 'alert' : 'status'} className={cx('flex gap-2 rounded-md px-3 py-2.5', ALERT_CLS[tone])}>
      <span className="mt-0.5 shrink-0">{icon ?? ALERT_ICON[tone]}</span>
      <div className="min-w-0">
        <p className="text-base font-medium leading-6">{title}</p>
        {children && <div className="text-sm leading-5 opacity-90">{children}</div>}
      </div>
    </div>
  );
}

/** "NEEDS ENDPOINT" note — makes an API gap visible on the screen it affects. */
export function GapNote({ code, children }: { code: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-dashed border-warn-border bg-warn-bg px-3 py-2 text-sm leading-5 text-warn-fg">
      <span className="shrink-0 font-mono text-[12px] font-medium leading-5">{code}</span>
      <span>{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------- Text area (Figma "Text field", mobile)
type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; helper?: string; error?: string; readOnlyLocked?: boolean };
export function TextArea({ label, helper, error, readOnlyLocked, id, className, ...rest }: TextAreaProps) {
  const fid = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  if (readOnlyLocked) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-base font-medium leading-6">{label}</span>
        <div className="flex min-h-[52px] items-start gap-2 rounded-xl border border-line bg-subtle px-3 py-3.5 text-base leading-6">
          <IconLock size={18} className="mt-0.5 shrink-0 text-fg-muted" />
          <span className="whitespace-pre-wrap break-words">{(rest.value as string) || '—'}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={fid} className="text-base font-medium leading-6">{label}</label>
      <textarea
        id={fid}
        rows={3}
        aria-invalid={!!error || undefined}
        aria-describedby={helper || error ? `${fid}-h` : undefined}
        {...rest}
        className={cx(
          'min-h-[52px] w-full resize-y rounded-xl border bg-surface px-3 py-3.5 text-base leading-6 placeholder:text-fg-muted focus:border-line-focus focus:outline-none',
          error ? 'border-danger' : 'border-line-strong',
        )}
      />
      {(error || helper) && (
        <p id={`${fid}-h`} className={cx('text-sm leading-5', error ? 'text-st-blocked-fg' : 'text-fg-2')}>{error ?? helper}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- loading / empty / error
export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-4" aria-hidden>
      {[96, 240, 180, 80].map((w, i) => <div key={i} className="h-3 animate-pulse rounded bg-disabled" style={{ width: w }} />)}
    </div>
  );
}
export function LoadingList({ count = 4 }: { count?: number }) {
  return <div className="flex flex-col gap-3" role="status" aria-label="Loading">{Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}</div>;
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-subtle text-fg-muted">{icon}</div>
      <h2 className="text-xl font-semibold leading-[26px]">{title}</h2>
      {children && <div className="text-base leading-6 text-fg-2">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center" role="alert">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-st-blocked-bg text-st-blocked-fg">
        <IconAlertTriangle size={28} stroke={2} />
      </div>
      <h2 className="text-xl font-semibold leading-[26px]">{title}</h2>
      <p className="max-w-sm text-base leading-6 text-fg-2">{message ?? 'Check your connection, then try again. Your timers keep running on the server.'}</p>
      {onRetry && <Button kind="secondary" icon={<IconRefresh size={20} />} onClick={onRetry}>Try again</Button>}
    </div>
  );
}

// ---------------------------------------------------------------- Bottom sheet (mobile)
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-surface px-4 pb-7 pt-3">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-4 text-xl font-semibold leading-[26px]">{title}</h2>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-2 rounded-lg bg-st-success-bg px-3 py-2.5 text-sm leading-5 text-st-success-fg">
      <IconCheck size={18} stroke={2} /> {children}
    </div>
  );
}

/** Sticky bottom action bar (mobile). */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-line bg-surface px-4 pb-7 pt-3">
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function FormError({ messages }: { messages: string[] | null }) {
  if (!messages?.length) return null;
  return (
    <InlineAlert tone="blocked" title="The server rejected this" icon={<IconAlertTriangle size={20} />}>
      <ul className="list-disc pl-4">{messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
    </InlineAlert>
  );
}
