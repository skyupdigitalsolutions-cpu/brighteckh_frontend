// Toolbar search (177:102746 default / 177:107582 applied): surface fill, 1px border-default, h-40, w-300,
// pl-14 pr-12, radius 20, gap 8; 18px search icon (muted); placeholder 14/20 muted; value 14/20 primary.
// Applied (non-empty) = 2px brand inside-stroke + 16px clear (x, secondary).
import { IconSearch, IconX } from '@tabler/icons-react';
import { cx, Ic } from './Icon';

export function SearchField({ value, onChange, placeholder, width = 300, className, autoFocus, label }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  width?: number | 'full';
  className?: string;
  autoFocus?: boolean;
  label?: string;
}) {
  const applied = value.length > 0;
  return (
    <div
      className={cx(
        'flex h-[40px] shrink-0 items-center gap-[8px] overflow-clip rounded-t-popover border border-line bg-surface pl-[14px] pr-[12px] focus-within:ring-inside-brand',
        applied && 'ring-inside-brand',
        className,
      )}
      style={width === 'full' ? undefined : { width }}
    >
      <Ic icon={IconSearch} size={18} className="text-fg-muted" />
      <input
        type="search"
        aria-label={label ?? placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[14px] leading-[20px] text-fg placeholder:text-fg-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {applied && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="flex h-[16px] w-[16px] items-center justify-center text-fg-2">
          <Ic icon={IconX} size={16} />
        </button>
      )}
    </div>
  );
}
