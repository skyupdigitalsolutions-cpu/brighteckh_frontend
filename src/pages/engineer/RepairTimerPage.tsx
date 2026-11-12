// E7 · Repair timer · record part used (Figma 177:104594).
// POST /jobs/{id}/repair-sessions, /repair-sessions/{id}/pause|resume|stop.
// POST /material-issues/{id}/consumptions { quantity, repair_session_id?, note? } — the server inserts AND posts the
// ledger movement in one call; POST /material-consumptions/{id}/post only resumes a stuck PENDING_POST row.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconCheck, IconFileText, IconLock, IconPackage } from '@tabler/icons-react';
import { api } from '../../api/endpoints';
import type { JobDetail, MaterialIssue } from '../../api/types';
import { useMe } from '../../auth/AuthProvider';
import { formatDuration, formatQty, formatTime } from '../../lib/format';
import { BottomSheet, Button, Card, cx, ErrorState, FormError, InlineAlert, KV, SkeletonCard, TextArea } from '../../ui/primitives';
import { SessionTimer, type TimerState } from '../../ui/mobile';
import { heldQty, useItem, useRepairStatus } from './data';
import { JobFrame, useJobAction } from './JobFrame';
import { PauseSheet } from './InspectPage';
import { QtyStepper } from './MaterialRequestPage';
import { canWork } from './RepairMaterialPage';

export function RepairTimerPage() {
  const { jobId = '' } = useParams();
  return (
    <JobFrame
      jobId={jobId}
      title="Repair"
      flow="br07"
      step="repair"
      actions={() => (
        <Link to={`/jobs/${jobId}/repair/report`} className="self-start">
          <Button kind="secondary" icon={<IconFileText size={20} />}>Open repair report</Button>
        </Link>
      )}
    >
      {(job) => <Repair job={job} />}
    </JobFrame>
  );
}

function Repair({ job }: { job: JobDetail }) {
  const me = useMe();
  const rs = useRepairStatus(job.id);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [useOpen, setUseOpen] = useState(false);
  const can = canWork(job, me.id);

  const start = useJobAction(job.id, () => api.startRepair(job.id));
  const resume = useJobAction(job.id, (id: string) => api.resumeRepair(id));
  const stop = useJobAction(job.id, (id: string) => api.stopRepair(id));
  const repost = useJobAction(job.id, (id: string) => api.postConsumption(id));

  if (rs.isPending) return <><SkeletonCard /><SkeletonCard /></>;
  if (rs.error) return <ErrorState title="Couldn't load the repair timer" onRetry={() => void rs.refetch()} />;

  const { repair_sessions: rsess, material, tests } = rs.data;
  const sessions = rsess.sessions;
  const open = [...sessions].reverse().find((s) => s.status === 'ACTIVE' || s.status === 'PAUSED') ?? null;
  const mineTotals = rsess.time_totals.filter((t) => t.engineer_id === me.id);
  const active = mineTotals.reduce((n, t) => n + Number(t.active_seconds ?? 0), 0);
  const paused = mineTotals.reduce((n, t) => n + Number(t.paused_seconds ?? 0), 0);
  const state: TimerState = open?.status === 'ACTIVE' ? 'running' : open?.status === 'PAUSED' ? 'paused' : sessions.length ? 'stopped' : 'idle';

  const held = material.issues.filter((i) => i.issue_status === 'ACKNOWLEDGED' && i.issued_to_engineer_id === me.id && heldQty(i) > 0);
  const hasAcked = material.issues.some((i) => i.issue_status === 'ACKNOWLEDGED' && i.issued_to_engineer_id === me.id);
  const openRun = tests.runs.some((r) => r.result == null);
  const stopped = tests.reviews.some((r) => r.decision === 'STOP');
  const released = !!rs.data.dispatch_release;
  const startBlock = !hasAcked ? 'Confirm the issued material before starting repair'
    : openRun ? 'Record the open test cycle result before another repair session'
    : stopped ? 'Purchase decided STOP — no further repair on this job'
    : released ? 'Released for dispatch — repair is closed'
    : null;
  const pending = material.consumptions.filter((c) => c.consumption_status === 'PENDING_POST' && c.consumed_by_id === me.id);
  const errors = start.errors ?? resume.errors ?? stop.errors ?? repost.errors;

  return (
    <>
      {can && startBlock && !open && (
        <InlineAlert tone="blocked" title={startBlock} icon={<IconLock size={20} />}>
          {!hasAcked && <Link className="underline" to={`/jobs/${job.id}/repair/material`}>Go to material</Link>}
        </InlineAlert>
      )}
      <SessionTimer
        session="Repair"
        state={state}
        activeSeconds={active}
        pausedSeconds={paused}
        asOf={rs.dataUpdatedAt}
        stoppedAt={state === 'stopped' ? formatTime(sessions[sessions.length - 1]?.completed_at) : null}
        busy={start.busy || resume.busy || stop.busy}
        onStart={can && !open && !startBlock ? () => start.run(undefined) : undefined}
        onPause={can && open ? () => setPauseOpen(true) : undefined}
        onResume={can && open ? () => resume.run(open.id) : undefined}
        onStop={can && open ? () => stop.run(open.id) : undefined}
      />
      {can && state === 'stopped' && !startBlock && (
        <Button kind="secondary" busy={start.busy} onClick={() => start.run(undefined)} className="self-start">Start another session</Button>
      )}
      <FormError messages={errors} />

      <Card>
        <dl className="flex flex-col gap-3">
          <KV label="Active" mono>{formatDuration(active)}</KV>
          <KV label="Paused" mono>{formatDuration(paused)}</KV>
          <KV label="Sessions">{sessions.length ? `${sessions.length} · first started ${formatTime(sessions[0]!.started_at)}` : 'None yet'}</KV>
        </dl>
      </Card>

      {can && held.length > 0 && (
        <Button kind="secondary" icon={<IconPackage size={20} />} onClick={() => setUseOpen(true)} className="self-start">Record part used</Button>
      )}
      {material.consumptions.length > 0 && (
        <Card title="Parts used">
          {material.consumptions.map((c) => {
            const issue = material.issues.find((i) => i.id === c.issue_id);
            return (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono font-semibold">{formatQty(c.quantity, issue?.uom)}</span>
                <span className="min-w-0 flex-1 truncate text-fg-2">{c.note ?? ''}</span>
                {c.consumption_status === 'POSTED'
                  ? <span className="text-st-success-fg">Posted {formatTime(c.posted_at)}</span>
                  : <span className="text-warn-fg">Not posted</span>}
              </div>
            );
          })}
          {pending.length > 0 && (
            <Button kind="secondary" size="desktop" busy={repost.busy} onClick={() => pending.forEach((p) => repost.run(p.id))} className="self-start">
              Retry posting
            </Button>
          )}
        </Card>
      )}

      {open && <PauseSheet jobId={job.id} sessionId={open.id} open={pauseOpen} onClose={() => setPauseOpen(false)} pause={api.pauseRepair} />}
      {can && <RecordUseSheet jobId={job.id} issues={held} sessionId={open?.id ?? null} open={useOpen} onClose={() => setUseOpen(false)} />}
    </>
  );
}

