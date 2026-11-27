// Admin Settings local pieces (Figma AST-D 293:59592; values from get_design_context on AST0 293:59593).
// - SettingsToolbar  293:59812: glass-strong + glass border, radius 30, px-10 py-8, gap 10. Company switcher chips
//   (gap 6; chip px-14 py-8, radius 20, gap 8, 16px building icon, 14/20 Medium; selected = brand-subtle + brand-border +
//   primary text, else bg-subtle + border-default + secondary). Spacer, "Last saved …" 12/16 secondary, Discard
//   (secondary pill, 36) + Save changes (primary pill, 36, check icon).
// - SCard  293:59878: glass-strong + glass border, radius 24, p-22, gap 12, head 15/20 SemiBold.
// - SField 293:59881 "Text field": label 14/20 Medium, gap 6, box h-36, radius 12, px-12, bg-surface, 1px border-strong,
//   value 14/20; helper 12/16 secondary (error = blocked-fg + danger stroke, as 293:60667).
// - Note 293:59908 "Read-only note": bg-subtle, radius 12, px-12 py-10, gap 8, 16px info icon, 12/16 secondary.
// - SChip 293:59917: px-12 py-7, radius 16, 1px border, 11/14 SemiBold +0.44 (selected = brand-subtle + brand-border).
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { IconBuilding, IconCheck, IconInfoCircle, IconLock } from '@tabler/icons-react';
import { formatDateTime } from '../../lib/format';
import { Button, GlassCard, Ic, InlineAlert, cx } from '../../ui/desktop';
import type { AdminCompany, CompanySettings, SettingsTab } from './api';

export function SettingsToolbar({ companies, companyId, onCompany, saved, savedJustNow, left, dirty, canSave, busy, onDiscard, onSave }: {
  companies?: AdminCompany[];
  companyId?: string;
  onCompany?: (id: string) => void;
  saved?: CompanySettings['last_saved'][SettingsTab];
  savedJustNow?: boolean;
  /** Replaces the company switcher (Numbering: a plain context line). */
  left?: ReactNode;
  dirty?: boolean;
  canSave?: boolean;
  busy?: boolean;
  onDiscard?: () => void;
  onSave?: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip rounded-[30px] border border-glass-border glass-strong px-[10px] py-[8px]">
      {left ?? (
        <div role="radiogroup" aria-label="Company" className="flex items-start gap-[6px] overflow-clip">
          {(companies ?? []).filter((c) => c.is_active).map((c) => {
            const on = c.id === companyId;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onCompany?.(c.id)}
                className={cx(
                  'flex shrink-0 items-center gap-[8px] overflow-clip rounded-[20px] border px-[14px] py-[8px] text-[14px] font-medium leading-[20px] whitespace-nowrap',
                  on ? 'border-brand-border bg-brand-subtle text-fg' : 'border-line bg-subtle text-fg-2 hover:bg-surface',
                )}
              >
                <Ic icon={IconBuilding} size={16} className={on ? 'text-brand-logo' : 'text-fg-2'} />
                {c.entity_code} · {c.legal_name ?? c.name}
              </button>
            );
          })}
        </div>
      )}
      <div className="h-px min-w-px flex-1" />
      {onSave && (
        <>
          <p className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">
            {savedJustNow && saved ? `Saved just now · ${saved.by_name}`
              : saved ? `Last saved ${formatDateTime(saved.at)} · ${saved.by_name}` : 'Not saved from Settings yet'}
          </p>
          <Button kind="secondary" onClick={onDiscard} disabled={!dirty || busy}>Discard</Button>
          <Button icon={<Ic icon={IconCheck} size={18} />} onClick={onSave} disabled={!canSave} busy={busy}>Save changes</Button>
        </>
      )}
    </div>
  );
}

export function SCard({ title, right, children, className }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <GlassCard strong radius="rounded-[24px]" className={cx('flex min-w-px flex-1 flex-col items-start gap-[12px] border border-glass-border p-[22px]', className)}>
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className="min-w-px flex-1 text-[15px] font-semibold leading-[20px] text-fg">{title}</h2>
        {right}
      </div>
      {children}
    </GlassCard>
  );
}

const box = (error?: boolean, locked?: boolean) => cx(
  'flex h-[36px] w-full items-center gap-[8px] overflow-clip rounded-[12px] border px-[12px]',
  locked ? 'border-line bg-subtle' : 'border-line-strong bg-surface focus-within:ring-inside-brand',
  error && 'ring-inside-danger',
);

/** AST text field (h-36). `locked` = read-only value set elsewhere / by the system (lock icon, no edit affordance). */
export function SField({ label, helper, error, locked, trailing, className, mono, ...rest }: {
  label: ReactNode; helper?: ReactNode; error?: string | null; locked?: boolean; trailing?: ReactNode; className?: string; mono?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={cx('flex w-full min-w-px flex-1 flex-col items-start gap-[6px]', className)}>
      <label htmlFor={id} className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</label>
      <div className={box(!!error, locked)}>
        {locked && <Ic icon={IconLock} size={16} className="shrink-0 text-fg-2" />}
        <input
          id={id}
          readOnly={locked}
          aria-invalid={!!error || undefined}
          {...rest}
          className={cx('min-w-0 flex-1 bg-transparent text-[14px] leading-[20px] text-fg placeholder:text-fg-muted focus:outline-none', mono && 'font-mono')}
        />
        {trailing && <span className="shrink-0 text-[12px] leading-[16px] text-fg-muted">{trailing}</span>}
      </div>
      {(error || helper) && <p className={cx('text-[12px] leading-[16px]', error ? 'text-st-blocked-fg' : 'text-fg-2')}>{error || helper}</p>}
    </div>
  );
}

