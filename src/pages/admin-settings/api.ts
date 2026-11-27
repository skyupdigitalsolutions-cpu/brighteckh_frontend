// Admin Settings data layer (SYSTEM_ADMIN, Figma AST-D 293:59592). Backend migration 027 + /admin/settings module.
//
//   GET  /admin/settings/companies                          companies the switcher can open
//   GET  /admin/settings/companies/:id                      one company's settings (+ GLOBAL GST rates / test-start SLA,
//                                                           last saved per tab)
//   GET  /admin/settings/companies/:id/numbering            real number series (format, latest, next) — read-only
//   PUT  /admin/settings/companies/:id/profile              Company & tax (legal name, Udyam, GSTIN, state, address,
//                                                           prefix, bank). Prefix / state / GSTIN freeze once BR-08 docs exist.
//   PUT  /admin/settings/companies/:id/authorisers          BR-09 decision roles, BR-10 grant approvers, company roles
//   PUT  /admin/settings/companies/:id/policies             company policy fields + BR-11 sales policy
//   PUT  /admin/settings/companies/:id/working-hours        per-weekday hours + lunch (weekdays not listed = closed)
//   POST /admin/settings/companies/:id/holidays[/:hid/remove]
//   PUT  /admin/settings/gst-rates                          GLOBAL: rate (+ HSN/SAC) per quote line type
//   PUT  /admin/settings/test-sla-targets                   GLOBAL: BR-07 test-start SLA per job priority
// Every per-company write returns the refreshed AdminCompanySettings.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../api/http';
import type { components } from '../../api/schema';

type S = components['schemas'];
export type CompanySettings = S['AdminCompanySettings'];
export type AdminCompany = S['AdminCompanyRow'];
export type Numbering = S['AdminNumbering'];
export type NumberingSeries = S['NumberingSeries'];
export type ProfileBody = S['AdminProfileDto'];
export type AuthorisersBody = S['AdminAuthorisersDto'];
export type PoliciesBody = S['AdminPoliciesDto'];
export type WorkingHoursBody = S['WorkingHoursDto'];
export type WorkingDay = S['WorkingDayDto'];
export type HolidayBody = S['AdminHolidayDto'];
export type GstRateBody = S['GstRateDto'];
export type TestSlaBody = S['TestSlaTargetDto'];
export type GstRow = S['Br08GstRateConfigRow'];
export type Holiday = S['CalendarHolidaysRow'];
export type DayRule = S['WorkingCalendarDayRulesRow'];
export type SettingsTab = keyof S['SettingsLastSaved'];

/** Role codes an authority can be given (ROLES in the backend DTOs). */
export const ROLE_CODES = ['PURCHASE', 'ENGINEER', 'SALES', 'STORES_QUALITY', 'EXTERNAL_COORD', 'FINANCE', 'MANAGEMENT', 'SYSTEM_ADMIN'] as const;
export type RoleCode = typeof ROLE_CODES[number];

const k = {
  all: ['admin-settings'] as const,
  companies: ['admin-settings', 'companies'] as const,
  company: (id: string) => ['admin-settings', 'company', id] as const,
  numbering: (id: string) => ['admin-settings', 'numbering', id] as const,
};

const get = <T>(url: string) => http.get<T>(url).then((r) => r.data);
const put = <T>(url: string, body: unknown) => http.put<T>(url, body).then((r) => r.data);
const post = <T>(url: string, body?: unknown) => http.post<T>(url, body ?? {}).then((r) => r.data);
const co = (id: string) => `/admin/settings/companies/${id}`;

export const settingsApi = {
  companies: () => get<AdminCompany[]>('/admin/settings/companies'),
  company: (id: string) => get<CompanySettings>(co(id)),
  numbering: (id: string) => get<Numbering>(`${co(id)}/numbering`),
  profile: (id: string, b: ProfileBody) => put<CompanySettings>(`${co(id)}/profile`, b),
  authorisers: (id: string, b: AuthorisersBody) => put<CompanySettings>(`${co(id)}/authorisers`, b),
  policies: (id: string, b: PoliciesBody) => put<CompanySettings>(`${co(id)}/policies`, b),
  workingHours: (id: string, b: WorkingHoursBody) => put<CompanySettings>(`${co(id)}/working-hours`, b),
  addHoliday: (id: string, b: HolidayBody) => post<CompanySettings>(`${co(id)}/holidays`, b),
  removeHoliday: (id: string, hid: string) => post<CompanySettings>(`${co(id)}/holidays/${hid}/remove`),
  gstRate: (b: GstRateBody) => put<GstRow[]>('/admin/settings/gst-rates', b),
  testSla: (b: TestSlaBody) => put<S['TestSlaTarget'][]>('/admin/settings/test-sla-targets', b),
};

export const useAdminCompanies = () => useQuery({ queryKey: k.companies, queryFn: settingsApi.companies, staleTime: 60_000 });
export const useCompanySettings = (id: string | null) =>
  useQuery({ queryKey: k.company(id ?? ''), queryFn: () => settingsApi.company(id!), enabled: !!id });
export const useNumbering = (id: string | null) =>
  useQuery({ queryKey: k.numbering(id ?? ''), queryFn: () => settingsApi.numbering(id!), enabled: !!id });

/**
 * One tab's save. `fn` may run several calls (a tab can span a per-company write + a GLOBAL write);
 * afterwards every admin-settings query refetches, plus the reads other screens cache config in
 * (entity profile in the shell, BR-11 supply screens, BR-10 MIS authorities) so they show the new values.
 */
export function useSettingsSave<A>(fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      for (const key of [k.all, ['entity-profile'], ['supply'], ['mis']]) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** Current Indian fiscal year label for a date, e.g. 2026-27 (br08_fiscal_year). */
export function fiscalYearOf(d: Date) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}
