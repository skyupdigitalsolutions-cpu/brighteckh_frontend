// Query hooks for the engineer flow. All server state goes through TanStack Query; mutations
// invalidate the job's keys so every screen re-reads server truth after a write.
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import { apiStatus, http } from '../../api/http';
import type { Assembly, InspectionReport, JobDetail } from '../../api/types';
import type { Step } from '../../ui/mobile';

export const qk = {
  job: (id: string) => ['job', id] as const,
  inward: (id: string) => ['inward', id] as const,
  sessions: (id: string) => ['job', id, 'inspection-sessions'] as const,
  report: (id: string) => ['job', id, 'inspection-report'] as const,
  mrs: ['material-requests'] as const,
  mr: (id: string) => ['material-request', id] as const,
  repair: (id: string) => ['job', id, 'repair-status'] as const,
  repairReport: (id: string) => ['job', id, 'repair-report'] as const,
  item: (id: string) => ['item', id] as const,
};

export function useInvalidateJob(jobId: string) {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ['job', jobId] }),
    qc.invalidateQueries({ queryKey: qk.mrs }),
  ]);
}

/** 404 on an optional sub-resource (no report yet) is "empty", not an error. */
const orNull = async <T,>(p: Promise<T>): Promise<T | null> => {
  try { return await p; } catch (e) { if (apiStatus(e) === 404) return null; throw e; }
};

export const useJob = (id: string) => useQuery({ queryKey: qk.job(id), queryFn: () => api.job(id) });

// G2: no GET /masters/assemblies/{id}; the list endpoint is filtered by status, so look across statuses.
const ASSEMBLY_STATUSES = ['ACTIVE', 'APPROVED', 'UNDER_REVIEW', 'DRAFT'] as const;
function useAssemblyIndex(enabled: boolean) {
  const qs = useQueries({
    queries: ASSEMBLY_STATUSES.map((s) => ({
      queryKey: ['assemblies', s],
      queryFn: () => http.get<Assembly[]>('/masters/assemblies', { params: { status: s } }).then((r) => r.data),
      enabled, staleTime: 5 * 60_000, retry: false,
    })),
  });
  const map = new Map<string, Assembly>();
  for (const q of qs) for (const a of q.data ?? []) map.set(a.id, a);
  return map;
}

/** Job + its unit as received (from GET /inward-receipts/{id}) + assembly name. */
export function useJobContext(jobId: string) {
  const job = useJob(jobId);
  const inward = useQuery({
    queryKey: qk.inward(job.data?.inward_id ?? ''),
    queryFn: () => api.inwardReceipt(job.data!.inward_id),
    enabled: !!job.data,
    staleTime: 60_000,
  });
  const assemblies = useAssemblyIndex(!!inward.data);
  const unit = inward.data?.equipment_units.find((u) => u.id === job.data?.unit_id) ?? null;
  const group = unit ? inward.data?.equipment_groups.find((g) => g.id === unit.group_id) ?? null : null;
  const assembly = group ? assemblies.get(group.assembly_id) ?? null : null;
  const unitsInGroup = group ? inward.data!.equipment_units.filter((u) => u.group_id === group.id).length : 0;
  return { job, inward, unit, group, assembly, unitsInGroup };
}

export function equipmentLabel(assembly: Assembly | null, unit: { observed_make?: string | null; observed_model?: string | null } | null) {
  if (assembly) return assembly.standard_name;
  const mm = [unit?.observed_make, unit?.observed_model].filter(Boolean).join(' · ');
  return mm || 'Equipment';
}

export const useInspectionSessions = (jobId: string) =>
  useQuery({ queryKey: qk.sessions(jobId), queryFn: () => api.inspectionSessions(jobId) });
export const useInspectionReport = (jobId: string) =>
  useQuery({ queryKey: qk.report(jobId), queryFn: () => orNull(api.inspectionReport(jobId)) });
export const useJobMaterialRequests = (jobId: string) =>
  useQuery({ queryKey: qk.mrs, queryFn: api.materialRequests, select: (rows) => rows.filter((r) => r.job_id === jobId) });
