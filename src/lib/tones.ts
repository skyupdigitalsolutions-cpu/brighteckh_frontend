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

// ---- Purchase desktop (BR-02 intake + BR-04 sourcing/quote) — same catalogue, rows 3:97, 3:118, 3:220,
// 3:241, 3:253, 11:461, 11:512, 11:530, 11:548.
const receipt: Map<S<'InwardReceiptDetail'>['receipt_status']> = {
  REGISTERED: 'neutral', VERIFYING: 'progress', VERIFIED: 'success', ON_HOLD: 'blocked', REJECTED: 'blocked', CLOSED: 'neutral',
};
const unitVerification: Map<S<'InwardEquipmentUnitsRow'>['verification_status']> = {
  PENDING: 'neutral', VERIFIED: 'success', ON_HOLD: 'blocked', REJECTED: 'blocked',
};
const dcException: Map<S<'InwardReceiptDetail'>['dc_exception_status']> = {
  NONE: 'neutral', PENDING: 'progress', RESOLVED: 'success', REJECTED: 'blocked',
};
const rfq: Map<S<'Br04RfqsRow'>['rfq_status']> = {
  DRAFT: 'neutral', SENT: 'progress', OFFERS_RECEIVED: 'progress', COMPARED: 'success', CANCELLED: 'blocked', EXPIRED: 'blocked',
};
const offerTechnical: Map<S<'Br04SupplierOfferLinesRow'>['technical_status']> = {
  PENDING: 'neutral', COMPLIANT: 'success', NONCOMPLIANT: 'blocked',
};
const quote: Map<S<'Br04CustomerQuoteRevisionsRow'>['quote_status']> = {
  DRAFT: 'neutral', RELEASED_TO_SALES: 'progress', SENT: 'progress', ACCEPTED: 'success', REJECTED: 'blocked',
  EXPIRED: 'blocked', SUPERSEDED: 'neutral',
};
const shortage: Map<S<'Br04ShortageSourcesRow'>['shortage_status']> = {
  OPEN: 'blocked', IN_RFQ: 'progress', PRICE_AVAILABLE: 'success', UNAVAILABLE: 'blocked', CLOSED: 'neutral',
};
const invite: Map<S<'Br04RfqSupplierInvitesRow'>['invitation_status']> = {
  INVITED: 'neutral', SENT: 'progress', RESPONDED: 'success', DECLINED: 'blocked', NO_RESPONSE: 'blocked',
};
const offer: Map<S<'OfferRecorded'>['status']> = {
  RECEIVED: 'success', EXPIRED: 'blocked', REVALIDATION_REQUIRED: 'blocked', WITHDRAWN: 'neutral',
};

// ---- BR-06 supplier PO + GRN. PO tones as already drawn on the Purchase PO tab (D·P9); GRN status is the server-derived
// StoresGrnRow.grn_status (OPEN neutral / PARTIAL progress / POSTED success, as drawn on GL0 177:139959).
const purchaseOrder: Map<S<'PurchaseOrderDetail'>['po_status']> = {
  DRAFT: 'neutral', RELEASED: 'progress', ACKNOWLEDGED: 'progress', SHIPPED: 'progress', RECEIVED: 'success', CLOSED: 'success', CANCELLED: 'blocked',
};
const grn: Map<S<'StoresGrnRow'>['grn_status']> = { OPEN: 'neutral', PARTIAL: 'progress', POSTED: 'success' };

export const TONES = {
  job, assignment, route, session, inspectionReport, reportVersion, outcome, materialRequest, changeRequest,
  itemStatus, repairReport, testResult, issue, slaState, reviewDecision, materialReturn, consumption,
  receipt, unitVerification, dcException, rfq, offerTechnical, quote, shortage, invite, offer, purchaseOrder, grn,
} as const;
export type ToneDomain = keyof typeof TONES;

export function toneOf(domain: ToneDomain, value: string): Tone {
  return (TONES[domain] as Record<string, Tone>)[value] ?? 'neutral';
}
