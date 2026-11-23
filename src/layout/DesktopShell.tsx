// Desktop shell for every non-engineer role (Purchase at /p, others at /m).
// Figma "D·P0 · Purchase overview" 177:102544: canvas = 4 radial washes over #efedec; padding 24 top / 28 sides /
// 28 bottom; vertical stack gap 20: "Shell / Top nav · <role>" (177:102545) → page header → content.
// Pages render <PageHeader/> + <PageContent> themselves (they are direct children of the gap-20 stack).
//
// Top nav (72 tall, glass, radius 36, pl-20 pr-12 py-12, gap 20):
//   Brand (mark 36×35.5 + wordmark 112×9.2 over "JMS" 11/14 SemiBold secondary, gap 10 / 3)
//   Nav (flex-1, centred, gap 2): pill h-44 px-13 radius 22, 14/20; active = brand gradient + drop shadow
//     0 6 8 rgba(173,51,38,.3) + Medium white; default = Regular secondary.
//   Right (gap 8): theme toggle (subtle, p-4, gap 2, radius 22; 36px segments, active = accent fill; light / dark),
//     search (44 round subtle, 20px icon), notifications (44 round subtle, 20px bell), company indicator
//     (company-accent, pl-10 pr-12 py-8, radius 18, 16px building + Data/ID white), 1×28 divider, user block.
// Items a role can't use are not rendered at all (rule: hidden, not disabled).
import { useEffect, useRef } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { IconBell, IconBuildingFactory2, IconMoon, IconSearch, IconSun, IconTools } from '@tabler/icons-react';
import type { Role } from '../api/types';
import { useAuth, useMe } from '../auth/AuthProvider';
import { homeFor, isNavActive, navFor, ROLE_LABEL } from '../auth/access';
import { useIsBr10Authoriser } from '../pages/mis/api';
import { Ic, cx } from '../ui/desktop/Icon';
import { IconButton } from '../ui/desktop/Button';
import { EmptyState, StateCard } from '../ui/desktop/States';
import { useAnchor } from '../ui/desktop/Popover';
import { ToastProvider } from '../ui/desktop/Toast';
import { PageHeader } from '../ui/desktop/PageHeader';
import { PageContent } from '../ui/desktop/Glass';
import { UserMenuDesktop } from './UserMenu';
import { NotificationsPanel, SearchPalette } from './GlobalOverlays';
import { LogoMark } from '../ui/LogoMark';
import { setTheme, useTheme, type Theme } from '../lib/theme';
import logoWordmark from '../assets/brand/logo-wordmark.svg';

