// Global overlays opened from the top nav.
// - NotificationsPanel: "Global · Notifications panel" 177:110497 → menu 177:110687 (420 wide, right-aligned 8px
//   under the bell, scrim .4, popover surface, head 15/20 SemiBold). There is NO notifications endpoint (G23):
//   the panel renders its empty/gap state instead of the drawn rows, and no unread dot is shown on the bell.
// - SearchPalette: "Global · Search" 177:110929 → menu 177:111119 (640 wide, centred, 120px from the top,
//   scrim .6, gap 4). Input: subtle fill, 2px brand stroke (focused), px-14 py-12, radius 14, gap 10, 20px search
//   icon, "Esc" Data/ID muted. "Results" label 12/16 SemiBold muted. There is NO search endpoint (G24).
import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { IconBell, IconSearch } from '@tabler/icons-react';
import { Ic } from '../ui/desktop/Icon';
import { GapNote } from '../ui/desktop/Feedback';
import { ActionItem, MenuSurface } from '../ui/desktop/Menu';
import { Popover, Scrim, useDismiss } from '../ui/desktop/Popover';

export function NotificationsPanel({ open, onClose, anchorRef }: { open: boolean; onClose: () => void; anchorRef: RefObject<HTMLElement> }) {
  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} align="end" scrim={0.4} width={420} label="Notifications">
      <MenuSurface variant="popover">
        <div className="flex w-full items-center gap-[8px] overflow-clip px-[12px] py-[8px]">
          <p className="min-w-0 flex-1 text-[15px] font-semibold leading-[20px] text-fg">Notifications</p>
        </div>
        <ActionItem icon={IconBell} label="No notifications to show" sub="Report, request, offer, PO and GRN events will appear here." disabled />
        <div className="px-[4px] pb-[4px] pt-[2px]">
          <GapNote code="G23">The API has no notifications endpoint yet, so this panel can't list events.</GapNote>
        </div>
      </MenuSurface>
    </Popover>
  );
}

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  useDismiss(open, onClose);
  useEffect(() => { if (!open) setQ(''); }, [open]);
  if (!open) return null;
  return createPortal(
    <>
      <Scrim alpha={0.6} onClick={onClose} />
      <div role="dialog" aria-label="Search" className="fixed left-1/2 top-[120px] z-50 w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2">
        <MenuSurface variant="popover" gap={4}>
          <div className="ring-inside-brand flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border bg-subtle px-[14px] py-[12px]">
            <Ic icon={IconSearch} size={20} className="text-fg-2" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search jobs, JINs, requests, quotes, POs"
              aria-label="Search"
              className="min-w-0 flex-1 bg-transparent text-[14px] leading-[20px] text-fg placeholder:text-fg-muted focus:outline-none"
            />
            <span className="shrink-0 whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-fg-muted">Esc</span>
          </div>
          <p className="whitespace-pre text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-muted">{'  Results'}</p>
          <ActionItem
            icon={IconSearch}
            label={q ? `No results for “${q}”` : 'Type to search'}
            sub="Global search isn't connected to the API yet."
            disabled
          />
          <div className="px-[4px] pb-[4px]">
            <GapNote code="G24">The API has no global search endpoint. Open a record from its list instead.</GapNote>
          </div>
        </MenuSurface>
      </div>
    </>,
    document.body,
  );
}
