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
    // Company-wide material-request inbox (Figma 03d 177:117991): list GET /purchase/material-requests, detail
    // GET /jobs/:id/material-requests; start processing + change-request review (src/pages/purchase/requests).
    { to: '/p/requests', label: 'Requests', built: true },
    { to: '/p/sourcing', label: 'Sourcing', built: true, match: ['/p/rfqs'] },
    { to: '/p/quotes', label: 'Quotes', built: true },
    // SUPPLIER purchase orders (BR-06) register + PO page — Figma 03g "Purchase · Orders" / O0 177:125758 (GET /purchase-orders,
    // PURCHASE only). Not the BR-11 sales orders (those are under Sales & Supply).
    { to: '/p/orders', label: 'Orders', built: true },
    // BR-11 (PS-D 238:41629 top nav): "Sales & Supply" (sub-tabs Quotes to price · Orders · Outwards) and "Stock" (merged
    // Inventory + Masters: Availability · Journal · Items · Assemblies — GET /inventory/availability + /stock/*, PURCHASE only,
    // read-only; src/pages/purchase/stock).
    { to: '/p/supply', label: 'Sales & Supply', built: true },
    { to: '/p/stock', label: 'Stock', built: true },
  ],
  // Figma "Shell / Top nav · Sales" (152:788), S-D panel 177:137224, routed under /s. The quote detail
  // (/s/quotes/:id) keeps the Sent pill active.
  SALES: [
    { to: '/s', label: 'Dashboard', built: true, end: true },
    { to: '/s/to-send', label: 'To send', built: true },
    { to: '/s/sent', label: 'Sent', built: true, match: ['/s/quotes'] },
    { to: '/s/responses', label: 'Responses', built: true },
    // BR-11 product sales (SS-D 237:40367 top nav), after the repair-quote pills.
    { to: '/s/enquiries', label: 'Enquiries', built: true },
    { to: '/s/product-quotes', label: 'Product quotes', built: true },
    { to: '/s/orders', label: 'Orders', built: true },
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
  // F-D · Finance · Desktop panel (247:51039), routed under /f.
  FINANCE: [
    { to: '/f', label: 'Product invoices', built: true, end: true, match: ['/f/invoices'] },
    { to: '/f/advances', label: 'Advances', built: true },
  ],
  // BR-10 RBAC admin under /a (no Figma frames; kit build).
  SYSTEM_ADMIN: [
    { to: '/a', label: 'Role bindings', built: true, end: true },
    { to: '/a/grants', label: 'Report grants', built: true },
    { to: '/a/reports', label: 'Reports', built: true },
    { to: '/a/access', label: 'My access', built: true },
    // A-D · System admin · Sales policy (247:55207). Figma draws it as the only pill of a new admin shell; it is added to
    // the existing /a shell (BR-10 RBAC admin) instead.
    { to: '/a/sales-policy', label: 'Sales policy', built: true },
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
