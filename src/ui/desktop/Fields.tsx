// Desktop form fields, as drawn in the Create JIN drawer (177:108454) + Figma "Text field" states 4:451.
// Field: label 14/20 Medium primary → box → helper 12/16 secondary (error helper = blocked-fg); gap 6.
// Box: h-44, px-14, radius 12, gap 8, bg-subtle, 1px border-strong; value 14/20 Regular primary, or Data/ID
// (13/18 mono Medium) for codes/numbers (`mono`); placeholder muted; 18px trailing icon secondary.
// Focus = 2px brand inside-stroke (Customer box 177:108457). Error = 2px danger inside-stroke (4:403).
// Disabled = bg-disabled + text-disabled (4:408). Read-only/locked = bg-subtle + 1px border-default + 16px lock (4:413).
// ChoiceChips: Channel / Priority option chips (177:108473): px-16 py-10, radius 18, 11/14 SemiBold +0.44;
// selected = brand-subtle + 1px brand-border + primary text; other = bg-subtle + 1px border-default + secondary.
// FieldRow: two fields side by side, gap 14 (177:108461).
// PhotoPicker: Figma "Photo capture" desktop states 6:416 (empty) / 6:427 (uploading) / 6:447 (uploaded) / 6:475 (failed).
import {
  forwardRef, useId, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { IconAlertTriangle, IconCalendar, IconChevronDown, IconLock, IconPhoto, IconPlus, IconRefresh, IconUpload } from '@tabler/icons-react';
import { cx, Ic } from './Icon';
import { Button } from './Button';

// ---------------------------------------------------------------- Field wrapper
export function Field({ label, helper, error, children, htmlFor, className }: {
  label: ReactNode; helper?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; className?: string;
}) {
  return (
    <div className={cx('flex w-full min-w-0 flex-col items-start gap-[6px]', className)}>
      <label htmlFor={htmlFor} className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</label>
      {children}
      {(error || helper) && (
        <p className={cx('text-[12px] leading-[16px]', error ? 'text-st-blocked-fg' : 'text-fg-2')}>{error || helper}</p>
      )}
    </div>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="flex w-full items-start gap-[14px] [&>*]:min-w-px [&>*]:flex-1">{children}</div>;
}

const boxBase = 'flex h-[44px] w-full items-center gap-[8px] overflow-clip rounded-t-field border px-[14px]';
const boxState = (error?: boolean, disabled?: boolean) => cx(
  boxBase,
  disabled ? 'border-line-strong bg-disabled text-fg-disabled' : 'border-line-strong bg-subtle',
  !disabled && 'focus-within:ring-inside-brand',
  error && 'ring-inside-danger',
);
const inputText = (mono?: boolean) => cx(
  'min-w-0 flex-1 bg-transparent placeholder:text-fg-muted focus:outline-none disabled:text-fg-disabled',
  mono ? 'font-mono text-[13px] font-medium leading-[18px] text-fg' : 'text-[14px] leading-[20px] text-fg',
);

type BaseProps = { label: ReactNode; helper?: ReactNode; error?: string | null; mono?: boolean; className?: string };

// ---------------------------------------------------------------- Text / number
export const TextInput = forwardRef<HTMLInputElement, BaseProps & InputHTMLAttributes<HTMLInputElement> & { trailing?: ReactNode }>(
  function TextInput({ label, helper, error, mono, className, id, disabled, trailing, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <Field label={label} helper={helper} error={error} htmlFor={fid} className={className}>
        <div className={boxState(!!error, disabled)}>
          <input ref={ref} id={fid} disabled={disabled} aria-invalid={!!error || undefined} {...rest} className={inputText(mono)} />
          {trailing}
        </div>
      </Field>
    );
  },
);

/** Integer/decimal input (Data/ID mono style, like "Declared quantity"). Value stays a string — parse at submit. */
export const NumberInput = forwardRef<HTMLInputElement, BaseProps & InputHTMLAttributes<HTMLInputElement>>(
  function NumberInput(props, ref) {
    return <TextInput ref={ref} inputMode="decimal" mono {...props} />;
  },
);

// ---------------------------------------------------------------- Textarea (multi-line variant of the same box)
export function TextAreaField({ label, helper, error, className, id, disabled, rows = 3, ...rest }: Omit<BaseProps, 'mono'> & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} helper={helper} error={error} htmlFor={fid} className={className}>
      <div className={cx(boxState(!!error, disabled), 'h-auto min-h-[44px] items-start py-[11px]')}>
        <textarea
          id={fid}
          rows={rows}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          {...rest}
          className={cx(inputText(false), 'resize-y')}
        />
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- Select (native, styled as the drawer box)
export function SelectField({ label, helper, error, className, id, disabled, placeholder, children, ...rest }: Omit<BaseProps, 'mono'> & SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} helper={helper} error={error} htmlFor={fid} className={className}>
      <div className={cx(boxState(!!error, disabled), 'relative')}>
        <select
          id={fid}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          {...rest}
          className={cx(inputText(false), 'appearance-none pr-[26px]', rest.value === '' && 'text-fg-muted')}
        >
          {placeholder !== undefined && <option value="" disabled>{placeholder}</option>}
          {children}
        </select>
        <Ic icon={IconChevronDown} size={18} className="pointer-events-none absolute right-[14px] text-fg-2" />
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- Date / date-time (native picker, Figma calendar icon)
export function DateField({ label, helper, error, className, id, disabled, withTime, ...rest }: Omit<BaseProps, 'mono'> & InputHTMLAttributes<HTMLInputElement> & { withTime?: boolean }) {
  const auto = useId();
  const fid = id ?? auto;
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Field label={label} helper={helper} error={error} htmlFor={fid} className={className}>
      <div className={boxState(!!error, disabled)}>
        <input
          ref={ref}
          id={fid}
          type={withTime ? 'datetime-local' : 'date'}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          {...rest}
          className={cx(inputText(false), '[&::-webkit-calendar-picker-indicator]:hidden')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Open calendar"
          disabled={disabled}
          onClick={() => { try { ref.current?.showPicker(); } catch { ref.current?.focus(); } }}
          className="flex h-[18px] w-[18px] items-center justify-center text-fg-2"
        >
          <Ic icon={IconCalendar} size={18} />
        </button>
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- Read-only (locked record)
export function ReadOnlyField({ label, value, helper, mono, className }: { label: ReactNode; value: ReactNode; helper?: ReactNode; mono?: boolean; className?: string }) {
  return (
    <Field label={label} helper={helper} className={className}>
      <div className={cx(boxBase, 'border-line bg-subtle')}>
        <Ic icon={IconLock} size={16} className="text-fg-muted" />
        <span className={cx('truncate', mono ? 'font-mono text-[13px] font-medium leading-[18px]' : 'text-[14px] leading-[20px]', 'text-fg')}>{value || '—'}</span>
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- Choice chips (single select)
export function ChoiceChips<V extends string>({ label, value, options, onChange, error, helper, className }: {
  label: ReactNode; value: V | null | undefined; options: { value: V; label: string }[]; onChange: (v: V) => void;
  error?: string | null; helper?: ReactNode; className?: string;
}) {
  return (
    <div role="radiogroup" className={cx('flex w-full flex-col items-start gap-[6px]', className)}>
      <span className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</span>
      <div className="flex flex-wrap items-start gap-[8px]">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cx(
                'flex items-start overflow-clip rounded-t-chip border px-[16px] py-[10px] text-[11px] font-semibold leading-[14px] tracking-[0.44px] whitespace-nowrap',
                on ? 'border-brand-border bg-brand-subtle text-fg' : 'border-line bg-subtle text-fg-2 hover:bg-surface',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {(error || helper) && <p className={cx('text-[12px] leading-[16px]', error ? 'text-st-blocked-fg' : 'text-fg-2')}>{error || helper}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Photo / file picker
export type PickedFile = {
  key: string;
  name: string;
  /** Object URL for an image preview; when absent the Figma photo glyph is shown. */
  previewUrl?: string;
  state: 'uploading' | 'uploaded' | 'failed';
  /** 0–100, shown under an uploading thumb. */
  progress?: number;
};

export function PhotoPicker({ title = 'Photos', required, files, onFiles, onRetry, accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif', hint = 'JPG or PNG · Use camera on tablet', errorText = 'Upload failed. Check your connection and retry.', disabled }: {
  title?: string;
  /** Shows "Required · at least 1" (blocked-fg) while no file is uploaded. */
  required?: boolean;
  files: PickedFile[];
  onFiles: (files: File[]) => void;
  onRetry?: () => void;
  accept?: string;
  hint?: string;
  errorText?: string;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const pick = () => input.current?.click();
  const uploaded = files.filter((f) => f.state !== 'failed').length;
  const failed = files.some((f) => f.state === 'failed');
  const take = (list: FileList | null) => { if (list?.length) onFiles(Array.from(list)); };

  return (
    <div className="flex w-full flex-col items-start gap-[12px]">
      <div className="flex w-full items-center gap-[8px]">
        <p className="min-w-0 flex-1 text-[14px] font-medium leading-[20px] text-fg">{title}</p>
        {files.length === 0
          ? required && <p className="whitespace-nowrap text-[12px] leading-[16px] text-st-blocked-fg">Required · at least 1</p>
          : <p className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{uploaded} {uploaded === 1 ? 'photo' : 'photos'}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        hidden
        disabled={disabled}
        onChange={(e) => { take(e.target.files); e.target.value = ''; }}
      />
      {files.length === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={pick}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (!disabled) take(e.dataTransfer.files); }}
          className="flex h-[140px] w-full flex-col items-center justify-center gap-[8px] overflow-clip rounded-t-lg border-2 border-dashed border-line-strong bg-subtle"
        >
          <Ic icon={IconUpload} size={28} className="text-fg" />
          <span className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">Drop a photo or browse</span>
          <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{hint}</span>
        </button>
      ) : (
        <div className="flex w-full flex-wrap items-start gap-[8px]">
          {files.map((f) => (
            <div key={f.key} className="flex flex-col items-start gap-[6px]">
              <div
                className={cx(
                  'flex h-[96px] w-[96px] items-center justify-center overflow-clip rounded-t-md bg-disabled',
                  f.state === 'failed' && 'border-2 border-danger',
                )}
                title={f.name}
              >
                {f.state === 'failed' ? <Ic icon={IconAlertTriangle} size={28} className="text-st-blocked-fg" />
                  : f.previewUrl ? <img src={f.previewUrl} alt={f.name} className="h-full w-full object-cover" />
                    : <Ic icon={IconPhoto} size={28} className="text-fg-2" />}
              </div>
              {f.state === 'uploading' && (
                <>
                  <div className="flex h-[4px] w-[96px] items-start overflow-clip rounded-[2px] bg-disabled">
                    <div className="h-[4px] rounded-[2px] bg-st-progress-fg" style={{ width: Math.round(96 * (f.progress ?? 0) / 100) }} />
                  </div>
                  <p className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">Uploading… {Math.round(f.progress ?? 0)}%</p>
                </>
              )}
            </div>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={pick}
            className="flex h-[96px] w-[96px] flex-col items-center justify-center gap-[4px] overflow-clip rounded-t-md border border-dashed border-line-strong"
          >
            <Ic icon={IconPlus} size={24} className="text-fg" />
            <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg">Add</span>
          </button>
        </div>
      )}
      {failed && (
        <div className="flex w-full items-center gap-[8px]">
          <p className="min-w-0 flex-1 text-[12px] leading-[16px] text-st-blocked-fg">{errorText}</p>
          {onRetry && <Button kind="secondary" icon={<Ic icon={IconRefresh} size={18} />} onClick={onRetry}>Retry</Button>}
        </div>
      )}
    </div>
  );
}
