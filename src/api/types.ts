// Typed views over the generated OpenAPI schema (src/api/schema.d.ts).
// Regenerate with `npm run gen:api` after the backend re-exports brightech-openapi.json.
import type { components } from './schema';

export type Schemas = components['schemas'];
export type S<N extends keyof Schemas> = Schemas[N];

export type Role = S<'MeResponse'>['role'];
export type Me = S<'MeResponse'>;
export type TokenPair = S<'TokenPairResponse'>;
export type JobDetail = S<'JobDetail'>;
export type JobStatus = JobDetail['status'];
export type Priority = JobDetail['priority'];
export type InwardReceiptDetail = S<'InwardReceiptDetail'>;
export type EquipmentUnit = S<'InwardEquipmentUnitsRow'>;
export type Assembly = S<'FdnAssemblyMasterRow'>;
export type InspectionSession = S<'Br03InspectionSessionsRow'>;
export type InspectionSessions = S<'InspectionSessionsResponse'>;
export type InspectionReport = S<'InspectionReportDetail'>;
export type InspectionVersion = S<'Br03InspectionReportVersionsRow'>;
export type InspectionOutcome = S<'SubmitInspectionVersionDto'>['outcome'];
export type InspectionMedia = S<'Br03InspectionMediaRow'>;
export type MaterialRequest = S<'MaterialRequestDetail'>;
export type MaterialRequestRow = S<'Br03MaterialRequestsRow'>;
export type MaterialLine = S<'Br03MaterialRequestLinesRow'>;
export type Item = S<'FdnItemMasterRow'>;
export type RepairStatus = S<'RepairStatusResponse'>;
export type RepairSession = S<'Br07RepairSessionsRow'>;
export type RepairReport = S<'RepairReportDetail'>;
export type TestRuns = S<'TestRunsResponse'>;
export type TestRun = S<'Br07TestRunsRow'>;
export type MaterialIssue = S<'Br07MaterialIssuesRow'>;
export type EntityProfile = S<'EntityProfileResponse'>;