export const useRepairStatus = (jobId: string) =>
  useQuery({ queryKey: qk.repair(jobId), queryFn: () => api.repairStatus(jobId) });

// ---------------------------------------------------------------- step trackers
export const BR03_STEPS = (jobId: string): Step[] => [
  { key: 'custody', label: 'Custody', to: `/jobs/${jobId}` },
  { key: 'inspect', label: 'Inspect', to: `/jobs/${jobId}/inspect` },
  { key: 'report', label: 'Report', to: `/jobs/${jobId}/report` },
  { key: 'material', label: 'Material', to: `/jobs/${jobId}/material` },
];
export const BR07_STEPS = (jobId: string): Step[] => [
  { key: 'material', label: 'Material', to: `/jobs/${jobId}/repair/material` },
  { key: 'repair', label: 'Repair', to: `/jobs/${jobId}/repair/timer` },
  { key: 'report', label: 'Report', to: `/jobs/${jobId}/repair/report` },
  { key: 'test', label: 'Test', to: `/jobs/${jobId}/repair/test` },
  { key: 'handoff', label: 'Handoff', to: `/jobs/${jobId}/repair/handoff` },
];

/**
 * BR-03 progress. Custody-ack is what accepts the assignment (PENDING -> ACCEPTED), so custody is done
 * exactly when the current assignment's response is ACCEPTED — read from GET /jobs/{id}, no local state.
 */
export function useBr03Done(jobId: string) {
  const job = useJob(jobId);
  const sessions = useInspectionSessions(jobId);
  const report = useInspectionReport(jobId);
  const mrs = useJobMaterialRequests(jobId);
  const done = new Set<string>();
  const r: InspectionReport | null | undefined = report.data;
  if (job.data?.current_assignment?.response === 'ACCEPTED') done.add('custody');
  if (sessions.data?.sessions.some((s) => s.status === 'COMPLETED') || (r && r.versions.length > 0)) done.add('inspect');
  if (r?.status === 'ACCEPTED') done.add('report');
  if (mrs.data?.some((m) => ['SUBMITTED', 'PROCESSING', 'CHANGE_REQUESTED', 'CLOSED'].includes(m.status))) done.add('material');
  return done;
}

export function useBr07Done(jobId: string) {
  const rs = useRepairStatus(jobId);
  const done = new Set<string>();
  const d = rs.data;
  if (!d) return done;
  const issues = d.material?.issues ?? [];
  if (issues.length > 0 && issues.every((i) => i.issue_status === 'ACKNOWLEDGED')) done.add('material');
  if (d.repair_sessions?.sessions.some((s) => s.status === 'COMPLETED')) done.add('repair');
  if (d.repair_report?.status === 'SUBMITTED') done.add('report');
  const runs = [...(d.tests?.runs ?? [])].sort((a, b) => b.cycle_no - a.cycle_no);
  if (runs[0]?.result === 'PASS') done.add('test');
  if ((d.handoffs?.length ?? 0) > 0) done.add('handoff');
  return done;
}

/** Job is in the engineer's hands only if they are the current assignee. */
export const isMine = (job: JobDetail | undefined, meId: string) => job?.current_assignment?.engineer_id === meId;

/** Item name lookup for issued material (Br07MaterialIssuesRow.item_id → GET /masters/items/{id}). */
export const useItem = (itemId: string | null | undefined) =>
  useQuery({ queryKey: qk.item(itemId ?? ''), queryFn: () => api.item(itemId!), enabled: !!itemId, staleTime: 10 * 60_000 });

/** Remaining engineer-held quantity on an issue = issued − consumed − returned − return-pending (decimal strings). */
export function heldQty(i: { issued_quantity: string; consumed_quantity: string; returned_quantity: string; return_pending_quantity: string }) {
  return Number(i.issued_quantity) - Number(i.consumed_quantity) - Number(i.returned_quantity) - Number(i.return_pending_quantity);
}
