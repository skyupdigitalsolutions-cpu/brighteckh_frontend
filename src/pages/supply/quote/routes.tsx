// Stage A (enquiry → product quote), BR-11 SS-D 237:40367 / PS-D 238:41629.
//   SalesEnquiryQuoteRoutes  → mounted under /s : enquiries (SE0), enquiries/:id (SE1), product-quotes (SQS0),
//                              product-quotes/:id (SQS1)
//   PurchaseQuoteRoutes      → mounted under /p/supply : quotes (PQ0), quotes/:id (PQ1)
import { Route } from 'react-router-dom';
import { EnquiriesPage } from './EnquiriesPage';
import { EnquiryDetailPage } from './EnquiryDetailPage';
import { ProductQuotesPage } from './ProductQuotesPage';
import { SalesQuotePage } from './SalesQuotePage';
import { PurchaseQuotesPage } from './PurchaseQuotesPage';
import { QuoteBuilderPage } from './QuoteBuilderPage';

export const SalesEnquiryQuoteRoutes = (
  <>
    <Route path="enquiries" element={<EnquiriesPage />} />
    <Route path="enquiries/:id" element={<EnquiryDetailPage />} />
    <Route path="product-quotes" element={<ProductQuotesPage />} />
    <Route path="product-quotes/:id" element={<SalesQuotePage />} />
  </>
);

export const PurchaseQuoteRoutes = (
  <>
    <Route path="quotes" element={<PurchaseQuotesPage />} />
    <Route path="quotes/:id" element={<QuoteBuilderPage />} />
  </>
);
