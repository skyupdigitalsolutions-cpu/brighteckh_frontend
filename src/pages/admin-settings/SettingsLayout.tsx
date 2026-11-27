// AST-D · System admin · Settings (293:59592) — /a/settings, SYSTEM_ADMIN only.
// Page header "Settings" / "Client configuration for every company · SYSTEM_ADMIN only", then the Tab bar
// (Company & tax · Authorisers · Policies · Calendar · Numbering & series), then the tab (toolbar + body, gap 14).
// The company being edited lives in the URL (?co=<company id>, default = the admin's own company) so the switcher
// survives tab changes and reloads.
import { Navigate, Outlet, Route, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader, TabBar, TabLink } from '../../ui/desktop';
import { useAdminCompanies, type AdminCompany } from './api';
import { CompanyTaxTab } from './CompanyTaxTab';
import { AuthorisersTab } from './AuthorisersTab';
import { PoliciesTab } from './PoliciesTab';
import { CalendarTab } from './CalendarTab';
import { NumberingTab } from './NumberingTab';

export type SettingsCtx = {
  companyId: string;
  setCompanyId: (id: string) => void;
  companies?: AdminCompany[];
  company?: AdminCompany;
};
export const useSettingsCtx = () => useOutletContext<SettingsCtx>();

const TABS: [string, string][] = [
  ['company', 'Company & tax'], ['authorisers', 'Authorisers'], ['policies', 'Policies'], ['calendar', 'Calendar'],
  ['numbering', 'Numbering & series'],
];

function SettingsLayout() {
  const { me } = useAuth();
  const [sp, setSp] = useSearchParams();
  const { search } = useLocation();
  const companies = useAdminCompanies();
  const companyId = sp.get('co') || me?.company_id || '';
  const setCompanyId = (id: string) => setSp((p) => { p.set('co', id); return p; }, { replace: true });
  const company = companies.data?.find((c) => c.id === companyId);
  return (
    <>
      <PageHeader title="Settings" meta="Client configuration for every company · SYSTEM_ADMIN only" />
      <div className="flex w-full min-w-0 flex-col gap-[14px]">
        <TabBar label="Settings">
          {TABS.map(([to, label]) => <TabLink key={to} to={`/a/settings/${to}${search}`} label={label} />)}
        </TabBar>
        <Outlet context={{ companyId, setCompanyId, companies: companies.data, company } satisfies SettingsCtx} />
      </div>
    </>
  );
}

export const AdminSettingsRoutes = (
  <Route path="settings" element={<SettingsLayout />}>
    <Route index element={<Navigate to="company" replace />} />
    <Route path="company" element={<CompanyTaxTab />} />
    <Route path="authorisers" element={<AuthorisersTab />} />
    <Route path="policies" element={<PoliciesTab />} />
    <Route path="calendar" element={<CalendarTab />} />
    <Route path="numbering" element={<NumberingTab />} />
  </Route>
);
