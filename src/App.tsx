import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { apiStatus } from './api/http';
import { AuthProvider, RequireAuth, useMe } from './auth/AuthProvider';
import { homeFor } from './auth/access';
import { LoginPage } from './pages/LoginPage';
import { DesktopShell, NotBuiltPage, RoleGate } from './layout/DesktopShell';
import { JobWorkspace, JobWorkspaceIndex } from './pages/purchase/job/JobWorkspace';
import { InspectionTab } from './pages/purchase/jobtabs/InspectionTab';
import { MaterialTab } from './pages/purchase/jobtabs/MaterialTab';
import { AuthorisationTab } from './pages/purchase/jobtabs/AuthorisationTab';
import { PurchaseOrderTab } from './pages/purchase/jobtabs/PurchaseOrderTab';
import { RepairTestTab } from './pages/purchase/jobtabs/RepairTestTab';
import { OverviewRoutes } from './pages/purchase/overview/routes';
import { InwardRegisterRoutes } from './pages/purchase/inward/register/routes';
import { JinDetailRoutes } from './pages/purchase/inward/detail/routes';
import { JobsListRoutes } from './pages/purchase/jobs/routes';
import { RequestsRoutes } from './pages/purchase/requests/routes';
import { JobOverviewTab } from './pages/purchase/jobs/JobOverviewTab';
import { JobSourcingTab } from './pages/purchase/sourcing/JobSourcingTab';
import { SourcingRoutes } from './pages/purchase/sourcing/routes';
import { RfqRoutes } from './pages/purchase/sourcing/rfq-routes';
import { JobQuoteTab } from './pages/purchase/quotes/JobQuoteTab';
import { QuotesRoutes } from './pages/purchase/quotes/routes';
import { SalesRoutes } from './pages/sales/routes';
import { StoresRoutes } from './pages/stores/routes';
import { AdminRoutes, ManagementRoutes } from './pages/mis/routes';
import { PurchaseQuoteRoutes, SalesEnquiryQuoteRoutes } from './pages/supply/quote/routes';
import { PurchaseOrderRoutes, SalesOrderRoutes } from './pages/supply/order/routes';
import { FinanceInvoiceRoutes, PurchaseOutwardRoutes } from './pages/supply/outward/routes';
import { AdminSalesPolicyRoutes, FinanceAdvanceRoutes } from './pages/supply/finance-admin/routes';
import { MyJobsPage } from './pages/engineer/MyJobsPage';
import { JobDetailPage } from './pages/engineer/JobDetailPage';
import { InspectPage } from './pages/engineer/InspectPage';
import { InspectionReportPage } from './pages/engineer/InspectionReportPage';
import { MaterialRequestPage } from './pages/engineer/MaterialRequestPage';
import { RepairMaterialPage } from './pages/engineer/RepairMaterialPage';
import { RepairTimerPage } from './pages/engineer/RepairTimerPage';
import { RepairReportPage } from './pages/engineer/RepairReportPage';
import { TestPage } from './pages/engineer/TestPage';
import { HandoffPage } from './pages/engineer/HandoffPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      // 4xx are answers, not blips — don't hammer the API with retries for them.
      retry: (n, e) => { const s = apiStatus(e); return !(s && s >= 400 && s < 500) && n < 2; },
    },
    mutations: { retry: false },
  },
});