/** Route guard by role: a role that can't use a section is sent to its own home. */
export function RoleGate({ roles }: { roles: Role[] }) {
  const me = useMe();
  if (!roles.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return <Outlet />;
}

/** Read-only company indicator (Figma "Company indicator"). Code = legal entity (BLR / CHN) of the signed-in user. */
export function CompanyBadge() {
  const { companyCode, companyName } = useAuth();
  return (
    <span
      className="inline-flex shrink-0 items-center gap-[6px] overflow-clip rounded-t-chip bg-company-accent py-[8px] pl-[10px] pr-[12px] text-fg-inverse"
      title={companyName ? `${companyName} — from your login; switching company is not available` : 'Company from your login'}
    >
      <Ic icon={IconBuildingFactory2} size={16} />
      <span className="whitespace-nowrap font-mono text-[13px] font-medium leading-[18px]">{companyCode ?? '…'}</span>
    </span>
  );
}

/** Light / dark segmented toggle (src/lib/theme.ts: sets <html data-theme>, remembers the choice). Active = accent fill. */
function ThemeToggle() {
  const theme = useTheme();
  const seg = (value: Theme, icon: typeof IconSun, label: string) => {
    const active = theme === value;
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${label} theme${active ? ' (current)' : ''}`}
        title={`${label} theme`}
        onClick={() => setTheme(value)}
        className={cx(
          'flex h-[36px] w-[36px] items-center justify-center overflow-clip rounded-t-chip',
          active ? 'bg-accent text-fg-on-accent' : 'text-fg-2 hover:text-fg',
        )}
      >
        <Ic icon={icon} size={18} />
      </button>
    );
  };
  return (
    <div className="flex shrink-0 items-center gap-[2px] rounded-t-pill bg-subtle p-[4px]" role="group" aria-label="Theme">
      {seg('light', IconSun, 'Light')}
      {seg('dark', IconMoon, 'Dark')}
    </div>
  );
}

/** Inner padding at both ends of the scrolling pill row (px-[4px] / scroll-px-[4px] on the <nav>). */
const NAV_PAD = 4;

function TopNav() {
  const me = useMe();
  const loc = useLocation();
  const authoriser = useIsBr10Authoriser(me.role, navFor(me.role).some((i) => i.gate === 'br10Authoriser'));
  const items = navFor(me.role).filter((i) => i.gate !== 'br10Authoriser' || authoriser);
  const notif = useAnchor<HTMLButtonElement>();
  const search = useAnchor<HTMLButtonElement>();
  const navRef = useRef<HTMLElement>(null);
  // When the pills overflow (below ~1440 wide the 9 Purchase pills don't fit), keep the row scrolled to a PILL BOUNDARY:
  // start at 0 (first pill fully visible) unless the active pill would be hidden, then scroll the least amount that shows
  // it while landing the leftmost visible pill exactly on its start — no pill is ever left half-clipped. Re-applied on
  // navigation and when the nav is resized.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const align = () => {
      const pills = Array.from(nav.querySelectorAll<HTMLElement>(':scope > a'));
      const active = nav.querySelector<HTMLElement>(':scope > a[aria-current="page"]');
      let left = 0;
      if (active && nav.scrollWidth > nav.clientWidth) {
        const need = active.offsetLeft + active.offsetWidth + NAV_PAD - nav.clientWidth;
        if (need > 0) left = pills.map((p) => p.offsetLeft - NAV_PAD).find((s) => s >= need) ?? nav.scrollWidth - nav.clientWidth;
      }
      nav.scrollTo({ left });
    };
    align();
    const ro = new ResizeObserver(align);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [loc.pathname, items.length]);

  return (
    <div className="glass flex h-[72px] w-full shrink-0 items-center gap-[20px] rounded-t-nav py-[12px] pl-[20px] pr-[12px]">
      <Link to={homeFor(me.role)} className="flex shrink-0 items-center gap-[10px] overflow-clip" aria-label="Brightech JMS home">
        <LogoMark className="h-[35.5px] w-[36px] shrink-0" />
        <span className="flex flex-col items-start gap-[3px] overflow-clip">
          <img src={logoWordmark} alt="Brightech Group" className="h-[9.2px] w-[112px] shrink-0" />
          <span className="whitespace-nowrap text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-fg-2">JMS</span>
        </span>
      </Link>

      {/* Pills centre when they fit (auto margins on the first/last pill — NOT justify-center, which pushes the first
          pills past the left edge, unreachable, once the row overflows). Narrower than the 1440 design the row scrolls
          sideways (scrollbar hidden), snapping to pill starts, with NAV_PAD of inner padding at both ends; the effect
          above keeps it on a pill boundary. `relative` makes pill offsetLeft relative to the nav. -my/py-8 leave room for
          the active pill's drop shadow inside the scroll box. */}
      <nav
        ref={navRef}
        aria-label="Main"
        className="relative -my-[8px] flex min-w-px flex-1 snap-x snap-mandatory scroll-px-[4px] items-center gap-[2px] overflow-x-auto px-[4px] py-[8px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
      >
        {items.map((it) => {
          const active = isNavActive(it, loc.pathname);
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex h-[44px] shrink-0 snap-start items-center justify-center whitespace-nowrap rounded-t-pill px-[13px] text-[14px] leading-[20px]',
                active ? 'pill-active-shadow bg-brand-gradient font-medium text-fg-inverse' : 'font-normal text-fg-2 hover:text-fg',
              )}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-[8px] overflow-clip">
        <ThemeToggle />
        <IconButton ref={search.ref} label="Search" onClick={search.toggle}>
          <Ic icon={IconSearch} size={20} />
        </IconButton>
        <IconButton ref={notif.ref} label="Notifications" onClick={notif.toggle} aria-expanded={notif.open}>
          <Ic icon={IconBell} size={20} />
        </IconButton>
        <CompanyBadge />
        <span className="h-[28px] w-px shrink-0 bg-line" aria-hidden />
        <UserMenuDesktop />
      </div>

      <NotificationsPanel open={notif.open} onClose={notif.close} anchorRef={notif.ref} />
      <SearchPalette open={search.open} onClose={search.close} />
    </div>
  );
}

export function DesktopShell() {
  return (
    <ToastProvider>
      <div className="bg-desktop-canvas min-h-full">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[20px] px-[28px] pb-[28px] pt-[24px]">
          <TopNav />
          <Outlet />
        </div>
      </div>
    </ToastProvider>
  );
}

/** A section in the role's nav that has no screens yet. */
export function NotBuiltPage() {
  const me = useMe();
  const loc = useLocation();
  const item = navFor(me.role).find((i) => isNavActive(i, loc.pathname));
  return (
    <>
      <PageHeader title={item?.label ?? ROLE_LABEL[me.role]} meta="Not built in this release." />
      <PageContent>
        <StateCard>
          <EmptyState
            icon={IconTools}
            title={item ? `${item.label} isn't built yet` : `Nothing here for ${ROLE_LABEL[me.role]} yet`}
            body={item ? 'This module is next in the flow-by-flow build.' : 'Your role has no screens in the current design scope (Figma open question G7).'}
          />
        </StateCard>
      </PageContent>
    </>
  );
}

/** Temporary element for a /p route whose screen is built by a screen group; the coordinator replaces it. */
export function RoutePlaceholder({ name }: { name: string }) {
  return (
    <>
      <PageHeader title={name} meta="Screen placeholder." />
      <PageContent>
        <StateCard>
          <EmptyState icon={IconTools} title={`${name} — placeholder`} body="This route is mounted; its screen is wired in by the screen group." />
        </StateCard>
      </PageContent>
    </>
  );
}
