// BR-10 Management MIS + RBAC data layer. Shared by the Management shell (/mg) and the SYSTEM_ADMIN shell (/a).
//
// Reads, any authenticated role:
//   GET /mis/catalogue                        roles, permission matrix, reports, column masks
//   GET /mis/my-access                        the caller's bindings, grants, Sales customer assignments
//   GET /mis/authorities                      who authorises FINANCIAL / CROSS_COMPANY grants (CLIENT-UNCONFIRMED until set)
//   GET /mis/companies                        legal entities (report `companies` scope, grant target company)
//   GET /mis/report-grants/pending-my-approval  grants the caller can approve now (+ can_approve_kinds)
//   GET /mis/reports/:code[/export]           entitled per call (ACTIVE binding + matrix + ACTIVE VIEW / EXPORT grant);
//                                             runs in a read-only transaction; masks customer name/GSTIN unless PII grant
// SYSTEM_ADMIN: GET /mis/role-bindings, GET /mis/employees, GET /mis/report-grants, POST bindings / grants / approve / revoke.
// The DB enforces separation of duties (no self-binding / self-grant / self-approval; independent approvals;
// SYSTEM_ADMIN never approves FINANCIAL). The UI only mirrors those rules to hide or explain actions.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../api/http';
import type { components } from '../../api/schema';

type Schemas = components['schemas'];
export type Catalogue = Schemas['Br10Catalogue'];
export type ReportCatalogueRow = Schemas['Br10ReportCatalogueRow'];
export type DataClass = ReportCatalogueRow['data_class'];
export type MyAccess = Schemas['MyAccess'];
export type Binding = Schemas['Br10RoleBindingsRow'];
export type BindingListRow = Schemas['Br10BindingListRow'];
export type Grant = Schemas['Br10ReportGrantsRow'];
export type GrantListRow = Schemas['Br10GrantListRow'];
export type PendingApproval = Schemas['Br10PendingApprovalRow'];
export type ApprovalKind = Schemas['ApproveGrantDto']['approval_kind'];
export type Authority = Schemas['AuthorityStatus'];
export type Company = Schemas['Br10CompanyRow'];
export type Employee = Schemas['Br10EmployeeRow'];
export type ReportResponse = Schemas['ReportResponse'];
export type ReadinessItem = Schemas['ReadinessItem'];
export type ReportCode = Schemas['CreateGrantDto']['report_code'];
export type GrantAction = Schemas['CreateGrantDto']['action'];
export type CreateGrantBody = Schemas['CreateGrantDto'];
export type CreateBindingBody = Schemas['CreateBindingDto'];
export type BrRoleCode = CreateBindingBody['role_code'];
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type ReportParams = { from?: string; to?: string; companies?: string[] };

/** Display names for BR-10 data classes. */
export const DATA_CLASS_LABEL: Record<DataClass, string> = {
  OPERATIONS: 'Operations', PROCUREMENT: 'Procurement', MARGIN_PROFIT: 'Margin / profit', RECEIVABLES: 'Receivables',
  RECEIVABLE_STATUS: 'Receivable status', ENGINEER_PERFORMANCE: 'Engineer performance', AUDIT: 'Audit', CONFIG: 'Configuration',
  PII_CUSTOMER: 'Customer PII',
};

/** br10_is_financial_class (migration 017): these classes need a FINANCIAL approval from the configured authoriser. */
export const FINANCIAL_CLASSES: DataClass[] = ['MARGIN_PROFIT', 'RECEIVABLES', 'AUDIT'];

const get = <T>(url: string, params?: object) => http.get<T>(url, { params }).then((r) => r.data);
const post = <T>(url: string, body?: unknown) => http.post<T>(url, body ?? {}).then((r) => r.data);

function reportQs(p: ReportParams) {
  const out: Record<string, string> = {};
  if (p.from) out.from = p.from;
  if (p.to) out.to = p.to;
  if (p.companies?.length) out.companies = p.companies.join(',');
  return out;
}

