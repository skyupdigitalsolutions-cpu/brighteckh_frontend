// Status badge tones, copied from the Figma "Badge catalogue · API status enums" (01 · Components, node 3:22).
// The same enum value can carry different tones in different domains (e.g. ACCEPTED is Progress as a
// job status but Success as an assignment response), so tones are looked up per domain.
import type { S } from '../api/types';

export type Tone = 'neutral' | 'progress' | 'success' | 'blocked';
type Map<T extends string> = Record<T, Tone>;

const job: Map<S<'JobDetail'>['status']> = {
  JOB_CREATED: 'neutral', AWAITING_ASSIGNMENT: 'neutral', ASSIGNED: 'progress', ACCEPTED: 'progress',
  INSPECTION: 'progress', ON_HOLD: 'blocked', CANCELLED: 'blocked', CLOSED: 'success',
};
const assignment: Map<S<'JobAssignmentsRow'>['response']> = {
  PENDING: 'neutral', ACCEPTED: 'success', DECLINED: 'blocked', REASSIGNED: 'neutral',
};
const route: Map<S<'JobDetail'>['route']> = { IN_HOUSE: 'neutral', EXTERNAL: 'neutral', ONSITE_LINKED: 'neutral' };
const session: Map<S<'Br03InspectionSessionsRow'>['status']> = {
  ACTIVE: 'progress', PAUSED: 'neutral', COMPLETED: 'success', INTERRUPTED: 'blocked',
};
const inspectionReport: Map<S<'InspectionReportDetail'>['status']> = {
  DRAFT: 'neutral', SUBMITTED: 'progress', RETURNED: 'blocked', ACCEPTED: 'success', AMENDMENT_REQUIRED: 'blocked',
};
const reportVersion: Map<S<'Br03InspectionReportVersionsRow'>['version_status']> = {
  SUBMITTED: 'progress', ACCEPTED: 'success', RETURNED: 'blocked', SUPERSEDED: 'neutral',
};
const outcome: Map<S<'SubmitInspectionVersionDto'>['outcome']> = {
  REPAIR_REQUIRED: 'progress', NO_FAULT_FOUND: 'success', NOT_REPAIRABLE: 'blocked',
  EXTERNAL_REPAIR_REQUIRED: 'progress', FURTHER_INSPECTION_REQUIRED: 'neutral',
};
const materialRequest: Map<S<'Br03MaterialRequestsRow'>['status']> = {
  DRAFT: 'neutral', SUBMITTED: 'progress', PROCESSING: 'progress', RETURNED: 'blocked',
  CHANGE_REQUESTED: 'blocked', WITHDRAWN: 'neutral', CLOSED: 'success',
};
const changeRequest: Map<S<'Br03MaterialChangeRequestsRow'>['review_status']> = {
  PENDING: 'progress', ACCEPTED: 'success', REJECTED: 'blocked',
};
const itemStatus: Map<S<'FdnItemMasterRow'>['status']> = {
  DRAFT: 'neutral', UNDER_REVIEW: 'progress', APPROVED: 'success', ACTIVE: 'success',
  ON_HOLD: 'blocked', INACTIVE: 'neutral', SUPERSEDED: 'neutral',
};
const repairReport: Map<S<'RepairReportDetail'>['status']> = { DRAFT: 'neutral', SUBMITTED: 'success' };
const testResult: Map<NonNullable<S<'Br07TestRunsRow'>['result']>> = { PASS: 'success', FAIL: 'blocked' };
const issue: Map<S<'Br07MaterialIssuesRow'>['issue_status']> = { PENDING_POST: 'neutral', ISSUED: 'progress', ACKNOWLEDGED: 'success' };
const slaState: Map<S<'SlaInstancesRow'>['state']> = { OPEN: 'progress', MET: 'success', BREACHED: 'blocked', PAUSED: 'neutral' };
const materialReturn: Map<S<'Br07MaterialReturnsRow'>['return_status']> = { REQUESTED: 'progress', VERIFIED: 'success', REJECTED: 'blocked' };
const consumption: Map<S<'Br07MaterialConsumptionsRow'>['consumption_status']> = { PENDING_POST: 'neutral', POSTED: 'success' };
const reviewDecision: Map<S<'Br07TestFailureReviewsRow'>['decision']> = { CONTINUE: 'progress', STOP: 'blocked' };

export const TONES = {
  job, assignment, route, session, inspectionReport, reportVersion, outcome, materialRequest, changeRequest,
  itemStatus, repairReport, testResult, issue, slaState, reviewDecision, materialReturn, consumption,
} as const;
export type ToneDomain = keyof typeof TONES;

export function toneOf(domain: ToneDomain, value: string): Tone {
  return (TONES[domain] as Record<string, Tone>)[value] ?? 'neutral';
}
