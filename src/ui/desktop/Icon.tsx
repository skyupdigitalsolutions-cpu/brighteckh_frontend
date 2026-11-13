// Figma icons are Tabler outline drawn at 24px with a 2px stroke, then scaled to 16/18/20/28px while the
// stroke stays 2px on screen. @tabler/icons-react scales the stroke with the size, so we compensate:
// stroke = 2 * 24 / size. Use <Ic> for every icon in the desktop kit/screens.
import type { TablerIcon as TablerIconType } from '@tabler/icons-react';
import { cx } from '../primitives';

export type TablerIcon = TablerIconType;

export function Ic({ icon: I, size = 18, className }: { icon: TablerIcon; size?: number; className?: string }) {
  return <I size={size} stroke={48 / size} className={cx('shrink-0', className)} aria-hidden />;
}

export { cx };