export const misApi = {
  catalogue: () => get<Catalogue>('/mis/catalogue'),
  myAccess: () => get<MyAccess>('/mis/my-access'),
  authorities: () => get<Authority[]>('/mis/authorities'),
  companies: () => get<Company[]>('/mis/companies'),
  pendingMyApproval: () => get<PendingApproval[]>('/mis/report-grants/pending-my-approval'),
  report: (code: string, p: ReportParams) => get<ReportResponse>(`/mis/reports/${code}`, reportQs(p)),
  /** Binary download (auth header via the shared axios instance). Returns the blob + server filename. */
  exportReport: async (code: string, p: ReportParams, format: ExportFormat) => {
    const r = await http.get<Blob>(`/mis/reports/${code}/export`, { params: { ...reportQs(p), format }, responseType: 'blob' });
    const cd = String(r.headers['content-disposition'] ?? '');
    const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? `${code.toLowerCase()}.${format}`;
    return { blob: r.data, filename: name };
  },
  approveGrant: (id: string, approval_kind: ApprovalKind) => post<Schemas['GrantWithApprovals']>(`/mis/report-grants/${id}/approve`, { approval_kind }),
  // SYSTEM_ADMIN
  bindings: () => get<BindingListRow[]>('/mis/role-bindings'),
  employees: () => get<Employee[]>('/mis/employees'),
  grants: () => get<GrantListRow[]>('/mis/report-grants'),
  createBinding: (b: CreateBindingBody) => post<Binding>('/mis/role-bindings', b),
  activateBinding: (id: string) => post<Binding>(`/mis/role-bindings/${id}/activate`),
  revokeBinding: (id: string) => post<Binding>(`/mis/role-bindings/${id}/revoke`),
  createGrant: (b: CreateGrantBody) => post<Grant>('/mis/report-grants', b),
  revokeGrant: (id: string) => post<Grant>(`/mis/report-grants/${id}/revoke`),
};

export const mk = {
  all: ['mis'] as const,
  catalogue: ['mis', 'catalogue'] as const,
  myAccess: ['mis', 'my-access'] as const,
  authorities: ['mis', 'authorities'] as const,
  companies: ['mis', 'companies'] as const,
  pending: ['mis', 'pending'] as const,
  report: (code: string, p: ReportParams) => ['mis', 'report', code, reportQs(p)] as const,
  bindings: ['mis', 'bindings'] as const,
  employees: ['mis', 'employees'] as const,
  grants: ['mis', 'grants'] as const,
};

// Catalogue / companies / authorities change rarely; everything else refetches normally.
export const useCatalogue = () => useQuery({ queryKey: mk.catalogue, queryFn: misApi.catalogue, staleTime: 5 * 60_000 });
export const useMyAccess = () => useQuery({ queryKey: mk.myAccess, queryFn: misApi.myAccess });
export const useAuthorities = () => useQuery({ queryKey: mk.authorities, queryFn: misApi.authorities, staleTime: 60_000 });
export const useCompanies = () => useQuery({ queryKey: mk.companies, queryFn: misApi.companies, staleTime: Infinity });
export const usePendingMyApproval = () => useQuery({ queryKey: mk.pending, queryFn: misApi.pendingMyApproval });
export const useReport = (code: string, p: ReportParams, enabled = true) =>
  // A report is a live read: never serve a cached run as "current".
  useQuery({ queryKey: mk.report(code, p), queryFn: () => misApi.report(code, p), enabled, staleTime: 0, refetchOnWindowFocus: false });
export const useBindings = () => useQuery({ queryKey: mk.bindings, queryFn: misApi.bindings });
export const useEmployees = () => useQuery({ queryKey: mk.employees, queryFn: misApi.employees, staleTime: 60_000 });
export const useGrants = () => useQuery({ queryKey: mk.grants, queryFn: misApi.grants });

/** Governance writes change grants, bindings, my-access, pending lists and report entitlement: refresh all MIS reads. */
function useMisMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: mk.all }) });
}
export const useApproveGrant = () => useMisMutation((a: { id: string; kind: ApprovalKind }) => misApi.approveGrant(a.id, a.kind));
export const useCreateBinding = () => useMisMutation(misApi.createBinding);
export const useActivateBinding = () => useMisMutation(misApi.activateBinding);
export const useRevokeBinding = () => useMisMutation(misApi.revokeBinding);
export const useCreateGrant = () => useMisMutation(misApi.createGrant);
export const useRevokeGrant = () => useMisMutation(misApi.revokeGrant);

// ------------------------------------------------------------------ entitlement helpers (mirror the server; never decide)
/** The caller's live grant for (report, action, company), if any (ACTIVE wins over INACTIVE; REVOKED ignored). */
export function grantFor(access: MyAccess | undefined, report: string, action: GrantAction, companyId: string) {
  const live = (access?.grants ?? []).filter((g) => g.report_code === report && g.action === action
    && g.target_company_id === companyId && g.status !== 'REVOKED');
  return live.find((g) => g.status === 'ACTIVE') ?? live[0] ?? null;
}
export const hasActiveBinding = (access: MyAccess | undefined) => (access?.bindings ?? []).some((b) => b.status === 'ACTIVE');

/**
 * Is the caller's role a configured FINANCIAL / CROSS_COMPANY grant authoriser for their company? Drives the
 * Management "Approvals" pill (hidden otherwise). SYSTEM_ADMIN is never a FINANCIAL authoriser (DB rule T08).
 */
export function useIsBr10Authoriser(role: string, enabled: boolean) {
  const q = useQuery({ queryKey: mk.authorities, queryFn: misApi.authorities, staleTime: 60_000, enabled });
  return !!q.data?.some((a) => a.approver_role_code === role && !(role === 'SYSTEM_ADMIN' && a.authority_kind === 'FINANCIAL_GRANT'));
}
