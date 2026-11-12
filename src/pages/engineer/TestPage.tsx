// E9 · Test cycle · record result (Figma 177:104667) + E10 · Two failed cycles · Purchase review gate (177:104704).
// POST /jobs/{id}/test-runs { test_procedure } → POST /test-runs/{id}/result { result: PASS|FAIL, observations? }.
// Results are immutable. Gate flags (failed_cycles, purchase_review_required) and STOP reviews come from the server.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconCheck, IconFlask, IconLock, IconPlayerPlay, IconSend, IconX } from '@tabler/icons-react';
import { api } from '../../api/endpoints';
import type { JobDetail, TestRun } from '../../api/types';
import { useMe } from '../../auth/AuthProvider';
import { formatDateTime, formatTime } from '../../lib/format';
import { Button, Card, cx, EmptyState, ErrorState, FormError, InlineAlert, SkeletonCard, StatusBadge, TextArea } from '../../ui/primitives';
import { GatedAction } from '../../ui/mobile';
import { useRepairStatus } from './data';
import { JobFrame, useJobAction } from './JobFrame';
import { canWork } from './RepairMaterialPage';

export function TestPage() {
  const { jobId = '' } = useParams();
  return (
    <JobFrame jobId={jobId} title="Test" flow="br07" step="test">
      {(job) => <Testing job={job} />}
    </JobFrame>
  );
}

