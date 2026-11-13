// Table row kebab (Figma Icon/dots 20px, secondary, in the 40px last cell) + its menu (177:108933):
// popover variant (radius 20, shadow /.5), items = icon 18 + label 14/20, gap 12. Right-aligned 8px under
// the trigger. Items a role can't perform must not be passed (hidden, not disabled).
import { IconDots } from '@tabler/icons-react';
import { Ic, type TablerIcon } from './Icon';
import { ActionItem, MenuSurface } from './Menu';
import { Popover, useAnchor } from './Popover';

export type RowMenuItem = { label: string; icon?: TablerIcon; onSelect: () => void; sub?: string };

export function RowMenuTrigger({ items, label = 'Row actions', width = 240 }: { items: RowMenuItem[]; label?: string; width?: number }) {
  const a = useAnchor<HTMLButtonElement>();
  if (items.length === 0) return null;
  return (
    <>
      <button
        ref={a.ref}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={a.open}
        // Rows are clickable links; keep the kebab click from opening the row.
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); a.toggle(); }}
        className="flex h-[20px] w-[20px] items-center justify-center text-fg-2 hover:text-fg"
      >
        <Ic icon={IconDots} size={20} />
      </button>
      <Popover open={a.open} onClose={a.close} anchorRef={a.ref} align="end" scrim={0.25} width={width} label={label}>
        <MenuSurface variant="popover">
          {items.map((it) => (
            <ActionItem key={it.label} icon={it.icon} label={it.label} sub={it.sub} onClick={() => { a.close(); it.onSelect(); }} />
          ))}
        </MenuSurface>
      </Popover>
    </>
  );
}
