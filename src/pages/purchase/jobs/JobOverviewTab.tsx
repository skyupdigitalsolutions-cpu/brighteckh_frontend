// Figma "J1 · Job · Overview" 177:116069 — tab content only (header 177:116071 + tab bar 177:116073 are JobWorkspace).
// Stage 177:116082: glass-strong card, radius 24, p-24, gap 14; head 18/24 SemiBold + job status + route badges;
//   10-step stepper (28px dots radius 14; done = success fill + 14px white check; current = accent fill + 12/16
//   number on-accent + 14/20 Medium label; pending = bg-subtle + muted 12/16 number + muted 12/16 label; 2px lines,
//   success after a done step, default otherwise). `blocked` (API state, not drawn) = blocked-tone dot + label.
// Columns 177:116137 (gap 20): Left flex (Unit 177:116139, History 177:116166) · Right 420 (Next step 177:116175,
//   Assignment 177:116180, Time 177:116191). Cards: glass-strong, radius 24, p-24, gap 16, heading 18/24 SemiBold.
//   Key/value: 12/16 secondary label, gap 3, value 14/20 Medium (or Data/ID 13/18 mono); grid gap 40.
//   Timeline item 7:440: 12px tone dot with 3px tone-bg ring, 2px default connector, body pb-20, 14/20 Medium title,
//   12/16 secondary meta "Actor · 04 Nov, 10:42".
//   Next step: literal brand gradient, 11/14 SemiBold "NEXT STEP", 18/24 title, 14/20 secondary detail, primary button.
//
// Sources: job + current assignment = GET /jobs/{id}; receipt/unit + customer/assembly/engineer names =
// useJobWorkspace (lookups); stepper + assignment history = GET /jobs/{id}/progress (10 derived stages, every
// assignment with engineer + assigned-by names); report = GET /jobs/{id}/inspection-report; time =
// GET /jobs/{id}/inspection-sessions; other actor names (verifier, reviewers) = GET /lookups/employees?ids=.
// Stepper labels are the API's stage labels (Figma draws Repair / Test / Dispatch; the API has PO & GRN /
// Repair & test / Dispatch & invoice). A stage's status, `at`, `detail` and `rule` are its native tooltip.
//
// MANAGEMENT (MJ1 · Job (view) 177:140458, /mg/jobs/:jobId/overview): same cards, read-only — no Assign / Review report /
// View inward receipt actions, the gradient card is "CURRENT STEP" (as drawn in MJ1), and the employees lookup
// (PURCHASE-only) is not called: actors named by GET /jobs/{id}/progress still show, others (verifier, report reviewers)
// show the time only — GapNote G-MJ-2.
import { useState, type ReactNode } from 'react';
import { IconCheck, IconClipboardList, IconInbox, IconUser } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { useJobWorkspace } from '../job/JobWorkspace';
import { useEmployeesByIds, useJobProgress, type Job, type JobAssignmentHistoryRow, type JobProgressStage } from '../api';
import { StatusPill } from '../../../ui/desktop/Badge';
import { Button, ButtonLink } from '../../../ui/desktop/Button';
import { ErrorState, errorBody } from '../../../ui/desktop/States';
import { GapNote } from '../../../ui/desktop/Feedback';
import { Avatar } from '../../../ui/desktop/Avatar';
import { Ic, cx } from '../../../ui/desktop/Icon';
import { displayVersion, enumLabel, formatDayTime, formatDuration } from '../../../lib/format';
import {
  formatWaiting, isOpen, useJobInspectionReport, useJobInspectionSessions, type InspectionReport, type InspectionSessions,
} from './jobsData';
import { ReassignDrawer } from './ReassignDrawer';

type StepState = JobProgressStage['status'];

const card = 'glass-strong flex w-full flex-col items-start gap-[16px] overflow-clip rounded-[24px] p-[24px]';
const h2 = 'min-w-0 flex-1 text-[18px] font-semibold leading-[24px] text-fg';

