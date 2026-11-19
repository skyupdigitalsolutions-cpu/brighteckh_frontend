// Stage B (sales order → verify → reserve → source → close).
//   SalesOrderRoutes     → mounted under /s : orders (SOS0), orders/:id (SOS1)
//   PurchaseOrderRoutes  → mounted under /p/supply : orders (PO0), orders/:id (PO1–PO3), orders/:id/close (PO4),
//                          orders/:id/supplier-pos (PO2 243:50019)
import { Route } from 'react-router-dom';
import { OrdersListPage } from './OrdersListPage';
import { OrderDetailPage } from './OrderDetailPage';
import { ClosurePage } from './ClosurePage';
import { SupplierPosPage } from './SupplierPosPage';

export const SalesOrderRoutes = (
  <>
    <Route path="orders" element={<OrdersListPage role="SALES" />} />
    <Route path="orders/:id" element={<OrderDetailPage role="SALES" />} />
  </>
);

export const PurchaseOrderRoutes = (
  <>
    <Route path="orders" element={<OrdersListPage role="PURCHASE" />} />
    <Route path="orders/:id" element={<OrderDetailPage role="PURCHASE" />} />
    <Route path="orders/:id/close" element={<ClosurePage />} />
    <Route path="orders/:id/supplier-pos" element={<SupplierPosPage />} />
  </>
);
