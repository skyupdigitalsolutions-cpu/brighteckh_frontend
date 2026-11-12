// E11 · Handoff · return unused (Figma 177:104739).
// POST /material-issues/{id}/returns { quantity, return_reason? } (Purchase verifies before stock goes back);
// POST /jobs/{id}/technical-handoff { note? } — requires the highest test cycle to be PASS and no open repair session.
// Handoff does NOT block on parts still held (BR-07 open decision 4); the server snapshots outstanding qty.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconArrowBackUp, IconLock, IconSend } from '@tabler/icons-react';
import { api } from '../../api/endpoints';
import type { JobDetail, MaterialIssue } from '../../api/types';
import { useMe } from '../../auth/AuthProvider';
import { formatDateTime, formatQty } from '../../lib/format';
import { BottomSheet, Button, Card, ErrorState, FormError, InlineAlert, SkeletonCard, StatusBadge, TextArea } from '../../ui/primitives';
import { GatedAction } from '../../ui/mobile';
import { heldQty, useItem, useRepairStatus } from './data';
import { JobFrame, useJobAction } from './JobFrame';
import { QtyStepper } from './MaterialRequestPage';
import { canWork } from './RepairMaterialPage';

export function HandoffPage() {
  const { jobId = '' } = useParams();
  return (
    <JobFrame jobId={jobId} title="Handoff" flow="br07" step="handoff">
      {(job) => <Handoff job={job} />}
    </JobFrame>
  );
}

function Handoff({ job }: { job: JobDetail }) {
  const me = useMe();
  const rs = useRepairStatus(job.id);
  const [note, setNote] = useState('');
  const [returning, setReturning] = useState<MaterialIssue | null>(null);
  const can = canWork(job, me.id);
  const handoff = useJobAction(job.id, () => api.technicalHandoff(job.id, note.trim() ? { note: note.trim() } : {}), () => setNote(''));

  if (rs.isPending) return <><SkeletonCard /><SkeletonCard /></>;
  if (rs.error) return <ErrorState title="Couldn't load the handoff" onRetry={() => void rs.refetch()} />;

  const { tests, material, handoffs, repair_sessions, dispatch_release } = rs.data;
  const latest = [...tests.runs].sort((a, b) => b.cycle_no - a.cycle_no)[0] ?? null;
  const lastHandoff = [...handoffs].sort((a, b) => b.handed_off_at.localeCompare(a.handed_off_at))[0] ?? null;
  const handedThisRun = !!latest && handoffs.some((h) => h.test_run_id === latest.id);
  const held = material.issues.filter((i) => i.issue_status === 'ACKNOWLEDGED' && i.issued_to_engineer_id === me.id && heldQty(i) > 0);
  const sessionOpen = repair_sessions.sessions.some((s) => s.status === 'ACTIVE' || s.status === 'PAUSED');
  const stop = tests.reviews.some((r) => r.decision === 'STOP');

  const blocked = !latest ? 'No test cycle yet'
    : latest.result == null ? `Record the result of cycle ${latest.cycle_no} first`
    : latest.result !== 'PASS' ? `Cycle ${latest.cycle_no} failed — a passing cycle is required`
    : stop ? 'Purchase decided STOP for this job'
    : sessionOpen ? 'Stop the repair timer first'
    : dispatch_release ? 'Already released for dispatch'
    : null;

  return (
    <>
      {latest && (
        <Card>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-base font-medium">Cycle {latest.cycle_no}</span>
            {latest.result && <IconLock size={16} className="text-fg-muted" aria-label="Locked" />}
            {latest.result ? <StatusBadge domain="testResult" value={latest.result} /> : <span className="text-sm text-fg-2">in progress</span>}
          </div>
          {latest.observations && <p className="text-sm leading-5 text-fg-2">{latest.observations}</p>}
        </Card>
      )}

      <Card title="Unused parts with you">
        {held.length === 0 && material.returns.length === 0 ? (
          <p className="text-sm text-fg-2">None — nothing to return.</p>
        ) : (
          <>
            {held.map((i) => <HeldRow key={i.id} issue={i} onReturn={can && !dispatch_release ? () => setReturning(i) : undefined} />)}
            {material.returns.map((r) => {
              const issue = material.issues.find((i) => i.id === r.issue_id);
              return issue ? <ReturnRow key={r.id} issue={issue} qty={r.quantity} status={r.return_status} /> : null;
            })}
            <p className="text-sm leading-5 text-fg-2">Purchase verifies the return before it goes back to main store.</p>
          </>
        )}
      </Card>

      {handedThisRun && lastHandoff ? (
        <InlineAlert tone="success" title="Handed off to Purchase">
          {formatDateTime(lastHandoff.handed_off_at)}
          {Number(lastHandoff.outstanding_engineer_held_qty) > 0 && ` · ${formatQty(lastHandoff.outstanding_engineer_held_qty)} still held at handoff`}
          {lastHandoff.handoff_note && <span className="block">“{lastHandoff.handoff_note}”</span>}
          {dispatch_release && <span className="block">Released for dispatch {formatDateTime(dispatch_release.released_at)}</span>}
        </InlineAlert>
      ) : can ? (
        <>
          <TextArea label="Handoff note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Unit tested OK, ready for dispatch" />
          {held.length > 0 && !blocked && (
            <p className="text-sm text-warn-fg">You still hold unused parts. You can hand off now; Purchase sees what's outstanding.</p>
          )}
          <FormError messages={handoff.errors} />
          <GatedAction blockedReason={blocked} primaryLabel="Hand off to Purchase" primaryIcon={<IconSend size={20} />} busy={handoff.busy} onPrimary={() => handoff.run(undefined)} />
        </>
      ) : null}

      {returning && <ReturnSheet jobId={job.id} issue={returning} onClose={() => setReturning(null)} />}
    </>
  );
}

