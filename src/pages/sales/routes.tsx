// Sales routes, mounted in App.tsx under /s (RoleGate SALES + DesktopShell). S-D panel 177:137224.
//   index            → SD0 dashboard
//   to-send          → SQ rail + quote pane (?q=<quoteId>)
//   sent             → SS0 sent list (?stage=<tab>)
//   responses        → SR0 responses
//   quotes/:quoteId  → SS quote detail (SalesQuotePage, built by the quote agent in ./quote)
// Section-07 frames S1 (177:103960) / S2 (177:104081) are superseded by this panel and not built separately.
import { Route } from 'react-router-dom';
import { SalesDashboardPage } from './dashboard/SalesDashboardPage';
import { ToSendPage } from './tosend/ToSendPage';
import { SentQuotesPage } from './sent/SentQuotesPage';
import { ResponsesPage } from './responses/ResponsesPage';
import { SalesQuotePage } from './quote';

export const SalesRoutes = (
  <>
    <Route index element={<SalesDashboardPage />} />
    <Route path="to-send" element={<ToSendPage />} />
    <Route path="sent" element={<SentQuotesPage />} />
    <Route path="responses" element={<ResponsesPage />} />
    <Route path="quotes/:quoteId" element={<SalesQuotePage />} />
  </>
);