export function Pair({ children }: { children: ReactNode }) {
  return <div className="flex w-full items-start gap-[12px] overflow-clip">{children}</div>;
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[8px] overflow-clip rounded-[12px] bg-subtle px-[12px] py-[10px]">
      <Ic icon={IconInfoCircle} size={16} className="shrink-0 text-fg-2" />
      <p className="min-w-px flex-1 text-[12px] leading-[16px] text-fg-2">{children}</p>
    </div>
  );
}

export function SChip({ label, on, onClick, disabled }: { label: string; on: boolean; onClick?: () => void; disabled?: boolean }) {
  const cls = cx(
    'flex shrink-0 items-start overflow-clip rounded-[16px] border px-[12px] py-[7px] text-[11px] font-semibold leading-[14px] tracking-[0.44px] whitespace-nowrap',
    on ? 'border-brand-border bg-brand-subtle text-fg' : 'border-line bg-subtle text-fg-2',
    disabled ? 'cursor-not-allowed opacity-60' : onClick && !on && 'hover:bg-surface',
  );
  if (!onClick) return <span className={cls}>{label}</span>;
  return <button type="button" role="radio" aria-checked={on} disabled={disabled} onClick={onClick} className={cls}>{label}</button>;
}

/** A labelled group of chips (Policies rows: label 14/20 Medium, optional 12/16 secondary sub-line, chips gap 6). */
export function ChipRow({ label, sub, children }: { label: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-start gap-[6px] border-b border-line pb-[12px]">
      <div className="flex w-full flex-col gap-[2px]">
        <p className="text-[14px] font-medium leading-[20px] text-fg">{label}</p>
        {sub && <p className="text-[12px] leading-[16px] text-fg-2">{sub}</p>}
      </div>
      <div role="radiogroup" aria-label={typeof label === 'string' ? label : undefined} className="flex flex-wrap items-start gap-[6px]">{children}</div>
    </div>
  );
}

/** Label-left / small input-right row (Policies "Max discount" 5 %, "Customer return window" 15 days). */
export function InlineNumber({ label, sub, value, onChange, unit, error, placeholder, width = 64 }: {
  label: ReactNode; sub?: ReactNode; value: string; onChange: (v: string) => void; unit: string; error?: string | null;
  placeholder?: string; width?: number;
}) {
  const id = useId();
  return (
    <div className="flex w-full flex-col gap-[4px] border-b border-line pb-[12px]">
      <div className="flex w-full items-center gap-[12px]">
        <div className="flex min-w-px flex-1 flex-col gap-[2px]">
          <label htmlFor={id} className="text-[14px] font-medium leading-[20px] text-fg">{label}</label>
          {sub && <p className="text-[12px] leading-[16px] text-fg-2">{sub}</p>}
        </div>
        <NumBox id={id} value={value} onChange={onChange} unit={unit} error={!!error} placeholder={placeholder} width={width} />
      </div>
      {error && <p className="text-[12px] leading-[16px] text-st-blocked-fg">{error}</p>}
    </div>
  );
}

export function NumBox({ id, value, onChange, unit, error, placeholder, width = 64, label }: {
  id?: string; value: string; onChange: (v: string) => void; unit: string; error?: boolean; placeholder?: string; width?: number; label?: string;
}) {
  return (
    <div className={box(error)} style={{ width: width + 24 + unit.length * 7 }}>
      <input
        id={id}
        aria-label={label}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent font-mono text-[14px] leading-[20px] text-fg placeholder:font-sans placeholder:text-[12px] placeholder:text-fg-muted focus:outline-none"
      />
      <span className="shrink-0 text-[12px] leading-[16px] text-fg-muted">{unit}</span>
    </div>
  );
}

export function SavedAlert({ title, children }: { title: string; children: ReactNode }) {
  return <InlineAlert tone="success" title={title}>{children}</InlineAlert>;
}

export function FixAlert({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <InlineAlert tone="blocked" title={`Fix ${errors.length} field${errors.length === 1 ? '' : 's'} before saving`}>
      {errors.length === 1 ? errors[0] : <ul className="list-disc pl-[16px]">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </InlineAlert>
  );
}

/** Loading (293:61395): the tab's cards with their titles and skeleton rows. */
export function CardsSkeleton({ titles }: { titles: string[] }) {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-[674px] w-full items-stretch gap-[16px]">
      {titles.map((t) => (
        <SCard key={t} title={t}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex h-[30px] w-full items-center gap-[12px] rounded-[8px] bg-surface px-[12px]">
              <div className="h-[8px] w-[68px] animate-pulse rounded-[4px] bg-disabled" />
              <div className="h-[8px] w-[156px] animate-pulse rounded-[4px] bg-disabled" />
              <div className="h-[8px] w-[96px] animate-pulse rounded-[4px] bg-disabled" />
            </div>
          ))}
        </SCard>
      ))}
    </div>
  );
}

/** Role display (AST1 select): Finance = "Finance (Accounts)", Management = "Management (MD)". */
export const ROLE_OPTION_LABEL: Record<string, string> = {
  PURCHASE: 'Purchase', ENGINEER: 'Engineer', SALES: 'Sales', STORES_QUALITY: 'Stores / Quality', EXTERNAL_COORD: 'External coordinator',
  FINANCE: 'Finance (Accounts)', MANAGEMENT: 'Management (MD)', SYSTEM_ADMIN: 'System admin',
};