function Home() {
  const me = useMe();
  return <Navigate to={homeFor(me.role)} replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />

            {/* Engineer — mobile-first BR-03 + BR-07 flow */}
            <Route path="/jobs" element={<RequireAuth><RoleGate roles={['ENGINEER']} /></RequireAuth>}>
              <Route index element={<MyJobsPage />} />
              <Route path=":jobId" element={<JobDetailPage />} />
              <Route path=":jobId/inspect" element={<InspectPage />} />
              <Route path=":jobId/report" element={<InspectionReportPage />} />
              <Route path=":jobId/material" element={<MaterialRequestPage />} />
              <Route path=":jobId/repair/material" element={<RepairMaterialPage />} />
              <Route path=":jobId/repair/timer" element={<RepairTimerPage />} />
              <Route path=":jobId/repair/report" element={<RepairReportPage />} />
              <Route path=":jobId/repair/test" element={<TestPage />} />
              <Route path=":jobId/repair/handoff" element={<HandoffPage />} />
            </Route>

            {/* Purchase — desktop shell. Placeholders are replaced by the screen groups' <…Routes>. */}
            <Route path="/p" element={<RequireAuth><RoleGate roles={['PURCHASE']} /></RequireAuth>}>
              <Route element={<DesktopShell />}>
                {OverviewRoutes}
                <Route path="inward">
                  {InwardRegisterRoutes}
                  {JinDetailRoutes}
                </Route>
                <Route path="jobs">{JobsListRoutes}</Route>
                <Route path="jobs/:jobId" element={<JobWorkspace />}>
                  <Route index element={<JobWorkspaceIndex />} />
                  <Route path="overview" element={<JobOverviewTab />} />
                  <Route path="sourcing" element={<JobSourcingTab />} />
                  <Route path="quote" element={<JobQuoteTab />} />
                  <Route path="inspection" element={<InspectionTab />} />
                  <Route path="material" element={<MaterialTab />} />
                  <Route path="authorisation" element={<AuthorisationTab />} />
                  <Route path="purchase-order" element={<PurchaseOrderTab />} />
                  <Route path="repair-test" element={<RepairTestTab />} />
                </Route>
                <Route path="requests">{RequestsRoutes}</Route>
                <Route path="sourcing">{SourcingRoutes}</Route>
                <Route path="rfqs">{RfqRoutes}</Route>
                <Route path="quotes">{QuotesRoutes}</Route>
                {/* BR-11 Sales & Supply (PS-D 238:41629). */}
                <Route path="supply">
                  <Route index element={<Navigate to="quotes" replace />} />
                  {PurchaseQuoteRoutes}
                  {PurchaseOrderRoutes}
                  {PurchaseOutwardRoutes}
                </Route>
                <Route path="*" element={<NotBuiltPage />} />
              </Route>
            </Route>

            {/* Sales — desktop shell (S-D panel 177:137224). */}
            <Route path="/s" element={<RequireAuth><RoleGate roles={['SALES']} /></RequireAuth>}>
              <Route element={<DesktopShell />}>
                {SalesRoutes}
                {/* BR-11 product sales (SS-D 237:40367). */}
                {SalesEnquiryQuoteRoutes}
                {SalesOrderRoutes}
                <Route path="*" element={<NotBuiltPage />} />
              </Route>
            </Route>

            {/* Stores / Quality — desktop shell (ST-D panel 177:139285). */}
            <Route path="/st" element={<RequireAuth><RoleGate roles={['STORES_QUALITY']} /></RequireAuth>}>
              <Route element={<DesktopShell />}>
                {StoresRoutes}
                <Route path="*" element={<NotBuiltPage />} />
              </Route>
            </Route>

            {/* Management — BR-10 MIS (no Figma MIS frames; kit build). */}
            <Route path="/mg" element={<RequireAuth><RoleGate roles={['MANAGEMENT']} /></RequireAuth>}>
              <Route element={<DesktopShell />}>
                {ManagementRoutes}
                <Route path="*" element={<NotBuiltPage />} />
              </Route>
            </Route>

            {/* SYSTEM_ADMIN — BR-10 RBAC admin (role bindings, report grants) + reports. */}
            <Route path="/a" element={<RequireAuth><RoleGate roles={['SYSTEM_ADMIN']} /></RequireAuth>}>
              <Route element={<DesktopShell />}>
                {AdminRoutes}
                {AdminSalesPolicyRoutes}
                <Route path="*" element={<NotBuiltPage />} />
              </Route>
            </Route>

            {/* Finance — BR-11 product invoices + advances (F-D 247:51039). */}
            <Route path="/f" element={<RequireAuth><RoleGate roles={['FINANCE']} /></RequireAuth>}>
              <Route element={<DesktopShell />}>
                {FinanceInvoiceRoutes}
                {FinanceAdvanceRoutes}
                <Route path="*" element={<NotBuiltPage />} />
              </Route>
            </Route>

            {/* Every other role — desktop shell; modules land flow by flow. */}
            <Route path="/m" element={<RequireAuth><DesktopShell /></RequireAuth>}>
              <Route path="*" element={<NotBuiltPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
