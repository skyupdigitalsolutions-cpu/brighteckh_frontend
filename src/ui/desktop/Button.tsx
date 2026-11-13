// Figma "Button" 4:392, Size=Desktop: h-36, px-14, gap-8, radius full, 14/20 SemiBold, icon 18.
// Primary = accent fill + on-accent text · Secondary = surface + 1px border-strong · Ghost = text only ·
// Danger = danger fill. Disabled (gated only — see GatedAction) = bg-disabled + text-disabled; ghost disabled has no fill.
// PillButton = dashboard "See all" (177:102631): subtle fill, 1px default border, px-16 py-8, radius 18, 14/20 Medium.
// IconButton = round subtle icon button (top-nav search 177:102545/76:775 = 44px, drawer close 177:108452 = 40px).
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from './Icon';

export type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

const KIND: Record<ButtonKind, string> = {
  primary: 'bg-accent text-fg-on-accent hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-fg hover:bg-subtle',
  ghost: 'text-fg hover:bg-subtle',
  danger: 'bg-danger text-fg-inverse hover:opacity-90',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: ButtonKind;
  icon?: ReactNode;
  busy?: boolean;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { kind = 'primary', icon, busy, block, className, children, disabled, type = 'button', ...rest }, ref,
) {
  const off = disabled || busy;
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      disabled={off}
      aria-busy={busy || undefined}
      className={cx(
        'inline-flex h-[36px] shrink-0 items-center justify-center gap-[8px] whitespace-nowrap rounded-t-full px-[14px] text-[14px] font-semibold leading-[20px] transition-colors',
        off ? (kind === 'ghost' ? 'cursor-not-allowed text-fg-disabled' : 'cursor-not-allowed bg-disabled text-fg-disabled')
          : KIND[kind],
        block && 'w-full',
        className,
      )}
    >
      {busy ? <span className="h-[16px] w-[16px] animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/** Same visual as Button, rendered as a router link (navigation actions). */
export function ButtonLink({ to, kind = 'primary', icon, className, children }: {
  to: string; kind?: ButtonKind; icon?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex h-[36px] shrink-0 items-center justify-center gap-[8px] whitespace-nowrap rounded-t-full px-[14px] text-[14px] font-semibold leading-[20px] transition-colors',
        KIND[kind], className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

export function PillButton({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex shrink-0 items-start whitespace-nowrap rounded-t-chip border border-line bg-subtle px-[16px] py-[8px] text-[14px] font-medium leading-[20px] text-fg hover:bg-surface',
        className,
      )}
    >
      {children}
    </button>
  );
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { size?: 40 | 44; label: string }>(
  function IconButton({ size = 44, label, className, children, type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        {...rest}
        className={cx(
          'relative inline-flex shrink-0 items-center justify-center overflow-clip bg-subtle text-fg-2 hover:bg-disabled',
          size === 44 ? 'h-[44px] w-[44px] rounded-t-pill' : 'h-[40px] w-[40px] rounded-t-popover',
          className,
        )}
      >
        {children}
      </button>
    );
  },
);
