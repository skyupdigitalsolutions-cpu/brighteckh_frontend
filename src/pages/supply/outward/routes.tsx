// Stage C (outward → dispatch → POD, then the Finance product invoice).
//   PurchaseOutwardRoutes  → mounted under /p/supply : outwards (POUT0 + create drawer, ?create=<orderId>), outwards/:id (POUT1)
//   FinanceInvoiceRoutes   → mounted under /f : index (FI0 queue), invoices/preview/:orderId (FI1), invoices/:invoiceId (FI2)
import { Route } from 'react-router-dom';
import { OutwardDetailPage } from './OutwardDetailPage';
import { OutwardListPage } from './OutwardListPage';
import { InvoiceDetailPage } from './invoice/InvoiceDetailPage';
import { InvoicePreviewPage } from './invoice/InvoicePreviewPage';
import { InvoiceQueuePage } from './invoice/InvoiceQueuePage';

export const PurchaseOutwardRoutes = (
  <>
    <Route path="outwards" element={<OutwardListPage />} />
    <Route path="outwards/:id" element={<OutwardDetailPage />} />
  </>
);

export const FinanceInvoiceRoutes = (
  <>
    <Route index element={<InvoiceQueuePage />} />
    <Route path="invoices/preview/:orderId" element={<InvoicePreviewPage />} />
    <Route path="invoices/:invoiceId" element={<InvoiceDetailPage />} />
  </>
);
