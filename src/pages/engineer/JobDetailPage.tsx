// E2 · Job detail · before custody (Figma 15:194) + E2b · Custody sheet (15:271).
// POST /jobs/{id}/custody-ack { condition_note? } — allowed only while the current assignment is PENDING;
// it accepts the assignment (response → ACCEPTED) and moves the job to ACCEPTED.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconCheck, IconChevronRight, IconPlayerPlay, IconTool } from '@tabler/icons-react';
import { api } from '../../api/endpoints';
import type { JobDetail } from '../../api/types';
import { formatDateTime, formatTime } from '../../lib/format';
import { BottomSheet, Button, Card, FormError, KV, PriorityFlag, SkeletonCard, StatusBadge, TextArea } from '../../ui/primitives';
import { equipmentLabel, useInspectionReport, useJobContext } from './data';
import { JobFrame, useJobAction } from './JobFrame';

export function JobDetailPage() {
  const { jobId = '' } = useParams();
  const [sheet, setSheet] = useState(false);
  return (
    <JobFrame
      jobId={jobId}
      flow="br03"
      step="overview"
      actions={(job) => <Actions job={job} onAck={() => setSheet(true)} />}
    >
      {(job) => (
        <>
          <Overview job={job} />
          <CustodySheet job={job} open={sheet} onClose={() => setSheet(false)} />
        </>
      )}
    </JobFrame>
  );
}

function Overview({ job }: { job: JobDetail }) {
  const { inward, unit, assembly, unitsInGroup } = useJobContext(job.id);
  const report = useInspectionReport(job.id);
  const a = job.current_assignment;
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xl font-semibold leading-[26px]">{job.job_number}</span>
          <PriorityFlag priority={job.priority} />
          <StatusBadge domain="job" value={job.status} />
        </div>
        <p className="text-base font-medium leading-6">{inward.isPending ? '…' : equipmentLabel(assembly, unit)}</p>
        {inward.data && unit && (
          <p className="text-sm leading-5 text-fg-2">
            From {inward.data.jin_number} · unit {unit.unit_number} of {unitsInGroup} · {job.route.replace(/_/g, ' ')}
          </p>
        )}
      </Card>

      {inward.isPending ? <SkeletonCard /> : inward.error ? (
        <Card title="Unit as received"><p className="text-sm text-st-blocked-fg">Couldn't load the intake record.</p></Card>
      ) : (
        <Card title="Unit as received">
          <dl className="flex flex-col gap-3">
            <KV label="Serial no." mono>{unit?.serial_number ?? '—'}</KV>
            <KV label="Make / model">{[unit?.observed_make, unit?.observed_model].filter(Boolean).join(' · ') || '—'}</KV>
            <KV label="Reported fault">{unit?.reported_fault ?? '—'}</KV>
            <KV label="Condition">{unit?.physical_condition ?? '—'}</KV>
            <KV label="Accessories">{unit?.accessories ?? '—'}</KV>
          </dl>
        </Card>
      )}

      <Card>
        <dl className="flex flex-col gap-3">
          <KV label="Assigned">{a ? formatDateTime(a.assigned_at) : '—'}</KV>
          <KV label="Response">{a ? <StatusBadge domain="assignment" value={a.response} /> : '—'}</KV>
          {a?.responded_at && <KV label="Custody since">{formatDateTime(a.responded_at)}</KV>}
        </dl>
      </Card>

      {/* BR-07 entry point: once Purchase accepts the inspection report the repair/test flow opens. */}
      {report.data?.status === 'ACCEPTED' && (
        <Link to={`/jobs/${job.id}/repair/material`} className="flex items-center gap-3 rounded-[10px] border border-line bg-surface p-4 hover:border-line-strong">
          <IconTool size={24} className="shrink-0 text-fg-2" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium leading-6">Repair &amp; test</p>
            <p className="text-sm leading-5 text-fg-2">Material, repair timer, report, test cycles, handoff</p>
          </div>
          <IconChevronRight size={24} className="text-fg-muted" />
        </Link>
      )}
    </>
  );
}

function Actions({ job, onAck }: { job: JobDetail; onAck: () => void }) {
  const response = job.current_assignment?.response;
  if (response === 'PENDING') {
    return <Button icon={<IconCheck size={20} />} onClick={onAck} className="self-start">Acknowledge custody</Button>;
  }
  if (response === 'ACCEPTED') {
    return (
      <Link to={`/jobs/${job.id}/inspect`} className="self-start">
        <Button kind="secondary" icon={<IconPlayerPlay size={20} />}>Go to inspection</Button>
      </Link>
    );
  }
  return null;
}

function CustodySheet({ job, open, onClose }: { job: JobDetail; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const ack = useJobAction(job.id, (condition_note: string) =>
    api.custodyAck(job.id, condition_note.trim() ? { condition_note: condition_note.trim() } : {}),
  (row) => {
    onClose();
    navigate(`/jobs/${job.id}/inspect`, { state: { toast: `Custody recorded · ${formatTime(row.acknowledged_at)}` } });
  });
  return (
    <BottomSheet open={open} onClose={onClose} title="Confirm you have the unit">
      <p className="text-base leading-6 text-fg-2">
        This records you as the custodian of {job.job_number} from now. Note anything that differs from the intake record.
      </p>
      <TextArea
        label="Condition note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Second burn mark on the rear panel"
      />
      <FormError messages={ack.errors} />
      <Button block busy={ack.busy} icon={<IconCheck size={20} />} onClick={() => ack.run(note)}>I have the unit</Button>
      <Button kind="ghost" block onClick={onClose}>Cancel</Button>
    </BottomSheet>
  );
}
