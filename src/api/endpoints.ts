// One typed function per OpenAPI operation the UI uses. Paths, request bodies and
// responses are taken from brightech-openapi.json via the generated schema.
import { http, tokens } from './http';
import type { S } from './types';

const get = <T>(url: string, params?: Record<string, unknown>) => http.get<T>(url, { params }).then((r) => r.data);
const post = <T>(url: string, body?: unknown) => http.post<T>(url, body ?? {}).then((r) => r.data);

export const api = {
  // ---- Auth
  async login(b: S<'LoginDto'>) {
    const r = await post<S<'TokenPairResponse'>>('/auth/login', b);
    tokens.set(r);
    return r;
  },
  async logout() {
    const rt = tokens.refresh;
    try {
      if (rt) await post('/auth/logout', { refresh_token: rt } satisfies S<'RefreshDto'>);
    } finally {
      tokens.clear();
    }
  },
  me: () => get<S<'MeResponse'>>('/auth/me'),
  /** Only used for the company code (entity_code = BLR / CHN) in the header. */
  entityProfile: () => get<S<'EntityProfileResponse'>>('/br08/entity-profile'),

  // ---- BR-02 / masters (reads)
  job: (id: string) => get<S<'JobDetail'>>(`/jobs/${id}`),
  inwardReceipt: (id: string) => get<S<'InwardReceiptDetail'>>(`/inward-receipts/${id}`),
  assemblies: () => get<S<'FdnAssemblyMasterRow'>[]>('/masters/assemblies'),
  item: (id: string) => get<S<'FdnItemMasterRow'>>(`/masters/items/${id}`),
  items: (status: S<'FdnItemMasterRow'>['status']) => get<S<'FdnItemMasterRow'>[]>('/masters/items', { status }),

  // ---- BR-03
  custodyAck: (jobId: string, b: S<'CustodyAckDto'>) =>
    post<S<'Br03CustodyAcknowledgementsRow'>>(`/jobs/${jobId}/custody-ack`, b),
  inspectionSessions: (jobId: string) => get<S<'InspectionSessionsResponse'>>(`/jobs/${jobId}/inspection-sessions`),
  startInspection: (jobId: string) => post<S<'Br03InspectionSessionsRow'>>(`/jobs/${jobId}/inspection-sessions`),
  pauseInspection: (id: string, b: S<'PauseSessionDto'>) =>
    post<S<'Br03InspectionSessionsRow'>>(`/inspection-sessions/${id}/pause`, b),
  resumeInspection: (id: string) => post<S<'Br03InspectionSessionsRow'>>(`/inspection-sessions/${id}/resume`),
  stopInspection: (id: string) => post<S<'Br03InspectionSessionsRow'>>(`/inspection-sessions/${id}/stop`),
  inspectionReport: (jobId: string) => get<S<'InspectionReportDetail'>>(`/jobs/${jobId}/inspection-report`),
  createInspectionReport: (jobId: string) => post<S<'Br03InspectionReportsRow'>>(`/jobs/${jobId}/inspection-reports`),
  addInspectionMedia: (reportId: string, b: S<'AddInspectionMediaDto'>) =>
    post<S<'Br03InspectionMediaRow'>>(`/inspection-reports/${reportId}/media`, b),
  submitInspection: (reportId: string, b: S<'SubmitInspectionVersionDto'>) =>
    post<S<'InspectionVersionResult'>>(`/inspection-reports/${reportId}/submit`, b),
  createMaterialRequest: (jobId: string, b: S<'CreateMaterialRequestDto'>) =>
    post<S<'Br03MaterialRequestsRow'>>(`/jobs/${jobId}/material-requests`, b),
  /** Company-wide list (no job filter in the API) — the UI filters by job_id client-side. */
  materialRequests: () => get<S<'Br03MaterialRequestsRow'>[]>('/material-requests'),
  materialRequest: (id: string) => get<S<'MaterialRequestDetail'>>(`/material-requests/${id}`),
  addMaterialLine: (id: string, b: S<'AddMaterialLineDto'>) =>
    post<S<'Br03MaterialRequestLinesRow'>>(`/material-requests/${id}/lines`, b),
  submitMaterialRequest: (id: string) => post<S<'Br03MaterialRequestsRow'>>(`/material-requests/${id}/submit`),
  createChangeRequest: (id: string, b: S<'CreateChangeRequestDto'>) =>
    post<S<'Br03MaterialChangeRequestsRow'>>(`/material-requests/${id}/change-requests`, b),

  // ---- BR-07
  repairStatus: (jobId: string) => get<S<'RepairStatusResponse'>>(`/jobs/${jobId}/repair-status`),
  repairReport: (jobId: string) => get<S<'RepairReportDetail'>>(`/jobs/${jobId}/repair-report`),
  acknowledgeIssue: (id: string, b: S<'AcknowledgeIssueDto'>) =>
    post<S<'Br07MaterialIssuesRow'>>(`/material-issues/${id}/acknowledge`, b),
  consumeMaterial: (issueId: string, b: S<'ConsumeMaterialDto'>) =>
    post<S<'ConsumptionResult'>>(`/material-issues/${issueId}/consumptions`, b),
  postConsumption: (id: string) => post<S<'ConsumptionResult'>>(`/material-consumptions/${id}/post`),
  requestReturn: (issueId: string, b: S<'RequestReturnDto'>) =>
    post<S<'Br07MaterialReturnsRow'>>(`/material-issues/${issueId}/returns`, b),
  startRepair: (jobId: string) => post<S<'Br07RepairSessionsRow'>>(`/jobs/${jobId}/repair-sessions`),
  pauseRepair: (id: string, b: S<'PauseRepairSessionDto'>) =>
    post<S<'Br07RepairSessionsRow'>>(`/repair-sessions/${id}/pause`, b),
  resumeRepair: (id: string) => post<S<'Br07RepairSessionsRow'>>(`/repair-sessions/${id}/resume`),
  stopRepair: (id: string) => post<S<'Br07RepairSessionsRow'>>(`/repair-sessions/${id}/stop`),
  submitRepairReport: (jobId: string, b: S<'SubmitRepairReportDto'>) =>
    post<S<'RepairReportSubmitted'>>(`/jobs/${jobId}/repair-report`, b),
  startTestRun: (jobId: string, b: S<'StartTestRunDto'>) => post<S<'TestRunStarted'>>(`/jobs/${jobId}/test-runs`, b),
  recordTestResult: (id: string, b: S<'RecordTestResultDto'>) =>
    post<S<'TestResultRecorded'>>(`/test-runs/${id}/result`, b),
  technicalHandoff: (jobId: string, b: S<'TechnicalHandoffDto'>) =>
    post<S<'Br07TechnicalHandoffsRow'>>(`/jobs/${jobId}/technical-handoff`, b),
};
