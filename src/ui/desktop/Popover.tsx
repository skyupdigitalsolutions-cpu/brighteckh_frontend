// Anchored overlay + "Dismiss (click outside)" scrim, as drawn on every open-menu frame.
// Rendered in a portal: the glass surfaces use backdrop-filter, which would trap position:fixed children.
// Scrim alphas from Figma: filter menus 0.25 (177:106009), notifications / user menu 0.4 (177:110686,
// 177:110905), search 0.6 (177:111118), drawer 0.55 (177:108446).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './Icon';

export function useDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
}

export function Scrim({ alpha, onClick, z = 'z-40' }: { alpha: number; onClick: () => void; z?: string }) {
  return (
    <button
      type="button"
      aria-label="Close"
      tabIndex={-1}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cx('fixed inset-0 block cursor-default', z)}
      style={{ background: `rgba(0,0,0,${alpha})` }}
    />
  );
}

type Pos = { top: number; left?: number; right?: number; minWidth?: number };

/**
 * Popover anchored to `anchorRef`, `offset` px below it (Figma: 8px), aligned to the anchor's start or end edge.
 * `matchWidth` makes the panel at least as wide as the anchor.
 */
export function Popover({ open, onClose, anchorRef, align = 'start', offset = 8, scrim = 0.25, width, className, children, label }: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement>;
  align?: 'start' | 'end';
  offset?: number;
  scrim?: number;
  width?: number;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const [pos, setPos] = useState<Pos | null>(null);
  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(align === 'end'
      ? { top: r.bottom + offset, right: window.innerWidth - r.right }
      : { top: r.bottom + offset, left: r.left });
  }, [anchorRef, align, offset]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, place]);
  useDismiss(open, onClose);

  if (!open || !pos) return null;
  return createPortal(
    <>
      <Scrim alpha={scrim} onClick={onClose} />
      <div
        role="dialog"
        aria-label={label}
        className={cx('fixed z-50', className)}
        // Portals bubble React events to their React parents (e.g. a row <Link>): stop that here.
        onClick={(e) => e.stopPropagation()}
        style={{ top: pos.top, left: pos.left, right: pos.right, width }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

/** Ref + open state helper for a trigger/popover pair. */
export function useAnchor<T extends HTMLElement = HTMLButtonElement>() {
  const ref = useRef<T>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  return { ref, open, setOpen, close, toggle };
}
