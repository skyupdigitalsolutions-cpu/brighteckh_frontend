// E6 · Material issued · acknowledge (Figma 177:104549).
// GET /jobs/{id}/repair-status → material.issues; POST /material-issues/{id}/acknowledge { note? } per ISSUED row.
// A repair session can only start once the engineer has acknowledged issued material (DB rule).
import { Link, useParams } from 'react-router-dom';
import { IconCheck, IconPackage, IconPlayerPlay } from '@tabler/icons-react';
import { api } from '../../api/endpoints';
import type { JobDetail, MaterialIssue } from '../../api/types';
import { useMe } from '../../auth/AuthProvider';
import { formatDateTime, formatQty } from '../../lib/format';
import { Button, EmptyState, ErrorState, FormError, KV, SkeletonCard, StatusBadge } from '../../ui/primitives';
import { heldQty, useItem, useRepairStatus } from './data';
import { JobFrame, useJobAction } from './JobFrame';

export function RepairMaterialPage() {
  const { jobId = '' } = useParams();
  return (
    <JobFrame jobId={jobId} title="Material" flow="br07" step="material">
      {(job) => <IssuedMaterial job={job} />}
    </JobFrame>
  );
}

export const canWork = (job: JobDetail, meId: string) =>
  job.current_assignment?.engineer_id === meId && job.current_assignment.response === 'ACCEPTED';

function IssuedMaterial({ job }: { job: JobDetail }) {
  const me = useMe();
  const rs = useRepairStatus(job.id);
  const toAck = rs.data?.material.issues.filter((i) => i.issue_status === 'ISSUED' && i.issued_to_engineer_id === me.id) ?? [];
  const ack = useJobAction(job.id, async () => {
    for (const i of toAck) await api.acknowledgeIssue(i.id, {});
  });

  if (rs.isPending) return <><SkeletonCard /><SkeletonCard /></>;
  if (rs.error) return <ErrorState title="Couldn't load issued material" onRetry={() => void rs.refetch()} />;

  const issues = rs.data.material.issues;
  if (issues.length === 0) {
    return (
      <EmptyState icon={<IconPackage size={28} />} title="No material issued yet">
        Purchase issues parts once the job is released and stock is reserved. Repair starts after you confirm you have them.
      </EmptyState>
    );
  }
  const anyAcked = issues.some((i) => i.issue_status === 'ACKNOWLEDGED' && i.issued_to_engineer_id === me.id);
  return (
    <>
      <p className="text-base leading-6 text-fg-2">
        {toAck.length ? 'Purchase issued these parts to you. Check them, then confirm you have them.' : 'Parts issued to you on this job.'}
      </p>
      <ul className="flex flex-col gap-3">{issues.map((i) => <li key={i.id}><IssueCard issue={i} /></li>)}</ul>
      <FormError messages={ack.errors} />
      {canWork(job, me.id) && (
        toAck.length > 0 ? (
          <Button block busy={ack.busy} icon={<IconCheck size={20} />} onClick={() => ack.run(undefined)}>I have these parts</Button>
        ) : anyAcked ? (
          <Link to={`/jobs/${job.id}/repair/timer`}><Button block kind="secondary" icon={<IconPlayerPlay size={20} />}>Go to repair timer</Button></Link>
        ) : null
      )}
    </>
  );
}

function IssueCard({ issue }: { issue: MaterialIssue }) {
  const item = useItem(issue.item_id);
  const held = heldQty(issue);
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-medium text-fg-2">{item.data?.item_code ?? '…'}</span>
        <span className="flex-1" />
        <StatusBadge domain="issue" value={issue.issue_status} />
      </div>
      <p className="text-base font-medium leading-6">{item.data?.standard_name ?? (item.error ? 'Item name unavailable' : '…')}</p>
      <dl className="flex flex-col gap-2">
        <KV label="Quantity" mono>{formatQty(issue.issued_quantity, issue.uom)}</KV>
        <KV label="Issued">{formatDateTime(issue.posted_at ?? issue.created_at)}</KV>
        {issue.issue_status === 'ACKNOWLEDGED' && (
          <>
            <KV label="With you" mono>{formatQty(String(held), issue.uom)}</KV>
            {Number(issue.consumed_quantity) > 0 && <KV label="Used" mono>{formatQty(issue.consumed_quantity, issue.uom)}</KV>}
          </>
        )}
      </dl>
    </div>
  );
}
