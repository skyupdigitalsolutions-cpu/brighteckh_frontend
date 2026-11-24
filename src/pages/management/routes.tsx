// Management desk routes (M-D panel 177:140121, view only), mounted in App.tsx under /mg next to the BR-10 MIS routes.
//   overview               → MD0 Business overview (landing page)
//   jobs                   → MJ0 jobs list (Purchase JobsListPage, read-only for MANAGEMENT)
//   jobs/:jobId/overview   → MJ1 job (Purchase JobWorkspace + JobOverviewTab, no tab bar, read-only)
//   quotes                 → MQ0 quotes list (Purchase QuotesList, read-only)
//   quotes/:quoteId        → MQ1 quote (JobWorkspace + JobQuoteTab, read-only)
// Purchase orders / Inventory / Masters are hidden pills pending a client decision (see access.ts) and fall through to
// the shell's NotBuiltPage.
import { Navigate, Route } from 'react-router-dom';
import { JobsListPage } from '../purchase/jobs/JobsListPage';
import { JobOverviewTab } from '../purchase/jobs/JobOverviewTab';
import { JobWorkspace } from '../purchase/job/JobWorkspace';
import { QuotesList } from '../purchase/quotes/QuotesList';
import { JobQuoteTab } from '../purchase/quotes/JobQuoteTab';
import { ManagementOverviewPage } from './OverviewPage';
import { MgQuoteWorkspace } from './QuoteWorkspace';

export const ManagementDeskRoutes = (
  <>
    <Route path="overview" element={<ManagementOverviewPage />} />
    <Route path="jobs">
      <Route index element={<JobsListPage />} />
      <Route path=":jobId" element={<JobWorkspace />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<JobOverviewTab />} />
      </Route>
    </Route>
    <Route path="quotes">
      <Route index element={<QuotesList />} />
      <Route path=":quoteId" element={<MgQuoteWorkspace />}>
        <Route index element={<JobQuoteTab />} />
      </Route>
    </Route>
  </>
);