function RecordUseSheet({ jobId, issues, sessionId, open, onClose }: {
  jobId: string; issues: MaterialIssue[]; sessionId: string | null; open: boolean; onClose: () => void;
}) {
  const [issueId, setIssueId] = useState<string | null>(null);
  const issue = issues.find((i) => i.id === issueId) ?? issues[0] ?? null;
  const max = issue ? Math.floor(heldQty(issue)) : 1;
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const act = useJobAction(jobId, () => api.consumeMaterial(issue!.id, {
    quantity: qty,
    ...(sessionId ? { repair_session_id: sessionId } : {}),
    ...(note.trim() ? { note: note.trim() } : {}),
  }), () => { setQty(1); setNote(''); onClose(); });

  return (
    <BottomSheet open={open} onClose={onClose} title="Record part used">
      {issues.length > 1 && (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Part">
          {issues.map((i) => <IssueChoice key={i.id} issue={i} on={i.id === issue?.id} onPick={() => { setIssueId(i.id); setQty(1); }} />)}
        </div>
      )}
      {issue && (
        <div className="flex flex-col gap-3 rounded-[10px] border border-line p-4">
          <IssueName issue={issue} />
          <QtyStepper value={qty} onChange={setQty} uom={issue.uom} max={max} />
          <p className="text-sm text-fg-2">
            Of {formatQty(String(heldQty(issue)), issue.uom)} held · {formatQty(String(heldQty(issue) - qty), issue.uom)} will remain with you
          </p>
        </div>
      )}
      <TextArea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. C14, C15 replaced" />
      <FormError messages={act.errors} />
      <Button block busy={act.busy} disabled={!issue || qty < 1 || qty > max} icon={<IconCheck size={20} />} onClick={() => act.run(undefined)}>Record &amp; post</Button>
      <Button kind="ghost" block onClick={onClose}>Cancel</Button>
    </BottomSheet>
  );
}

function IssueName({ issue }: { issue: MaterialIssue }) {
  const item = useItem(issue.item_id);
  return <p className="text-base font-medium leading-6">{item.data?.standard_name ?? item.data?.item_code ?? '…'}</p>;
}
function IssueChoice({ issue, on, onPick }: { issue: MaterialIssue; on: boolean; onPick: () => void }) {
  const item = useItem(issue.item_id);
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick}
      className={cx('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left', on ? 'border-accent bg-brand-subtle' : 'border-line')}>
      <span className="min-w-0 flex-1 truncate text-base">{item.data?.standard_name ?? '…'}</span>
      <span className="font-mono text-[13px]">{formatQty(String(heldQty(issue)), issue.uom)}</span>
    </button>
  );
}
