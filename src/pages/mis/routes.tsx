// BR-10 MIS routes. No Figma frames exist for MIS (kit build, agreed 17 Nov 2026).
// Management, mounted under /mg (RoleGate MANAGEMENT + DesktopShell):
//   index          → report catalogue          reports/:code → report viewer + export gate
//   access         → my access                 approvals     → grants awaiting MY approval (nav pill only for a
//                                                               configured FINANCIAL / CROSS_COMPANY authoriser role)
// SYSTEM_ADMIN, mounted under /a (RoleGate SYSTEM_ADMIN + DesktopShell):
//   index → role bindings · grants → report grants (+ STANDARD approvals) · reports, reports/:code, access as above.
import { Route } from 'react-router-dom';
import { ReportCataloguePage } from './reports/ReportCataloguePage';
import { ReportViewPage } from './reports/ReportViewPage';
import { MyAccessPage } from './access/MyAccessPage';
import { ApprovalsPage } from './approvals/ApprovalsPage';
import { BindingsPage } from './admin/BindingsPage';
import { GrantsPage } from './admin/GrantsPage';

export const ManagementRoutes = (
  <>
    <Route index element={<ReportCataloguePage />} />
    <Route path="reports/:code" element={<ReportViewPage />} />
    <Route path="access" element={<MyAccessPage />} />
    <Route path="approvals" element={<ApprovalsPage />} />
  </>
);

export const AdminRoutes = (
  <>
    <Route index element={<BindingsPage />} />
    <Route path="grants" element={<GrantsPage />} />
    <Route path="reports" element={<ReportCataloguePage />} />
    <Route path="reports/:code" element={<ReportViewPage />} />
    <Route path="access" element={<MyAccessPage />} />
  </>
);
