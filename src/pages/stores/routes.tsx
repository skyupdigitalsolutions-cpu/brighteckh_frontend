// Stores / Quality routes, mounted in App.tsx under /st (RoleGate STORES_QUALITY + DesktopShell). ST-D panel 177:139285.
//   index           → redirect to dashboard
//   dashboard       → STD0 Stores dashboard (landing page; counts derived from the two Stores lists)
//   receive         → STR0 POs to receive
//   receive/:poId   → STG0 create GRN
//   grns            → GL0 GRN register
//   grns/:grnId     → STG1–STG7 GRN detail: inspect, photo gate, post, posted / read-only
// SQ0 Quarantine and SI0 Inventory are hidden pills pending a client decision (Quarantine feature / stock role scope);
// their URLs fall through to the shell's NotBuiltPage.
import { Navigate, Route } from 'react-router-dom';
import { StoresDashboardPage } from './dashboard/DashboardPage';
import { ReceivePage } from './receive/ReceivePage';
import { CreateGrnPage } from './receive/CreateGrnPage';
import { GrnListPage } from './grns/GrnListPage';
import { GrnDetailPage } from './grns/GrnDetailPage';

export const StoresRoutes = (
  <>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<StoresDashboardPage />} />
    <Route path="receive" element={<ReceivePage />} />
    <Route path="receive/:poId" element={<CreateGrnPage />} />
    <Route path="grns" element={<GrnListPage />} />
    <Route path="grns/:grnId" element={<GrnDetailPage />} />
  </>
);
