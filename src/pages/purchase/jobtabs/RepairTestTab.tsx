// Job workspace · Repair & test tab — Figma "D·P10 · Job · Repair & test · two-fail review" 177:104775 (Columns
// 177:104788) + "D·P10b · handoff received · dispatch release" 177:104879 (right panel only).
// Columns gap 16: Left (flex, gap 16) = "Material with engineer" (177:104790: head + "Issue reserved" secondary; table
// header bg-subtle radius 18 px-14 py-10 gap 12 — Item flex · Issued 80 → · Consumed 90 → · Returned 90 → · Status 120;
// rows px-14 py-12 border-b) + "Test cycles" (177:104831, flex-1: SLA badge; Cycle 70 → · Started 130 · Result 100 ·
// Observations flex). Right 420 (177:104862) = the decision panel for the current state:
//   two failed cycles (tests.purchase_review_required) → blocked alert, Repair active / Failed cycles (12/16 over Data/
//   Number strong), "Decision comment" (required), Stop testing (danger, x) + Continue testing (primary, refresh);
//   technical handoff received → D·P10b "Release for dispatch" (pending returns to verify, outstanding qty, note);
//   dispatch released → summary; otherwise a read-only progress summary.
//
// API: GET /jobs/{id}/repair-status (aggregate) + GET /jobs/{id}/reservations (PURCHASE, for "Issue reserved");
// writes POST /jobs/{id}/material-issues {br05_material_reservation_id} · /test-failure-reviews {decision, comment} ·
// /material-returns/{id}/verify {decision VERIFY|REJECT} · /jobs/{id}/dispatch-release {note} (all PURCHASE).
// Not built (sub-states): D·P10b left column (repair summary + history), J7 / J8 frames beyond these panels.
// Dispatch, challan and invoice are BR-08 (Figma: "not in scope").
import { useState, type ReactNode } from 'react';
import { IconCheck, IconRefresh, IconStack2, IconTool, IconTruckDelivery, IconX } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { useJobWorkspace } from '../job/JobWorkspace';
import { useEmployeesByIds, useItemBridgeByIds } from '../api';
import { Badge, StatusPill } from '../../../ui/desktop/Badge';
import { Button } from '../../../ui/desktop/Button';
import { EmptyState, ErrorState, StateCard, errorBody } from '../../../ui/desktop/States';
import { FormErrors, InlineAlert } from '../../../ui/desktop/Feedback';
import { useToast } from '../../../ui/desktop/Toast';
import { Ic, cx } from '../../../ui/desktop/Icon';
import { formatDayTime, formatDuration, formatQty, formatTime } from '../../../lib/format';
import { toneOf } from '../../../lib/tones';
import { CompactField, TabCard, TabSkeleton } from './ui';
import {
  useDispatchRelease, useIssueMaterial, useJobReservations, useRepairStatus, useReviewTestFailures, useVerifyReturn,
  type RepairStatus,
} from './data';

const h2 = 'min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg';
const sumSeconds = (rows: { active_seconds?: string | null }[]) => rows.reduce((s, r) => s + (Number(r.active_seconds) || 0), 0);

function H({ w, children, right }: { w?: number; children: ReactNode; right?: boolean }) {
  return (
    <div className={cx('flex items-center overflow-clip', w ? 'shrink-0' : 'min-w-px flex-1', right && 'justify-end')} style={w ? { width: w } : undefined}>
      <span className="whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{children}</span>
    </div>
  );
}
function N({ w, children }: { w: number; children: ReactNode }) {
  return <div className="flex shrink-0 items-center justify-end overflow-clip" style={{ width: w }}><span className="whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg">{children}</span></div>;
}

export function RepairTestTab() {
  const { job } = useJobWorkspace();
  const me = useMe();
  const isPurchase = can.purchaseWork(me.role);
  const q = useRepairStatus(job.id);
  if (q.isPending) return <TabSkeleton right={420} />;
  if (q.isError || !q.data) return <StateCard><ErrorState title="Couldn't load repair & test" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} /></StateCard>;
  const s = q.data;
  const nothingYet = s.material.issues.length === 0 && s.repair_sessions.sessions.length === 0 && s.tests.runs.length === 0;
  return (
    <div className="flex min-h-[738px] w-full flex-1 items-stretch gap-[16px]">
      <div className="flex min-w-px flex-1 flex-col gap-[16px]">
        <MaterialCard s={s} isPurchase={isPurchase} />
        <TestsCard s={s} />
      </div>
      <TabCard className="w-[420px] shrink-0">
        {nothingYet && !isPurchase ? <EmptyState icon={IconTool} title="Repair hasn't started" body="Material, repair time and test cycles appear here once the engineer starts." /> : <DecisionPanel s={s} isPurchase={isPurchase} />}
      </TabCard>
    </div>
  );
}

