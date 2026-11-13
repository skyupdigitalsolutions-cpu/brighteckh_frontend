// Figma "Global · User menu" (177:110716 → menu 177:110906): 280 wide, right-aligned 8px under the user block,
// scrim .4, popover surface. Who block (pt-8 pb-10 px-12, gap 2): name 14/20 Medium, "login · ROLE" 12/16
// secondary, "Company: … (CODE)" 12/16 muted; 1px divider; items (18px icon + 14/20 label, gap 12).
// Real data: GET /auth/me (name, login_id, role) + company name/code; Sign out = POST /auth/logout.
// "My profile" and "Help & shortcuts" are not rendered (no screen / content exists); the Theme entry is shown
// with "Dark theme not built yet" (light only in this release).
import { useState } from 'react';
import { IconLogout, IconMoon, IconX } from '@tabler/icons-react';
import { useAuth, useMe } from '../auth/AuthProvider';
import { ROLE_LABEL } from '../auth/access';
import { BottomSheet, Button } from '../ui/primitives';
import { Avatar, initials as initialsOf } from '../ui/desktop/Avatar';
import { ActionItem, MenuDivider, MenuSurface } from '../ui/desktop/Menu';
import { Popover, useAnchor } from '../ui/desktop/Popover';

export const initials = initialsOf;

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

/** Desktop: the top-nav "User" block (avatar 40 brand gradient + name 14/20 Medium + role 12/16 secondary) + menu. */
export function UserMenuDesktop() {
  const me = useMe();
  const { logout, companyName, companyCode } = useAuth();
  const a = useAnchor<HTMLButtonElement>();
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button
        ref={a.ref}
        type="button"
        aria-haspopup="menu"
        aria-expanded={a.open}
        onClick={a.toggle}
        className="flex shrink-0 items-center gap-[10px] overflow-clip pr-[8px] text-left"
      >
        <Avatar name={me.full_name} brand size={40} />
        <span className="flex flex-col items-start overflow-clip whitespace-nowrap">
          <span className="text-[14px] font-medium leading-[20px] text-fg">{me.full_name}</span>
          <span className="text-[12px] leading-[16px] text-fg-2">{ROLE_LABEL[me.role]}</span>
        </span>
      </button>
      <Popover open={a.open} onClose={a.close} anchorRef={a.ref} align="end" scrim={0.4} width={280} label="Account">
        <MenuSurface variant="popover">
          <div className="flex w-full flex-col items-start gap-[2px] overflow-clip whitespace-nowrap px-[12px] pb-[10px] pt-[8px]">
            <p className="text-[14px] font-medium leading-[20px] text-fg">{me.full_name}</p>
            <p className="text-[12px] leading-[16px] text-fg-2">{me.login_id} · {me.role}</p>
            <p className="text-[12px] leading-[16px] text-fg-muted">
              Company: {companyName ?? '…'}{companyCode ? ` (${companyCode})` : ''}
            </p>
          </div>
          <MenuDivider />
          <ActionItem icon={IconMoon} label="Theme · Light" sub="Dark theme not built yet" disabled />
          <ActionItem
            icon={IconX}
            label={busy ? 'Signing out…' : 'Sign out'}
            tone="brand"
            disabled={busy}
            onClick={async () => { setBusy(true); await logout(); }}
          />
        </MenuSurface>
      </Popover>
    </>
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
