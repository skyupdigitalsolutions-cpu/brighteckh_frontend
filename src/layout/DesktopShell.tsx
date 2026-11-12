// Figma "Shell / Top nav · <role>" (D·P0 Purchase overview): floating white bar, logo, nav pills
// (active = brand red), company indicator, user menu. Nav items come from the role in GET /auth/me;
// items a role can't use are not rendered at all (rule: hidden, not disabled).
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { IconBuildingFactory2, IconTools } from '@tabler/icons-react';
import type { Role } from '../api/types';
import { useAuth, useMe } from '../auth/AuthProvider';
import { homeFor, navFor, ROLE_LABEL } from '../auth/access';
import { cx, EmptyState } from '../ui/primitives';
import { UserMenuDesktop } from './UserMenu';
import logoMark from '../assets/brand/logo-mark.svg';

/** Route guard by role: a role that can't use a section is sent to its own home. */
export function RoleGate({ roles }: { roles: Role[] }) {
  const me = useMe();
  if (!roles.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return <Outlet />;
}

export function CompanyBadge() {
  const { companyCode } = useAuth();
  return (
    <span
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-company-accent px-3 font-mono text-[13px] font-medium text-white"
      title="Company (from your login — switching is not available)"
    >
      <IconBuildingFactory2 size={16} /> {companyCode ?? '…'}
    </span>
  );
}

export function DesktopShell() {
  const me = useMe();
  const items = navFor(me.role);
  return (
    <div className="min-h-full bg-canvas">
      <div className="sticky top-0 z-30 px-4 pt-4 md:px-6">
        <header className="mx-auto flex h-16 max-w-[1392px] items-center gap-4 rounded-2xl border border-line bg-surface px-4 shadow-sm">
          <div className="flex shrink-0 items-center gap-2">
            <img src={logoMark} alt="" width={32} height={32} className="h-8 w-8" />
            <div className="hidden leading-tight sm:block">
              <p className="text-[12px] font-bold tracking-[0.04em] text-brand-logo">BRIGHTECH GROUP</p>
              <p className="text-[12px] font-semibold text-fg">JMS</p>
            </div>
          </div>
          <nav aria-label="Main" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) => cx(
                  'whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-accent text-white' : 'text-fg-2 hover:bg-subtle hover:text-fg',
                )}
              >
                {it.label}
              </NavLink>
            ))}
          </nav>
          <CompanyBadge />
          <UserMenuDesktop />
        </header>
      </div>
      <main className="mx-auto max-w-[1392px] px-4 py-6 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}

export function NotBuiltPage() {
  const me = useMe();
  const loc = useLocation();
  const item = navFor(me.role).find((i) => loc.pathname.startsWith(i.to));
  return (
    <EmptyState icon={<IconTools size={28} />} title={item ? `${item.label} isn't built yet` : `Nothing here for ${ROLE_LABEL[me.role]} yet`}>
      {item
        ? 'This pass delivers the shell and the Engineer flow. This module is next in the flow-by-flow build.'
        : 'Your role has no screens in the current design scope (Figma open question G7).'}
    </EmptyState>
  );
}
