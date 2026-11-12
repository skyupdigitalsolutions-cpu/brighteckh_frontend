// E8 · Repair report · submit (Figma 177:104639).
// POST /jobs/{id}/repair-report { work_performed, root_cause?, parts_replaced_summary? } → new version (from 1).
// Server rules: no open repair session, ≥1 COMPLETED session by this engineer, no open test run.
// Submitting starts the test-start SLA clock; the target text comes from GET repair-status tests.test_sla.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IconClock, IconFlask, IconSend } from '@tabler/icons-react';
import { api } from '../../api/endpoints';
import { apiStatus } from '../../api/http';
import type { JobDetail } from '../../api/types';
import { useMe } from '../../auth/AuthProvider';
import { formatDateTime } from '../../lib/format';
import { Button, Card, ErrorState, FormError, InlineAlert, SkeletonCard, StatusBadge, TextArea } from '../../ui/primitives';
import { GatedAction } from '../../ui/mobile';
import { qk, useRepairStatus } from './data';
import { JobFrame, useJobAction } from './JobFrame';
import { canWork } from './RepairMaterialPage';

export function RepairReportPage() {
  const { jobId = '' } = useParams();
  return (
    <JobFrame jobId={jobId} title="Report" flow="br07" step="report">
      {(job) => <RepairReport job={job} />}
    </JobFrame>
  );
}

function RepairReport({ job }: { job: JobDetail }) {
  const me = useMe();
  const rs = useRepairStatus(job.id);
  const detail = useQuery({
    queryKey: qk.repairReport(job.id),
    queryFn: async () => { try { return await api.repairReport(job.id); } catch (e) { if (apiStatus(e) === 404) return null; throw e; } },
  });
  const [revising, setRevising] = useState(false);
  const can = canWork(job, me.id);

  if (rs.isPending || detail.isPending) return <><SkeletonCard /><SkeletonCard /></>;
  if (rs.error || detail.error) return <ErrorState title="Couldn't load the repair report" onRetry={() => { void rs.refetch(); void detail.refetch(); }} />;

  const report = detail.data;
  const latest = report?.versions[report.versions.length - 1] ?? null;
  const sla = rs.data.tests.test_sla;

  if (latest && !revising) {
    const openRun = rs.data.tests.runs.some((r) => r.result == null);
    return (
      <>
        <InlineAlert tone="success" title={`Version ${latest.version_no} submitted`}>
          Sent {formatDateTime(latest.submitted_at)}. {sla.due_at ? `Testing due by ${formatDateTime(sla.due_at)}.` : sla.due_at_reason ?? ''}
        </InlineAlert>
        <Card>
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">Repair report</span>
            <StatusBadge domain="repairReport" value={report!.status} />
          </div>
        </Card>
        <TextArea label="Work performed" value={latest.work_performed} readOnlyLocked />
        <TextArea label="Root cause" value={latest.root_cause ?? ''} readOnlyLocked />
        <TextArea label="Parts replaced" value={latest.parts_replaced_summary ?? ''} readOnlyLocked />
        <p className="text-sm text-fg-2">Locked after submit</p>
        {can && (
          <div className="flex flex-col gap-3">
            <Link to={`/jobs/${job.id}/repair/test`}><Button block icon={<IconFlask size={20} />}>Go to testing</Button></Link>
            {!openRun && <Button kind="ghost" block onClick={() => setRevising(true)}>Submit a revised version</Button>}
          </div>
        )}
      </>
    );
  }

  if (!can) return <InlineAlert tone="neutral" title="No repair report yet">Only the engineer holding custody can write it.</InlineAlert>;
  return <ReportForm job={job} prefill={latest} onDone={() => setRevising(false)} slaTarget={sla.target} priority={sla.priority} />;
}

function ReportForm({ job, prefill, onDone, slaTarget, priority }: {
  job: JobDetail;
  prefill: { work_performed: string; root_cause: string | null; parts_replaced_summary: string | null } | null;
  onDone: () => void; slaTarget: string | null; priority: string;
}) {
  const me = useMe();
  const rs = useRepairStatus(job.id);
  const [work, setWork] = useState(prefill?.work_performed ?? '');
  const [cause, setCause] = useState(prefill?.root_cause ?? '');
  const [parts, setParts] = useState(prefill?.parts_replaced_summary ?? '');
  const submit = useJobAction(job.id, () => api.submitRepairReport(job.id, {
    work_performed: work.trim(),
    ...(cause.trim() ? { root_cause: cause.trim() } : {}),
    ...(parts.trim() ? { parts_replaced_summary: parts.trim() } : {}),
  }), onDone);

  const sessions = rs.data?.repair_sessions.sessions ?? [];
  const blocked = sessions.some((s) => s.status === 'ACTIVE' || s.status === 'PAUSED') ? 'Stop the repair timer before submitting'
    : !sessions.some((s) => s.status === 'COMPLETED' && s.engineer_id === me.id) ? 'Complete at least one repair session first'
    : rs.data?.tests.runs.some((r) => r.result == null) ? 'Record the open test cycle result first'
    : !work.trim() ? 'Describe the work performed'
    : null;

  return (
    <>
      <TextArea label="Work performed" value={work} onChange={(e) => setWork(e.target.value)} rows={3} helper="Required" />
      <TextArea label="Root cause" value={cause} onChange={(e) => setCause(e.target.value)} />
      <TextArea label="Parts replaced" value={parts} onChange={(e) => setParts(e.target.value)} />
      <div className="flex items-start gap-2 rounded-lg border border-warn-border bg-warn-bg px-3 py-2.5 text-sm leading-5 text-warn-fg">
        <IconClock size={20} className="shrink-0" />
        <span>
          Submitting starts the test clock
          {slaTarget ? ` · ${priority} jobs are tested within ${formatSlaTarget(slaTarget)}` : ' · no test target is configured for this priority'}
        </span>
      </div>
      <FormError messages={submit.errors} />
      <GatedAction blockedReason={blocked} primaryLabel="Submit repair report" primaryIcon={<IconSend size={20} />} busy={submit.busy} onPrimary={() => submit.run(undefined)} />
      {prefill && <Button kind="ghost" block onClick={onDone}>Cancel</Button>}
    </>
  );
}

/** "4 WORKING_HOUR" → "4 working hours", "1 WORKING_DAY" → "1 working day" (test_sla.target from the API). */
export function formatSlaTarget(t: string) {
  const [amt = '', unit = ''] = t.trim().split(/\s+/);
  const n = Number(amt);
  const word = unit === 'WORKING_HOUR' ? 'working hour' : unit === 'WORKING_DAY' ? 'working day' : unit.toLowerCase().replace(/_/g, ' ');
  return `${amt} ${word}${n === 1 ? '' : 's'}`;
}