function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [enabled]);
  return now;
}
function timeLeft(dueIso: string, now: number) {
  const ms = new Date(dueIso).getTime() - now;
  if (ms <= 0) return 'overdue';
  const m = Math.floor(ms / 60_000);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m left`;
}

function Testing({ job }: { job: JobDetail }) {
  const me = useMe();
  const rs = useRepairStatus(job.id);
  const can = canWork(job, me.id);
  const tests = rs.data?.tests;
  const openSla = tests?.test_sla.instances.find((i) => i.state === 'OPEN' || i.state === 'PAUSED') ?? null;
  const now = useNow(!!openSla?.due_at);

  if (rs.isPending) return <><SkeletonCard /><SkeletonCard /></>;
  if (rs.error || !tests) return <ErrorState title="Couldn't load test cycles" onRetry={() => void rs.refetch()} />;

  const runs = [...tests.runs].sort((a, b) => a.cycle_no - b.cycle_no);
  const openRun = runs.find((r) => r.result == null) ?? null;
  const latest = runs[runs.length - 1] ?? null;
  const stopReview = tests.reviews.find((r) => r.decision === 'STOP');
  const reportSubmitted = rs.data.repair_report?.status === 'SUBMITTED';
  const sessionOpen = rs.data.repair_sessions.sessions.some((s) => s.status === 'ACTIVE' || s.status === 'PAUSED');
  const released = !!rs.data.dispatch_release;

  return (
    <>
      {openSla && (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge domain="slaState" value={openSla.state} />
          <span className="text-sm text-fg-2">
            {openSla.due_at ? `Test due by ${formatTime(openSla.due_at)} · ${timeLeft(openSla.due_at, now)}` : tests.test_sla.due_at_reason ?? 'No due time (no working calendar)'}
          </span>
        </div>
      )}

      {runs.length === 0 && !reportSubmitted && (
        <EmptyState icon={<IconFlask size={28} />} title="Submit the repair report first">
          Testing starts after the repair report is submitted.
          <div className="mt-3"><Link className="font-medium underline" to={`/jobs/${job.id}/repair/report`}>Open repair report</Link></div>
        </EmptyState>
      )}

      {runs.filter((r) => r.result != null).map((r) => <DoneCycle key={r.id} run={r} />)}
      {openRun && <OpenCycle job={job} run={openRun} canAct={can} />}

      {stopReview ? (
        <InlineAlert tone="blocked" title="Purchase decided to STOP testing">
          {stopReview.review_comment} · {formatDateTime(stopReview.reviewed_at)}
        </InlineAlert>
      ) : tests.purchase_review_required ? (
        <InlineAlert tone="blocked" title="Purchase review required">
          {tests.failed_cycles} cycles failed. Purchase decides whether testing continues or stops.
        </InlineAlert>
      ) : null}
      {tests.reviews.filter((r) => r.decision === 'CONTINUE').map((r) => (
        <InlineAlert key={r.id} tone="progress" title={`Purchase: continue testing (after ${r.failed_cycles_at_review} fails)`}>{r.review_comment}</InlineAlert>
      ))}

      {latest?.result === 'PASS' && !openRun && (
        <Link to={`/jobs/${job.id}/repair/handoff`}><Button block icon={<IconSend size={20} />}>Go to handoff</Button></Link>
      )}

      {can && !openRun && reportSubmitted && !stopReview && !released && latest?.result !== 'PASS' && (
        <StartCycle job={job} nextCycle={(latest?.cycle_no ?? 0) + 1}
          blocked={tests.purchase_review_required ? 'Waiting for Purchase review' : sessionOpen ? 'Stop the repair timer before testing' : null} />
      )}
      {can && !openRun && latest?.result === 'PASS' && !stopReview && !released && (
        <details className="text-sm text-fg-2">
          <summary className="cursor-pointer">Run another cycle</summary>
          <div className="mt-3"><StartCycle job={job} nextCycle={latest.cycle_no + 1} blocked={sessionOpen ? 'Stop the repair timer before testing' : null} /></div>
        </details>
      )}
    </>
  );
}

function DoneCycle({ run }: { run: TestRun }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-base font-medium">Cycle {run.cycle_no}</span>
        <IconLock size={16} className="text-fg-muted" aria-label="Locked" />
        <StatusBadge domain="testResult" value={run.result!} />
      </div>
      <p className="text-sm leading-5 text-fg-2">{run.observations || run.test_procedure}</p>
      <p className="text-xs text-fg-muted">{formatDateTime(run.completed_at)}</p>
    </Card>
  );
}

function OpenCycle({ job, run, canAct }: { job: JobDetail; run: TestRun; canAct: boolean }) {
  const [obs, setObs] = useState('');
  const record = useJobAction(job.id, (result: 'PASS' | 'FAIL') =>
    api.recordTestResult(run.id, { result, ...(obs.trim() ? { observations: obs.trim() } : {}) }));
  return (
    <section className="flex flex-col gap-3 rounded-[10px] border-2 border-accent bg-surface p-4">
      <h2 className="text-base font-medium">Cycle {run.cycle_no} · in progress</h2>
      <p className="text-sm leading-5 text-fg-2">Procedure: {run.test_procedure}</p>
      {canAct ? (
        <>
          <TextArea label="Observations" value={obs} onChange={(e) => setObs(e.target.value)} />
          <FormError messages={record.errors} />
          <div className="flex gap-3">
            <button type="button" disabled={record.busy} onClick={() => record.run('PASS')}
              className={cx('flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-success text-[17px] font-semibold text-white disabled:opacity-60')}>
              <IconCheck size={20} /> PASS
            </button>
            <button type="button" disabled={record.busy} onClick={() => record.run('FAIL')}
              className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-danger text-[17px] font-semibold text-white disabled:opacity-60">
              <IconX size={20} /> FAIL
            </button>
          </div>
          <p className="text-sm text-fg-2">Results can't be changed after you record them.</p>
        </>
      ) : <p className="text-sm text-fg-2">Started {formatDateTime(run.started_at)}</p>}
    </section>
  );
}

function StartCycle({ job, nextCycle, blocked }: { job: JobDetail; nextCycle: number; blocked: string | null }) {
  const [procedure, setProcedure] = useState('');
  const start = useJobAction(job.id, () => api.startTestRun(job.id, { test_procedure: procedure.trim() }), () => setProcedure(''));
  return (
    <div className="flex flex-col gap-3">
      {!blocked && (
        <TextArea label={`Cycle ${nextCycle} procedure`} value={procedure} onChange={(e) => setProcedure(e.target.value)}
          placeholder="e.g. Full-load run 30 min @ 100 %, check trip log" helper="Required" />
      )}
      <FormError messages={start.errors} />
      <GatedAction
        blockedReason={blocked ?? (!procedure.trim() ? 'Describe the test procedure' : null)}
        primaryLabel={`Start cycle ${nextCycle}`}
        primaryIcon={<IconPlayerPlay size={20} />}
        busy={start.busy}
        onPrimary={() => start.run(undefined)}
      />
    </div>
  );
}
