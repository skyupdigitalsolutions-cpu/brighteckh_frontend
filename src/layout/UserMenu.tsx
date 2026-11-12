// Figma "Global · User menu" (177:110716): name, login · ROLE, company, Sign out.
// Theme / profile / help entries are omitted — no backing endpoints or scope in this pass.
import { useEffect, useRef, useState } from 'react';
import { IconLogout } from '@tabler/icons-react';
import { useAuth, useMe } from '../auth/AuthProvider';
import { ROLE_LABEL } from '../auth/access';
import { BottomSheet, Button, cx } from '../ui/primitives';

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

function Identity() {
  const me = useMe();
  const { companyName, companyCode } = useAuth();
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-base font-semibold leading-6">{me.full_name}</p>
      <p className="text-sm leading-5 text-fg-2">
        <span className="font-mono text-[13px]">{me.login_id}</span> · {me.role}
      </p>
      <p className="text-sm leading-5 text-fg-2">
        Company: {companyName ?? '…'}{companyCode ? ` (${companyCode})` : ''}
      </p>
    </div>
  );
}

/** Desktop: avatar + name/role button with a dropdown. */
export function UserMenuDesktop() {
  const me = useMe();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-subtle"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">{initials(me.full_name)}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-semibold">{me.full_name}</span>
          <span className="block text-xs text-fg-2">{ROLE_LABEL[me.role]}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-line bg-surface p-4 shadow-lg">
          <Identity />
          <div className="my-3 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={async () => { setBusy(true); await logout(); }}
            className={cx('flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-st-blocked-fg hover:bg-st-blocked-bg', busy && 'opacity-60')}
          >
            <IconLogout size={18} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Mobile: avatar button in the app bar opening a bottom sheet. */
export function UserMenuMobile() {
  const me = useMe();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Account"
        onClick={() => setOpen(true)}
        className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white"
      >
        {initials(me.full_name)}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Account">
        <Identity />
        <Button kind="secondary" block busy={busy} icon={<IconLogout size={20} />} onClick={async () => { setBusy(true); await logout(); }}>
          Sign out
        </Button>
      </BottomSheet>
    </>
  );
}
