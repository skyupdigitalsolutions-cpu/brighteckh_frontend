// Figma "P1 · Create JIN (drawer)" 177:108243.
// Scrim rgba(0,0,0,.55) over the page (177:108446). Panel 177:108447: 520 wide, 12px from the top/right/bottom
// viewport edges, surface fill, 1px glass border, radius 28.
// Header: pt-28 px-28 pb-20, gap 12; title 22/28 SemiBold, subtitle 14/20 secondary (gap 4); close = 40px round
// subtle button with 20px x (primary).
// Body: px-28 pt-4 pb-20, gap 18 (`bodyGap` 16 = the S1 RFQ drawers 177:122021 / 122262 / 122743), scrolls. Footer: 1px top border-default, pt-20 px-28 pb-28, gap 12; buttons
// flex-1 (e.g. Cancel secondary + primary action).
//
// variant="side" — the 480-wide drawer of D·P2a 177:103185 / D·P2b 177:103290 (assign engineer etc.): no border,
// shadow -12 0 40 rgba(26,13,13,.18); header pt-24 px-24 pb-16 (titles gap 2); body pt-8 px-24 pb-16 gap 16;
// footer 1px top border-default, pt-16 px-24 pb-24, children stacked (flex-col, items-start, gap 12 → buttons hug).
// Same scrim (.55), 12px viewport inset and radius 28. Replaces inward/detail/local.tsx SideDrawer.
import { useEffect, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { cx, Ic } from './Icon';
import { Scrim, useDismiss } from './Popover';

export function Drawer({ open, onClose, title, subtitle, children, footer, onSubmit, width, busy, variant = 'default', bodyGap = 18 }: {
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
  /** 'default' = 520 P1 drawer (177:108447); 'side' = 480 P2a/P2b drawer (177:103185 / 177:103290). */
  variant?: 'default' | 'side';
  /** Body gap for the default variant: 18 (P1 177:108447) or 16 (S1 RFQ drawers). */
  bodyGap?: 16 | 18;
}) {
  const side = variant === 'side';
  const w = width ?? (side ? 480 : 520);
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
      <div className={cx('flex w-full shrink-0 items-start gap-[12px] overflow-clip', side ? 'px-[24px] pb-[16px] pt-[24px]' : 'px-[28px] pb-[20px] pt-[28px]')}>
        <div className={cx('flex min-w-0 flex-1 flex-col', side ? 'gap-[2px]' : 'gap-[4px]')}>
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
      <div
        className={cx(
          'flex min-h-0 w-full flex-1 flex-col overflow-y-auto',
          side ? 'items-stretch gap-[16px] px-[24px] pb-[16px] pt-[8px]' : cx(bodyGap === 16 ? 'gap-[16px]' : 'gap-[18px]', 'px-[28px] pb-[20px] pt-[4px]'),
        )}
      >
        {children}
      </div>
      {footer && (side ? (
        <div className="flex w-full shrink-0 flex-col items-start gap-[12px] overflow-clip border-t border-line px-[24px] pb-[24px] pt-[16px]">
          {footer}
        </div>
      ) : (
        <div className="flex w-full shrink-0 items-start gap-[12px] overflow-clip border-t border-line px-[28px] pb-[28px] pt-[20px] [&>*]:min-w-px [&>*]:flex-1">
          {footer}
        </div>
      ))}
    </>
  );

  const panelCls = cx(
    'fixed bottom-[12px] right-[12px] top-[12px] z-50 flex max-w-[calc(100vw-24px)] flex-col items-stretch overflow-clip rounded-t-card bg-surface',
    side ? 'shadow-[-12px_0px_40px_0px_rgba(26,13,13,0.18)]' : 'border border-glass-border',
  );
  return createPortal(
    <>
      <Scrim alpha={0.55} onClick={close} />
      {onSubmit ? (
        <form
          role="dialog"
          aria-modal="true"
          className={panelCls}
          style={{ width: w }}
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(); }}
          noValidate
        >
          {inner}
        </form>
      ) : (
        <div role="dialog" aria-modal="true" className={cx(panelCls)} style={{ width: w }} onClick={(e) => e.stopPropagation()}>{inner}</div>
      )}
    </>,
    document.body,
  );
}
