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
  /**
   * Kept in NAV for the record but never rendered (navFor drops it): the screen is blocked on a client decision, so a
   * dead "isn't built yet" pill is not shown. Its URL still falls through to the shell's NotBuiltPage.
   */
  hidden?: true;
};

// Purchase labels are the Figma "Shell / Top nav · Purchase" pills (177:102545), routed under /p.
// Other roles follow the "Who sees what" matrix (00 · Foundations); EXTERNAL_COORD has no screens (/m).
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
  // Receive active; GRN detail keeps GRNs active. Dashboard (STD0) is the Stores landing page.
  STORES_QUALITY: [
    { to: '/st/dashboard', label: 'Dashboard', built: true },
    { to: '/st/receive', label: 'Receive', built: true },
    { to: '/st/grns', label: 'GRNs', built: true },
    // PENDING CLIENT DECISION (Quarantine feature): no Stores-readable quarantine list, supplier return is Purchase-only,
    // and there is no hold-release action or hold / reject reason. Hidden until the client scopes the feature.
    { to: '/st/quarantine', label: 'Quarantine', built: false, hidden: true },
    // PENDING CLIENT DECISION (stock role scope): /stock/* is PURCHASE-only (product owner, 23 Nov 2026). Hidden until
    // the client decides whether Stores gets the stock reads.
    { to: '/st/inventory', label: 'Inventory', built: false, hidden: true },
  ],
  // Figma "Shell / Top nav · Management" (M-D panel 177:140121, view only) under /mg: Overview (MD0, the landing page),
  // Jobs (MJ0 / MJ1), Quotes (MQ0 / MQ1) — read-only reuses of the Purchase screens — then the BR-10 MIS pills (no Figma
  // frames; kit build).
  MANAGEMENT: [
    { to: '/mg/overview', label: 'Overview', built: true },
    { to: '/mg/jobs', label: 'Jobs', built: true },
    { to: '/mg/quotes', label: 'Quotes', built: true },
    // PENDING CLIENT DECISION (PO role scope): GET /purchase-orders is PURCHASE-only (product owner, 23 Nov 2026:
    // Management does not get the PO list yet). Hidden until the client decides.
    { to: '/mg/orders', label: 'Purchase orders', built: false, hidden: true },
    // PENDING CLIENT DECISION (stock role scope): /stock/* is PURCHASE-only. Hidden until the client decides.
    { to: '/mg/inventory', label: 'Inventory', built: false, hidden: true },
    // PENDING CLIENT DECISION (stock role scope): the Item / Assembly Master reads (/stock/items, /stock/assemblies) are
    // PURCHASE-only. Hidden until the client decides.
    { to: '/mg/masters', label: 'Masters', built: false, hidden: true },
    { to: '/mg', label: 'Reports', built: true, end: true, match: ['/mg/reports'] },
    { to: '/mg/approvals', label: 'Approvals', built: true, gate: 'br10Authoriser' },
    { to: '/mg/access', label: 'My access', built: true },
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
    // AST-D · System admin · Settings (293:59592; top nav 235:940): Company & tax · Authorisers · Policies · Calendar · Numbering.
    { to: '/a/settings', label: 'Settings', built: true },
  ],
  EXTERNAL_COORD: [],
};

export const navFor = (role: Role) => (NAV[role] ?? []).filter((i) => !i.hidden);
/** Landing page: the role's first BUILT nav item (Stores → Dashboard, Management → Overview). */
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

/**
 * Desk prefix for the screens Purchase shares read-only with Management (jobs list, job overview, quotes):
 * links inside them stay in the caller's own shell.
 */
export const deskBase = (role: Role | undefined) => (role === 'MANAGEMENT' ? '/mg' : '/p');

export const ROLE_LABEL: Record<Role, string> = {
  PURCHASE: 'Purchase', ENGINEER: 'Engineer', SALES: 'Sales', STORES_QUALITY: 'Stores / Quality',
  EXTERNAL_COORD: 'External coordinator', FINANCE: 'Finance', MANAGEMENT: 'Management', SYSTEM_ADMIN: 'System admin',
};
