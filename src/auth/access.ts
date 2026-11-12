// Role-based navigation + capabilities. Roles come ONLY from GET /api/auth/me.
// Rule 4 (Figma): actions a role can never perform are HIDDEN, not disabled. Rule 1: supplier
// cost / margin is absent for Engineer and Sales — components take `canSeeCost` and omit the column.
import type { Role } from '../api/types';

export type NavItem = { to: string; label: string; built: boolean };

// Purchase labels are the Figma "Shell / Top nav · Purchase" pills. Other roles follow the
// "Who sees what" matrix (00 · Foundations) — only the Engineer flow is built in this pass.
const NAV: Record<Role, NavItem[]> = {
  ENGINEER: [{ to: '/jobs', label: 'My jobs', built: true }],
  PURCHASE: [
    { to: '/m/dashboard', label: 'Dashboard', built: false },
    { to: '/m/inward', label: 'Inward', built: false },
    { to: '/m/jobs', label: 'Jobs', built: false },
    { to: '/m/requests', label: 'Requests', built: false },
    { to: '/m/sourcing', label: 'Sourcing', built: false },
    { to: '/m/quotes', label: 'Quotes', built: false },
    { to: '/m/orders', label: 'Orders', built: false },
    { to: '/m/inventory', label: 'Inventory', built: false },
    { to: '/m/masters', label: 'Masters', built: false },
  ],
  SALES: [{ to: '/m/quotes', label: 'Quotes', built: false }],
  STORES_QUALITY: [
    { to: '/m/receiving', label: 'GRN receiving', built: false },
    { to: '/m/inventory', label: 'Inventory', built: false },
    { to: '/m/masters', label: 'Masters', built: false },
  ],
  MANAGEMENT: [
    { to: '/m/jobs', label: 'Jobs', built: false },
    { to: '/m/quotes', label: 'Quotes', built: false },
    { to: '/m/orders', label: 'Orders', built: false },
    { to: '/m/inventory', label: 'Inventory', built: false },
    { to: '/m/mis', label: 'MIS', built: false },
  ],
  // G7 in Figma open questions: out of the design scope so far.
  FINANCE: [],
  SYSTEM_ADMIN: [],
  EXTERNAL_COORD: [],
};

export const navFor = (role: Role) => NAV[role] ?? [];
export const homeFor = (role: Role) => (role === 'ENGINEER' ? '/jobs' : navFor(role)[0]?.to ?? '/m/none');

/** Mirrors the backend @Roles(...) on each route used by the UI. */
export const can = {
  engineerWork: (r: Role) => r === 'ENGINEER', // custody, sessions, reports, material requests, tests, handoff
  seeSupplierCost: (r: Role) => r === 'PURCHASE' || r === 'MANAGEMENT',
};

export const ROLE_LABEL: Record<Role, string> = {
  PURCHASE: 'Purchase', ENGINEER: 'Engineer', SALES: 'Sales', STORES_QUALITY: 'Stores / Quality',
  EXTERNAL_COORD: 'External coordinator', FINANCE: 'Finance', MANAGEMENT: 'Management', SYSTEM_ADMIN: 'System admin',
};
