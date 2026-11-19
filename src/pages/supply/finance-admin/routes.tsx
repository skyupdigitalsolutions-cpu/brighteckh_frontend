// Stage D (Finance advances + System admin sales policy).
//   FinanceAdvanceRoutes    → mounted under /f (RoleGate FINANCE + DesktopShell): advances      → FA0 + FA1 drawer
//   AdminSalesPolicyRoutes  → mounted under /a (RoleGate SYSTEM_ADMIN + DesktopShell): sales-policy → AS0
import { Route } from 'react-router-dom';
import { AdvancesPage } from './AdvancesPage';
import { SalesPolicyPage } from './SalesPolicyPage';

export const FinanceAdvanceRoutes = <Route path="advances" element={<AdvancesPage />} />;
export const AdminSalesPolicyRoutes = <Route path="sales-policy" element={<SalesPolicyPage />} />;
