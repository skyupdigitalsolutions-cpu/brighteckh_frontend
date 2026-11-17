// Role-based navigation + capabilities. Roles come ONLY from GET /api/auth/me.
// Rule 4 (Figma): actions a role can never perform are HIDDEN, not disabled. Rule 1: supplier
// cost / margin is absent for Engineer and Sales — components take `canSeeCost` and omit the column.
import type { Role } from '../api/types';

/**
 * `to` = pill target. The pill is active when the path equals `to` (`end`) or starts with `to` or any `match`
 * prefix — e.g. the Sourcing pill stays active on /p/rfqs/:id.
 */
export type NavItem = {
  to: string; label: string; built: boolean; end?: boolean; match?: string[];
  /** Data-driven visibility: 'br10Authoriser' = only when GET /mis/authorities names the caller's role as an authoriser. */
  gate?: 'br10Authoriser';
};

// Purchase labels are the Figma "Shell / Top nav · Purchase" pills (177:102545), routed under /p.
// Other roles follow the "Who sees what" matrix (00 · Foundations) and are not built yet (/m).
const NAV: Record<Role, NavItem[]> = {
  ENGINEER: [{ to: '/jobs', label: 'My jobs', built: true }],
  PURCHASE: [
    { to: '/p', label: 'Dashboard', built: true, end: true },
    { to: '/p/inward', label: 'Inward', built: true },
    { to: '/p/jobs', label: 'Jobs', built: true },
    { to: '/p/requests', label: 'Requests', built: false },
    { to: '/p/sourcing', label: 'Sourcing', built: true, match: ['/p/rfqs'] },
    { to: '/p/quotes', label: 'Quotes', built: true },
    { to: '/p/orders', label: 'Orders', built: false },
    { to: '/p/inventory', label: 'Inventory', built: false },
    { to: '/p/masters', label: 'Masters', built: false },
  ],
  // Figma "Shell / Top nav · Sales" (152:788), S-D panel 177:137224, routed under /s. The quote detail
  // (/s/quotes/:id) keeps the Sent pill active.
  SALES: [
    { to: '/s', label: 'Dashboard', built: true, end: true },
    { to: '/s/to-send', label: 'To send', built: true },
    { to: '/s/sent', label: 'Sent', built: true, match: ['/s/quotes'] },
    { to: '/s/responses', label: 'Responses', built: true },
  ],
  // Figma "Shell / Top nav · Stores" (ST-D panel 177:139285), routed under /st. Create GRN (/st/receive/:poId) keeps
  // Receive active; GRN detail keeps GRNs active. Dashboard / Quarantine / Inventory are not built yet.
  STORES_QUALITY: [
    { to: '/st/dashboard', label: 'Dashboard', built: false },
    { to: '/st/receive', label: 'Receive', built: true },
    { to: '/st/grns', label: 'GRNs', built: true },
    { to: '/st/quarantine', label: 'Quarantine', built: false },
    { to: '/st/inventory', label: 'Inventory', built: false },
  ],
  // BR-10 MIS under /mg (no Figma frames; kit build). The Figma "Shell / Top nav · Management" pills (M-D panel
  // 177:140121: Overview, Jobs, Quotes, Purchase orders, Inventory, Masters) follow, not built yet.
  MANAGEMENT: [
    { to: '/mg', label: 'Reports', built: true, end: true, match: ['/mg/reports'] },
    { to: '/mg/approvals', label: 'Approvals', built: true, gate: 'br10Authoriser' },
    { to: '/mg/access', label: 'My access', built: true },
    { to: '/mg/overview', label: 'Overview', built: false },
    { to: '/mg/jobs', label: 'Jobs', built: false },
    { to: '/mg/quotes', label: 'Quotes', built: false },
    { to: '/mg/orders', label: 'Purchase orders', built: false },
    { to: '/mg/inventory', label: 'Inventory', built: false },
    { to: '/mg/masters', label: 'Masters', built: false },
  ],
  // G7 in Figma open questions: out of the design scope so far.
  FINANCE: [],
  // BR-10 RBAC admin under /a (no Figma frames; kit build).
  SYSTEM_ADMIN: [
    { to: '/a', label: 'Role bindings', built: true, end: true },
    { to: '/a/grants', label: 'Report grants', built: true },
    { to: '/a/reports', label: 'Reports', built: true },
    { to: '/a/access', label: 'My access', built: true },
  ],
  EXTERNAL_COORD: [],
};

export const navFor = (role: Role) => NAV[role] ?? [];
/** Landing page: the role's first BUILT nav item (Stores' Dashboard pill isn't built, so Stores lands on Receive). */
export const homeFor = (role: Role) =>
  (role === 'ENGINEER' ? '/jobs' : (navFor(role).find((i) => i.built) ?? navFor(role)[0])?.to ?? '/m/none');

export function isNavActive(item: NavItem, pathname: string) {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (item.end) return p === item.to;
  return [item.to, ...(item.match ?? [])].some((m) => p === m || p.startsWith(m + '/'));
}

/** Mirrors the backend @Roles(...) on each route used by the UI. */
export const can = {
  engineerWork: (r: Role) => r === 'ENGINEER', // custody, sessions, reports, material requests, tests, handoff
  seeSupplierCost: (r: Role) => r === 'PURCHASE' || r === 'MANAGEMENT',
  /** BR-02 intake (JIN, groups, expand, photos, verify, assign) + BR-04 stock check / RFQ / offers / quotes: @Roles('PURCHASE'). */
  purchaseWork: (r: Role) => r === 'PURCHASE',
  /** BR-04 send (POST /quotes/:id/send) + BR-05 customer response (POST /jobs/:id/quote-responses): @Roles('SALES'). */
  salesWork: (r: Role) => r === 'SALES',
  /** BR-06 GRN create / line photo / line post + GET /stores/*: @Roles('STORES_QUALITY'). */
  storesWork: (r: Role) => r === 'STORES_QUALITY',
  /** BR-10 role bindings + report grants (create / activate / revoke, STANDARD approval): @Roles('SYSTEM_ADMIN'). */
  misAdmin: (r: Role) => r === 'SYSTEM_ADMIN',
};

export const ROLE_LABEL: Record<Role, string> = {
  PURCHASE: 'Purchase', ENGINEER: 'Engineer', SALES: 'Sales', STORES_QUALITY: 'Stores / Quality',
  EXTERNAL_COORD: 'External coordinator', FINANCE: 'Finance', MANAGEMENT: 'Management', SYSTEM_ADMIN: 'System admin',
};