export function JobOverviewTab() {
  const ws = useJobWorkspace();
  const { job, receipt, unit, engineerName } = ws;
  const me = useMe();
  const reportQ = useJobInspectionReport(job.id);
  const sessionsQ = useJobInspectionSessions(job.id);
  const progressQ = useJobProgress(job.id);
  const [drawer, setDrawer] = useState(false);

  const report = reportQ.data ?? null;
  const a = job.current_assignment;
  const purchase = can.purchaseWork(me.role);
  const canAssign = purchase && isOpen(job.status);
  const stages = progressQ.data?.stages;
  // A pending stage before a done one = no record for it (e.g. no supplier PO because stock covered it).
  const lastDone = stages ? stages.map((x) => x.status).lastIndexOf('done') : -1;
  const gapStages = stages ? stages.filter((x, i) => i < lastDone && x.status === 'pending') : [];

  return (
    <>
      {/* Stage 177:116082 */}
      <section className="glass-strong flex w-full flex-col items-start gap-[14px] overflow-clip rounded-[24px] p-[24px]">
        <div className="flex w-full items-center gap-[10px] overflow-clip">
          <h2 className={h2}>Where this job is</h2>
          <StatusPill domain="job" value={job.status} />
          <StatusPill domain="route" value={job.route} />
        </div>
        {progressQ.isError && !stages ? (
          <div className="flex w-full justify-center py-[4px]">
            <ErrorState title="Couldn't load the job's progress" body={errorBody(progressQ.error)} onRetry={() => progressQ.refetch()} retrying={progressQ.isFetching} />
          </div>
        ) : (
          <Stepper stages={stages} />
        )}
        {gapStages.length > 0 && (
          <GapNote code="G-C1-1">
            {gapStages.map((x) => x.label).join(', ')} {gapStages.length === 1 ? 'shows' : 'show'} pending although a later
            stage is done: job progress has no &ldquo;skipped&rdquo; stage state, so a stage with no record (e.g. no supplier
            PO because stock covered the material) can&apos;t be told apart from one not reached yet.
          </GapNote>
        )}
      </section>

      {/* Columns 177:116137 */}
      <div className="flex min-h-px w-full flex-1 items-stretch gap-[20px]">
        <div className="flex min-w-px flex-1 flex-col items-start gap-[20px]">
          <UnitCard ws={ws} purchase={purchase} />
          <HistoryCard
            job={job}
            verifiedById={unit?.verified_by_id ?? null}
            engineerName={engineerName}
            report={report}
            reportQ={reportQ}
            sessionsQ={sessionsQ}
            assignments={progressQ.data?.assignments}
            stages={stages}
            loading={reportQ.isPending || sessionsQ.isPending || progressQ.isPending || !receipt}
            purchase={purchase}
          />
        </div>
        <div className="flex w-[420px] shrink-0 flex-col items-start gap-[20px]">
          <NextStepCard job={job} report={report} loading={reportQ.isPending} canAssign={canAssign} purchase={purchase} onAssign={() => setDrawer(true)} />
          <AssignmentCard job={job} engineerName={engineerName} canAssign={canAssign} onAssign={() => setDrawer(true)} />
          <TimeCard sessionsQ={sessionsQ} />
        </div>
      </div>

      {canAssign && (
        <ReassignDrawer
          open={drawer}
          onClose={() => setDrawer(false)}
          jobId={job.id}
          jobNumber={job.job_number}
          current={a}
          currentName={engineerName}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ stepper
function stepTitle(st: JobProgressStage) {
  return [`${st.label}: ${st.status}`, st.at && formatDayTime(st.at), st.detail, st.rule].filter(Boolean).join('\n');
}

function Stepper({ stages }: { stages: JobProgressStage[] | undefined }) {
  if (!stages) {
    return (
      <div className="flex w-full items-center overflow-clip" role="status" aria-busy aria-label="Loading progress">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="contents">
            {i > 0 && <div className="h-[2px] min-w-px flex-1 bg-line" aria-hidden />}
            <div className="flex shrink-0 flex-col items-center gap-[8px] overflow-clip">
              <div className="h-[28px] w-[28px] shrink-0 animate-pulse rounded-[14px] bg-subtle" />
              <span className="my-[2px] block h-[12px] w-[48px] animate-pulse rounded-[6px] bg-disabled" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <ol className="flex w-full items-center overflow-clip">
      {stages.map((st, i) => {
        const s: StepState = st.status;
        const active = s === 'current' || s === 'blocked';
        return (
          <li key={st.key} className="contents">
            {i > 0 && <div className={cx('h-[2px] min-w-px flex-1', stages[i - 1]!.status === 'done' ? 'bg-success' : 'bg-line')} aria-hidden />}
            <div className="flex shrink-0 flex-col items-center gap-[8px] overflow-clip" aria-current={active ? 'step' : undefined} title={stepTitle(st)}>
              <div className={cx(
                'flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-clip rounded-[14px]',
                s === 'done' ? 'bg-success text-fg-on-accent' : s === 'current' ? 'bg-accent' : s === 'blocked' ? 'bg-st-blocked-fg' : 'bg-subtle',
              )}>
                {s === 'done'
                  ? <Ic icon={IconCheck} size={14} />
                  : <span className={cx('whitespace-nowrap text-[12px] leading-[16px]', active ? 'text-fg-on-accent' : 'text-fg-muted')}>{i + 1}</span>}
              </div>
              <span className={cx(
                'whitespace-nowrap',
                s === 'current' ? 'text-[14px] font-medium leading-[20px] text-fg'
                  : s === 'blocked' ? 'text-[14px] font-medium leading-[20px] text-st-blocked-fg'
                    : s === 'done' ? 'text-[12px] leading-[16px] text-fg' : 'text-[12px] leading-[16px] text-fg-muted',
              )}>
                {st.label}{s === 'blocked' && <span className="sr-only"> (blocked)</span>}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------ cards
function KV({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-[3px] overflow-clip whitespace-nowrap">
      <p className="text-[12px] leading-[16px] text-fg-2">{label}</p>
      <div className={mono ? 'font-mono text-[13px] font-medium leading-[18px] text-fg' : 'text-[14px] font-medium leading-[20px] text-fg'}>{children}</div>
    </div>
  );
}
const Skel = ({ w }: { w: number }) => <span className="my-[4px] block h-[12px] animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />;

type WS = ReturnType<typeof useJobWorkspace>;

function UnitCard({ ws, purchase }: { ws: WS; purchase: boolean }) {
  const { job, receipt, unit, unitsInGroup, customer, customerLoading } = ws;
  const loading = !receipt;
  const v = (x: string | null | undefined) => (loading ? <Skel w={110} /> : x?.trim() || '—');
  return (
    <section className={card}>
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className={h2}>Unit as received</h2>
        {purchase && <ButtonLink to={`/p/inward/${job.inward_id}`} kind="secondary" icon={<Ic icon={IconInbox} size={18} />}>View inward receipt</ButtonLink>}
      </div>
      <div className="flex w-full items-start gap-[40px] overflow-clip">
        <KV label="Customer">{loading || customerLoading ? <Skel w={140} /> : customer?.customer_name ?? '—'}</KV>
        <KV label="Inward" mono>{loading ? <Skel w={150} /> : unit ? `${receipt.jin_number} · unit ${unit.unit_number} of ${unitsInGroup}` : receipt.jin_number}</KV>
        <KV label="Serial no." mono>{v(unit?.serial_number)}</KV>
        <KV label="Make / model">{loading ? <Skel w={110} /> : [unit?.observed_make, unit?.observed_model].filter(Boolean).join(' · ') || '—'}</KV>
      </div>
      <div className="flex w-full items-start gap-[40px] overflow-clip">
        <KV label="Reported fault">{v(unit?.reported_fault)}</KV>
        <KV label="Condition">{v(unit?.physical_condition)}</KV>
        <KV label="Accessories">{v(unit?.accessories)}</KV>
      </div>
    </section>
  );
}

type Tone = 'neutral' | 'progress' | 'success';
type Event = { at: string; title: string; actor?: string | null; detail?: string | null; tone: Tone };
const DOT: Record<Tone, string> = {
  neutral: 'bg-st-neutral-fg shadow-[0_0_0_3px_var(--color-status-neutral-bg)]',
  progress: 'bg-st-progress-fg shadow-[0_0_0_3px_var(--color-status-progress-bg)]',
  success: 'bg-st-success-fg shadow-[0_0_0_3px_var(--color-status-success-bg)]',
};

/** Stages the history adds from GET /jobs/{id}/progress (the earlier ones come from their own records). */
const LATER_STAGES = new Set<JobProgressStage['key']>(['MATERIAL', 'QUOTE', 'AUTHORISATION', 'PO_GRN', 'REPAIR_TEST', 'DISPATCH_INVOICE']);

type AssignmentEvt = Pick<JobAssignmentHistoryRow,
  'engineer_id' | 'assigned_by_id' | 'assigned_at' | 'response' | 'responded_at' | 'response_reason' | 'reassignment_reason'>;

function HistoryCard({ job, verifiedById, engineerName, report, reportQ, sessionsQ, assignments, stages, loading, purchase }: {
  job: Job;
  verifiedById: string | null;
  engineerName: string | null;
  report: InspectionReport | null;
  reportQ: ReturnType<typeof useJobInspectionReport>;
  sessionsQ: ReturnType<typeof useJobInspectionSessions>;
  /** Every assignment, oldest first (progress); undefined while loading or if progress failed. */
  assignments: JobAssignmentHistoryRow[] | undefined;
  stages: JobProgressStage[] | undefined;
  loading: boolean;
  /** false = Management: GET /lookups/employees is PURCHASE-only, so it is not called. */
  purchase: boolean;
}) {
  const sessions: InspectionSessions['sessions'] = sessionsQ.data?.sessions ?? [];
  // Names: engineers + assigners from progress; anyone else (verifier, reviewers, an engineer not in that history)
  // from the employees lookup.
  const names: Record<string, string> = {};
  for (const x of assignments ?? []) { names[x.engineer_id] = x.engineer_name; names[x.assigned_by_id] = x.assigned_by_name; }
  if (job.current_assignment && engineerName) names[job.current_assignment.engineer_id] ??= engineerName;
  const wanted = [
    verifiedById,
    ...(report?.reviews.map((r) => r.reviewer_id) ?? []),
    ...(report?.versions.map((v) => v.engineer_id) ?? []),
    ...sessions.map((x) => x.engineer_id),
    ...(assignments ? [] : job.current_assignment ? [job.current_assignment.assigned_by_id] : []),
  ].filter((x): x is string => !!x && !names[x]);
  const empQ = useEmployeesByIds(purchase ? wanted : []);
  const nameOf = (id: string | null | undefined) => (id ? names[id] ?? empQ.data?.[id]?.full_name ?? null : null);

  const ev: Event[] = [{ at: job.created_at, title: 'Unit verified · job created', actor: nameOf(verifiedById), tone: 'success' }];
  const rows: AssignmentEvt[] = assignments ?? (job.current_assignment ? [job.current_assignment] : []);
  for (const x of rows) {
    const eng = nameOf(x.engineer_id);
    ev.push({
      at: x.assigned_at,
      title: `${x.reassignment_reason ? 'Reassigned' : 'Assigned'} to ${eng ?? 'an engineer'}`,
      actor: nameOf(x.assigned_by_id),
      detail: x.reassignment_reason,
      tone: 'neutral',
    });
    if (x.responded_at && x.response === 'ACCEPTED') ev.push({ at: x.responded_at, title: 'Custody acknowledged', actor: eng, tone: 'success' });
    if (x.responded_at && x.response === 'DECLINED') ev.push({ at: x.responded_at, title: 'Custody declined', actor: eng, detail: x.response_reason, tone: 'neutral' });
  }
  const firstSession = sessions[0];
  if (firstSession) ev.push({ at: firstSession.started_at, title: 'Inspection started', actor: nameOf(firstSession.engineer_id), tone: 'neutral' });
  if (report) {
    for (const v of report.versions) {
      if (v.submitted_at) {
        ev.push({
          at: v.submitted_at, title: `Inspection report v${displayVersion(v.version_no)} submitted`, actor: nameOf(v.engineer_id),
          detail: v.outcome ? `Outcome ${enumLabel(v.outcome)}` : null, tone: 'progress',
        });
      }
    }
    for (const r of report.reviews) {
      const vno = report.versions.find((v) => v.id === r.version_id)?.version_no;
      ev.push({
        at: r.reviewed_at,
        title: `Inspection report${vno != null ? ` v${displayVersion(vno)}` : ''} ${r.review_decision === 'ACCEPT' ? 'accepted' : 'returned'}`,
        actor: nameOf(r.reviewer_id),
        detail: r.review_comment,
        tone: r.review_decision === 'ACCEPT' ? 'success' : 'neutral',
      });
    }
  }
  for (const st of stages ?? []) {
    if (LATER_STAGES.has(st.key) && st.status === 'done' && st.at) ev.push({ at: st.at, title: `${st.label} done`, detail: st.detail, tone: 'success' });
  }
  if (job.closed_at) ev.push({ at: job.closed_at, title: 'Job closed', tone: 'success' });
  if (job.cancelled_at) ev.push({ at: job.cancelled_at, title: 'Job cancelled', detail: job.cancel_reason, tone: 'neutral' });
  ev.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());

  const failed = reportQ.isError ? reportQ : sessionsQ.isError ? sessionsQ : null;
  return (
    <section className={cx(card, 'min-h-px flex-1')}>
      <div className="flex w-full items-center overflow-clip"><h2 className={h2}>History</h2></div>
      {failed ? (
        <div className="flex w-full justify-center py-[12px]">
          <ErrorState title="Couldn't load the inspection history" body={errorBody(failed.error)} onRetry={() => failed.refetch()} retrying={failed.isFetching} />
        </div>
      ) : (
        // Items are separate children of the card (gap 16, 177:116169…). Rail = 12 wide with clip content, so the
        // dot's 3px ring only shows below the dot — the dot sits flush with the title's top, as drawn.
        <ol className="flex w-full flex-col gap-[16px]">
          {ev.map((e, i) => (
            <li key={`${e.at}-${e.title}`} className="flex w-full items-start gap-[12px]">
              <div className="flex w-[12px] shrink-0 flex-col items-center gap-[4px] self-stretch overflow-clip">
                <span className={cx('block h-[12px] w-[12px] shrink-0 rounded-full', DOT[e.tone])} aria-hidden />
                {i < ev.length - 1 && <span className="min-h-px w-[2px] flex-1 bg-line" aria-hidden />}
              </div>
              <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip pb-[20px]">
                <p className="text-[14px] font-medium leading-[20px] text-fg">{e.title}</p>
                <p className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{[e.actor, formatDayTime(e.at)].filter(Boolean).join(' · ')}</p>
                {e.detail && <p className="text-[14px] leading-[20px] text-fg-2">{e.detail}</p>}
              </div>
            </li>
          ))}
          {loading && <li className="flex w-full flex-col gap-[8px] pl-[24px]"><Skel w={220} /><Skel w={120} /></li>}
        </ol>
      )}
      {!purchase && wanted.length > 0 && (
        <GapNote code="G-MJ-2">Some entries show no name: the employee lookup that names the verifier and report reviewers is Purchase-only.</GapNote>
      )}
    </section>
  );
}

function NextStepCard({ job, report, loading, canAssign, purchase, onAssign }: {
  job: Job; report: InspectionReport | null; loading: boolean; canAssign: boolean; purchase: boolean; onAssign: () => void;
}) {
  const a = job.current_assignment;
  const latest = report?.versions[report.versions.length - 1];
  let title: string; let detail: ReactNode = null; let action: ReactNode = null;
  if (job.status === 'CLOSED') { title = 'Job closed'; detail = formatDayTime(job.closed_at); }
  else if (job.status === 'CANCELLED') { title = 'Job cancelled'; detail = job.cancel_reason ?? formatDayTime(job.cancelled_at); }
  else if (!a || a.response === 'DECLINED') {
    title = a ? 'Engineer declined — reassign' : 'Assign an engineer';
    detail = a ? (a.response_reason ?? `Declined ${formatDayTime(a.responded_at)}`) : `Job created ${formatDayTime(job.created_at)} · no engineer yet`;
    if (canAssign) action = <Button kind="primary" block icon={<Ic icon={IconUser} size={18} />} onClick={onAssign}>{a ? 'Reassign engineer' : 'Assign engineer'}</Button>;
  } else if (a.response === 'PENDING') {
    title = 'Waiting for custody acknowledgement';
    detail = `Assigned ${formatDayTime(a.assigned_at)} · the engineer must acknowledge custody`;
  } else if (loading) {
    title = 'Checking the inspection report…';
  } else if (!report || !latest) {
    title = 'Waiting for the inspection report';
    detail = a.responded_at ? `Custody since ${formatDayTime(a.responded_at)}` : null;
  } else if (report.status === 'SUBMITTED') {
    title = `Review inspection report v${displayVersion(latest.version_no)}`;
    const wait = formatWaiting(latest.submitted_at);
    detail = [latest.outcome && `Outcome ${enumLabel(latest.outcome)}`, wait && `waiting ${wait}`].filter(Boolean).join(' · ');
    if (purchase) action = <ButtonLink to={`/p/jobs/${job.id}/inspection`} kind="primary" className="w-full" icon={<Ic icon={IconClipboardList} size={18} />}>Review report</ButtonLink>;
  } else if (report.status === 'ACCEPTED') {
    title = `Inspection report v${displayVersion(latest.version_no)} accepted`;
    detail = report.latest_outcome ? `Outcome ${enumLabel(report.latest_outcome)}` : null;
  } else {
    title = 'Waiting for a revised inspection report';
    detail = `Report ${enumLabel(report.status)}`;
  }
  return (
    <section
      className="flex w-full shrink-0 flex-col items-start gap-[16px] overflow-clip rounded-[24px] border border-glass-border p-[24px] backdrop-blur-[12px]"
      style={{ backgroundImage: 'linear-gradient(155.43282867939868deg, rgba(218, 74, 60, 0.32) 14.286%, rgba(218, 74, 60, 0.08) 85.714%)' }}
    >
      <p className="whitespace-nowrap text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-fg-2">{purchase ? 'NEXT STEP' : 'CURRENT STEP'}</p>
      <h2 className="text-[18px] font-semibold leading-[24px] text-fg">{title}</h2>
      {detail && <p className="text-[14px] leading-[20px] text-fg-2">{detail}</p>}
      {action && <div className="flex w-full [&>*]:w-full">{action}</div>}
    </section>
  );
}

function AssignmentCard({ job, engineerName, canAssign, onAssign }: {
  job: Job; engineerName: string | null; canAssign: boolean; onAssign: () => void;
}) {
  const a = job.current_assignment;
  return (
    <section className={cx(card, 'shrink-0')}>
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className={h2}>Assignment</h2>
        {a && <StatusPill domain="assignment" value={a.response} />}
      </div>
      <div className="flex w-full items-center gap-[12px] overflow-clip">
        {a && engineerName ? (
          <Avatar name={engineerName} seed={a.engineer_id} size={44} className="!text-fg" />
        ) : (
          <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-clip rounded-[22px] bg-subtle text-fg-2" aria-hidden>
            <Ic icon={IconUser} size={20} />
          </span>
        )}
        <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
          {a ? (
            <>
              <p className="text-[14px] font-medium leading-[20px] text-fg">{engineerName ?? <Skel w={90} />}</p>
              <p className="text-[12px] leading-[16px] text-fg-2">
                {a.response === 'ACCEPTED' && a.responded_at
                  ? `Service engineer · custody since ${formatDayTime(a.responded_at)}`
                  : `Service engineer · assigned ${formatDayTime(a.assigned_at)}`}
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-medium leading-[20px] text-fg-muted">Unassigned</p>
              <p className="text-[12px] leading-[16px] text-fg-2">No engineer on this job yet</p>
            </>
          )}
        </div>
      </div>
      {canAssign && (
        <Button kind="secondary" block icon={<Ic icon={IconUser} size={18} />} onClick={onAssign}>
          {a ? 'Reassign engineer' : 'Assign engineer'}
        </Button>
      )}
    </section>
  );
}

function TimeCard({ sessionsQ }: { sessionsQ: ReturnType<typeof useJobInspectionSessions> }) {
  const d = sessionsQ.data;
  const sum = (k: 'active_seconds' | 'paused_seconds') => (d ? d.time_totals.reduce((s, t) => s + (Number(t[k]) || 0), 0) : 0);
  const val = (x: ReactNode) => (sessionsQ.isPending ? <Skel w={63} /> : sessionsQ.isError ? '—' : x);
  return (
    <section className={cx(card, 'min-h-px flex-1')}>
      <div className="flex w-full items-center overflow-clip"><h2 className={h2}>Time on job</h2></div>
      <div className="flex w-full items-start gap-[32px] overflow-clip">
        <KV label="Inspection" mono>{val(formatDuration(sum('active_seconds')))}</KV>
        <KV label="Paused" mono>{val(formatDuration(sum('paused_seconds')))}</KV>
        <KV label="Sessions" mono>{val(String(d?.sessions.length ?? 0))}</KV>
      </div>
      {sessionsQ.isError && <p className="text-[12px] leading-[16px] text-st-blocked-fg">{errorBody(sessionsQ.error)}</p>}
    </section>
  );
}