function HeldRow({ issue, onReturn }: { issue: MaterialIssue; onReturn?: () => void }) {
  const item = useItem(issue.item_id);
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 text-base leading-6">{item.data?.standard_name ?? '…'} · {formatQty(String(heldQty(issue)), issue.uom)}</span>
      {onReturn && <Button kind="secondary" size="desktop" icon={<IconArrowBackUp size={16} />} onClick={onReturn}>Return</Button>}
    </div>
  );
}
function ReturnRow({ issue, qty, status }: { issue: MaterialIssue; qty: string; status: string }) {
  const item = useItem(issue.item_id);
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 text-base leading-6">{item.data?.standard_name ?? '…'} · {formatQty(qty, issue.uom)}</span>
      <StatusBadge domain="materialReturn" value={status} />
    </div>
  );
}

function ReturnSheet({ jobId, issue, onClose }: { jobId: string; issue: MaterialIssue; onClose: () => void }) {
  const item = useItem(issue.item_id);
  const max = Math.floor(heldQty(issue));
  const [qty, setQty] = useState(max);
  const [reason, setReason] = useState('');
  const act = useJobAction(jobId, () => api.requestReturn(issue.id, { quantity: qty, ...(reason.trim() ? { return_reason: reason.trim() } : {}) }), onClose);
  return (
    <BottomSheet open onClose={onClose} title="Return unused part">
      <p className="text-base font-medium">{item.data?.standard_name ?? '…'}</p>
      <QtyStepper value={qty} onChange={setQty} uom={issue.uom} max={max} />
      <TextArea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Not needed after repair" />
      <FormError messages={act.errors} />
      <GatedAction blockedReason={qty < 1 ? 'Choose a quantity' : null} primaryLabel="Request return" primaryIcon={<IconArrowBackUp size={20} />} busy={act.busy} onPrimary={() => act.run(undefined)} />
      <Button kind="ghost" block onClick={onClose}>Cancel</Button>
    </BottomSheet>
  );
}
