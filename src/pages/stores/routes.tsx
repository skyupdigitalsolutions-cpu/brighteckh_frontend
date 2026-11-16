// Stores / Quality routes, mounted in App.tsx under /st (RoleGate STORES_QUALITY + DesktopShell). ST-D panel 177:139285.
//   index           → redirect to receive (the STD0 dashboard is not built)
//   receive         → STR0 POs to receive
//   receive/:poId   → STG0 create GRN
//   grns            → GL0 GRN register
//   grns/:grnId     → STG1–STG7 GRN detail: inspect, photo gate, post, posted / read-only
// SQ0 Quarantine and SI0 Inventory are not built (NotBuiltPage via the shell's catch-all).
import { Navigate, Route } from 'react-router-dom';
import { ReceivePage } from './receive/ReceivePage';
import { CreateGrnPage } from './receive/CreateGrnPage';
import { GrnListPage } from './grns/GrnListPage';
import { GrnDetailPage } from './grns/GrnDetailPage';

export const StoresRoutes = (
  <>
    <Route index element={<Navigate to="receive" replace />} />
    <Route path="receive" element={<ReceivePage />} />
    <Route path="receive/:poId" element={<CreateGrnPage />} />
    <Route path="grns" element={<GrnListPage />} />
    <Route path="grns/:grnId" element={<GrnDetailPage />} />
  </>
);