function MaterialCard({ s, isPurchase }: { s: RepairStatus; isPurchase: boolean }) {
  const { job } = useJobWorkspace();
  const toast = useToast();
  const resQ = useJobReservations(job.id, isPurchase);
  const issue = useIssueMaterial(job.id);
  const itemsQ = useItemBridgeByIds(s.material.issues.map((i) => i.item_bridge_id));
  const issuedRes = new Set(s.material.issues.map((i) => i.br05_material_reservation_id));
  const toIssue = (resQ.data ?? []).filter((r) => r.reservation_status === 'COMMITTED' && !issuedRes.has(r.id));
  const issueAll = async () => {
    for (const r of toIssue) await issue.mutateAsync(r.id);
    toast({ tone: 'success', title: 'Material issued', body: `${toIssue.length} reserved ${toIssue.length === 1 ? 'line' : 'lines'} issued to the engineer.` });
  };
  return (
    <TabCard className="shrink-0">
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className={h2}>Material with engineer</h2>
        {isPurchase && toIssue.length > 0 && (
          <Button kind="secondary" icon={<Ic icon={IconStack2} size={18} />} busy={issue.isPending} onClick={() => { void issueAll().catch(() => undefined); }}>
            Issue reserved{toIssue.length > 1 ? ` · ${toIssue.length}` : ''}
          </Button>
        )}
      </div>
      <FormErrors error={issue.error} title="Material wasn't issued" />
      {s.material.issues.length === 0 ? (
        <p className="text-[14px] leading-[20px] text-fg-2">{toIssue.length ? 'Reserved stock is ready to issue to the engineer.' : 'Nothing issued yet — material is issued from committed reservations.'}</p>
      ) : (
        <div role="table" className="flex w-full flex-col gap-[14px]">
          <div role="row" className="flex w-full items-start gap-[12px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
            <H>Item</H><H w={80} right>Issued</H><H w={90} right>Consumed</H><H w={90} right>Returned</H><H w={120}>Status</H>
          </div>
          <div className="flex w-full flex-col gap-[14px]">
            {s.material.issues.map((i) => {
              const it = itemsQ.data?.[i.item_bridge_id];
              return (
                <div key={i.id} role="row" className="flex w-full items-center gap-[12px] overflow-clip border-b border-line px-[14px] py-[12px]">
                  <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
                    <span className="font-mono text-[13px] font-medium leading-[18px] text-fg-2">{it?.item_code ?? '…'}</span>
                    <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{it?.item_name ?? 'Loading item…'}</span>
                  </div>
                  <N w={80}>{formatQty(i.issued_quantity, i.uom)}</N>
                  <N w={90}>{Number(i.consumed_quantity) ? formatQty(i.consumed_quantity, i.uom) : '0'}</N>
                  <N w={90}>{Number(i.returned_quantity) ? formatQty(i.returned_quantity, i.uom) : '0'}</N>
                  <div className="flex w-[120px] shrink-0 items-center overflow-clip"><StatusPill domain="issue" value={i.issue_status} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </TabCard>
  );
}

function TestsCard({ s }: { s: RepairStatus }) {
  const t = s.tests;
  const open = t.test_sla.instances.find((x) => x.state === 'OPEN' || x.state === 'PAUSED') ?? t.test_sla.instances[0];
  return (
    <TabCard className="min-h-px flex-1">
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className={h2}>Test cycles</h2>
        {open && <Badge tone={toneOf('slaState', open.state)} label={`SLA ${open.state}${open.due_at && open.state !== 'MET' ? ` · DUE ${formatTime(open.due_at)}` : ''}`} />}
      </div>
      {t.runs.length === 0 ? (
        <p className="text-[14px] leading-[20px] text-fg-2">{s.repair_report ? 'Repair report submitted — the engineer starts test cycle 1 from the app.' : 'Testing starts after the engineer submits the repair report.'}</p>
      ) : (
        <div role="table" className="flex w-full flex-col gap-[14px]">
          <div role="row" className="flex w-full items-start gap-[12px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
            <H w={70} right>Cycle</H><H w={130}>Started</H><H w={100}>Result</H><H>Observations</H>
          </div>
          <div className="flex w-full flex-col gap-[14px]">
            {[...t.runs].sort((a, b) => a.cycle_no - b.cycle_no).map((r) => (
              <div key={r.id} role="row" className="flex w-full items-center gap-[12px] overflow-clip border-b border-line px-[14px] py-[12px]">
                <N w={70}>{r.cycle_no}</N>
                <div className="flex w-[130px] shrink-0 items-center overflow-clip"><span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{formatDayTime(r.started_at)}</span></div>
                <div className="flex w-[100px] shrink-0 items-center overflow-clip">{r.result ? <StatusPill domain="testResult" value={r.result} /> : <Badge tone="progress" label="RUNNING" />}</div>
                <div className="flex min-w-px flex-1 items-center overflow-clip"><span className="truncate text-[14px] leading-[20px] text-fg-2" title={r.observations ?? undefined}>{r.observations || r.test_procedure}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {t.reviews.map((rv) => (
        <InlineAlert key={rv.id} tone={rv.decision === 'CONTINUE' ? 'progress' : 'blocked'} title={`Purchase decided ${rv.decision === 'CONTINUE' ? 'to continue' : 'to stop'} after ${rv.failed_cycles_at_review} failed cycles · ${formatDayTime(rv.reviewed_at)}`}>
          {rv.review_comment}
        </InlineAlert>
      ))}
    </TabCard>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
      <span className="text-[12px] leading-[16px] text-fg-2">{label}</span>
      <span className="font-mono text-[14px] font-semibold leading-[20px] text-fg">{children}</span>
    </div>
  );
}

function DecisionPanel({ s, isPurchase }: { s: RepairStatus; isPurchase: boolean }) {
  const { job } = useJobWorkspace();
  const toast = useToast();
  const review = useReviewTestFailures(job.id);
  const release = useDispatchRelease(job.id);
  const verify = useVerifyReturn(job.id);
  const [comment, setComment] = useState('');
  const [tried, setTried] = useState(false);
  const handoff = s.handoffs[0];
  const pendingReturns = s.material.returns.filter((r) => r.return_status === 'REQUESTED');
  const empQ = useEmployeesByIds(pendingReturns.map((r) => r.requested_by_id));
  const itemsQ = useItemBridgeByIds(s.material.issues.map((i) => i.item_bridge_id));
  const repairActive = formatDuration(sumSeconds(s.repair_sessions.time_totals));
  const stats = (
    <div className="flex items-start gap-[28px] overflow-clip">
      <Stat label="Repair active">{repairActive}</Stat>
      <Stat label="Failed cycles">{s.tests.failed_cycles}</Stat>
      <Stat label="Cycles">{s.tests.runs.length}</Stat>
    </div>
  );

  if (s.dispatch_release) {
    return (
      <>
        <div className="flex w-full items-center overflow-clip"><h2 className={h2}>Released for dispatch</h2></div>
        <InlineAlert tone="success" title={`Released ${formatDayTime(s.dispatch_release.released_at)}`}>{s.dispatch_release.release_note || 'Dispatch, challan and invoice follow in BR-08.'}</InlineAlert>
        {stats}
      </>
    );
  }

  if (s.tests.purchase_review_required) {
    const decide = (decision: 'CONTINUE' | 'STOP') => {
      setTried(true);
      if (!comment.trim()) return;
      review.mutate({ decision, comment: comment.trim() }, {
        onSuccess: () => { setComment(''); setTried(false); toast(decision === 'CONTINUE' ? { tone: 'progress', title: 'Testing can continue', body: 'The engineer can start the next cycle.' } : { tone: 'blocked', title: 'Testing stopped', body: 'Repair ends for this unit.' }); },
      });
    };
    return (
      <>
        <div className="flex w-full items-center overflow-clip"><h2 className={h2}>{s.tests.failed_cycles === 2 ? 'Two cycles failed' : `${s.tests.failed_cycles} cycles failed`}</h2></div>
        <InlineAlert tone="blocked" title="Engineer is blocked">Cycle {s.tests.runs.length + 1} can&apos;t start until you decide. Continue lets testing go on; Stop ends repair for this unit.</InlineAlert>
        {stats}
        {isPurchase ? (
          <>
            <CompactField label="Decision comment" helper="Required — shown to the engineer" value={comment} onChange={(e) => setComment(e.target.value)} error={tried && !comment.trim() ? 'Tell the engineer what to do next.' : null} disabled={review.isPending} />
            <div className="min-h-px w-px flex-1" />
            <FormErrors error={review.error} title="The decision wasn't saved" />
            <div className="flex w-full items-start gap-[10px] [&>*]:min-w-px [&>*]:flex-1">
              <Button kind="danger" icon={<Ic icon={IconX} size={18} />} disabled={review.isPending} onClick={() => decide('STOP')}>Stop testing</Button>
              <Button kind="primary" icon={<Ic icon={IconRefresh} size={18} />} disabled={review.isPending} busy={review.isPending && review.variables?.decision === 'CONTINUE'} onClick={() => decide('CONTINUE')}>Continue testing</Button>
            </div>
          </>
        ) : <p className="text-[14px] leading-[20px] text-fg-2">Waiting for Purchase to decide.</p>}
      </>
    );
  }

  if (handoff) {
    return (
      <>
        <div className="flex w-full items-center overflow-clip"><h2 className={h2}>Release for dispatch</h2></div>
        <p className="text-[14px] leading-[20px] text-fg-2">Handed off {formatDayTime(handoff.handed_off_at)}{handoff.handoff_note ? ` · ${handoff.handoff_note}` : ''}</p>
        {pendingReturns.map((r) => {
          const iss = s.material.issues.find((i) => i.id === r.issue_id);
          const it = iss ? itemsQ.data?.[iss.item_bridge_id] : undefined;
          return (
            <div key={r.id} className="flex w-full items-center gap-[12px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px]">
              <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
                <span className="truncate text-[14px] font-medium leading-[20px] text-fg">Return · {it?.item_name ?? 'Item'} · {formatQty(r.quantity, iss?.uom)}</span>
                <span className="truncate text-[12px] leading-[16px] text-fg-2">Requested by {empQ.data?.[r.requested_by_id]?.full_name ?? 'the engineer'}{r.return_reason ? ` · ${r.return_reason}` : ''}</span>
              </div>
              {isPurchase && (
                <>
                  <Button kind="ghost" icon={<Ic icon={IconX} size={18} />} disabled={verify.isPending} onClick={() => verify.mutate({ id: r.id, body: { decision: 'REJECT' } })}>Reject</Button>
                  <Button kind="secondary" icon={<Ic icon={IconCheck} size={18} />} busy={verify.isPending && verify.variables?.id === r.id && verify.variables.body.decision === 'VERIFY'} disabled={verify.isPending} onClick={() => verify.mutate({ id: r.id, body: { decision: 'VERIFY' } })}>Verify</Button>
                </>
              )}
            </div>
          );
        })}
        <p className="text-[12px] leading-[16px] text-fg-2">Outstanding with engineer{pendingReturns.length ? ' after return' : ''}: <span className="font-mono">{formatQty(handoff.outstanding_engineer_held_qty)}</span></p>
        <FormErrors error={verify.error} title="The return wasn't verified" />
        {isPurchase ? (
          <>
            <CompactField label="Release note" helper="Optional" value={comment} onChange={(e) => setComment(e.target.value)} disabled={release.isPending} />
            <div className="min-h-px w-px flex-1" />
            <FormErrors error={release.error} title="The job wasn't released for dispatch" />
            <Button kind="primary" block icon={<Ic icon={IconTruckDelivery} size={18} />} busy={release.isPending} onClick={() => release.mutate(comment.trim(), { onSuccess: () => { setComment(''); toast({ tone: 'success', title: 'Released for dispatch', body: job.job_number }); } })}>Release for dispatch</Button>
            <p className="text-[12px] leading-[16px] text-fg-2">Dispatch &amp; invoice are BR-08.</p>
          </>
        ) : <p className="text-[14px] leading-[20px] text-fg-2">Waiting for Purchase to release the job for dispatch.</p>}
      </>
    );
  }

  const last = [...s.tests.runs].sort((a, b) => b.cycle_no - a.cycle_no)[0];
  return (
    <>
      <div className="flex w-full items-center overflow-clip"><h2 className={h2}>Repair in progress</h2></div>
      {stats}
      <p className="text-[14px] leading-[20px] text-fg-2">
        {!s.repair_report ? 'The engineer is repairing the unit and records the repair report from the app.'
          : !last ? 'Repair report in. Waiting for test cycle 1.'
            : last.result === 'PASS' ? 'Last cycle passed. The engineer hands the unit off for dispatch release.'
              : !last.result ? `Cycle ${last.cycle_no} is running.` : `Cycle ${last.cycle_no} failed — the engineer retests.`}
      </p>
    </>
  );
}
