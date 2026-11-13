// Figma "P1 · Create JIN (drawer)" 177:108243.
// Scrim rgba(0,0,0,.55) over the page (177:108446). Panel 177:108447: 520 wide, 12px from the top/right/bottom
// viewport edges, surface fill, 1px glass border, radius 28.
// Header: pt-28 px-28 pb-20, gap 12; title 22/28 SemiBold, subtitle 14/20 secondary (gap 4); close = 40px round
// subtle button with 20px x (primary).
// Body: px-28 pt-4 pb-20, gap 18, scrolls. Footer: 1px top border-default, pt-20 px-28 pb-28, gap 12; buttons
// flex-1 (e.g. Cancel secondary + primary action).
import { useEffect, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { cx, Ic } from './Icon';
import { Scrim, useDismiss } from './Popover';

export function Drawer({ open, onClose, title, subtitle, children, footer, onSubmit, width = 520, busy }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Footer buttons. When `onSubmit` is set the drawer is a <form>; give the primary button type="submit". */
  footer?: ReactNode;
  onSubmit?: () => void;
  width?: number;
  /** While true, Escape / scrim clicks don't close (a mutation is in flight). */
  busy?: boolean;
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

  const inner = (
    <>
      <div className="flex w-full shrink-0 items-start gap-[12px] overflow-clip px-[28px] pb-[20px] pt-[28px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
          <h2 className="text-[22px] font-semibold leading-[28px] text-fg">{title}</h2>
          {subtitle && <p className="text-[14px] leading-[20px] text-fg-2">{subtitle}</p>}
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
      <div className="flex min-h-0 w-full flex-1 flex-col gap-[18px] overflow-y-auto px-[28px] pb-[20px] pt-[4px]">{children}</div>
      {footer && (
        <div className="flex w-full shrink-0 items-start gap-[12px] overflow-clip border-t border-line px-[28px] pb-[28px] pt-[20px] [&>*]:min-w-px [&>*]:flex-1">
          {footer}
        </div>
      )}
    </>
  );

  const panelCls = 'fixed bottom-[12px] right-[12px] top-[12px] z-50 flex max-w-[calc(100vw-24px)] flex-col items-stretch overflow-clip rounded-t-card border border-glass-border bg-surface';
  return createPortal(
    <>
      <Scrim alpha={0.55} onClick={close} />
      {onSubmit ? (
        <form
          role="dialog"
          aria-modal="true"
          className={panelCls}
          style={{ width }}
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(); }}
          noValidate
        >
          {inner}
        </form>
      ) : (
        <div role="dialog" aria-modal="true" className={cx(panelCls)} style={{ width }} onClick={(e) => e.stopPropagation()}>{inner}</div>
      )}
    </>,
    document.body,
  );
}
