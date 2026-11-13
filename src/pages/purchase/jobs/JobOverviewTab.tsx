// Figma "J1 · Job · Overview" 177:116069 — tab content only (header 177:116071 + tab bar 177:116073 are JobWorkspace).
// Stage 177:116082: glass-strong card, radius 24, p-24, gap 14; head 18/24 SemiBold + job status + route badges;
//   10-step stepper (28px dots radius 14; done = success fill + 14px white check; current = accent fill + 12/16
//   number on-accent + 14/20 Medium label; pending = bg-subtle + muted 12/16 number + muted 12/16 label; 2px lines,
//   success after a done step, default otherwise).
// Columns 177:116137 (gap 20): Left flex (Unit 177:116139, History 177:116166) · Right 420 (Next step 177:116175,
//   Assignment 177:116180, Time 177:116191). Cards: glass-strong, radius 24, p-24, gap 16, heading 18/24 SemiBold.
//   Key/value: 12/16 secondary label, gap 3, value 14/20 Medium (or Data/ID 13/18 mono); grid gap 40.
//   Timeline item 7:440: 12px tone dot with 3px tone-bg ring, 2px default connector, body pb-20, 14/20 Medium title,
//   12/16 secondary meta.
//   Next step: literal brand gradient, 11/14 SemiBold "NEXT STEP", 18/24 title, 14/20 secondary detail, primary button.
//
// Sources: job + current assignment = GET /jobs/{id} (useJobWorkspace); receipt/unit = GET /inward-receipts/{id}
// (useJobWorkspace); report = GET /jobs/{id}/inspection-report; time = GET /jobs/{id}/inspection-sessions.
// Gaps: G16 customer name, G17 engineer / actor names, G-C1-1 stages 5–10 (no job progress endpoint).
import { useState, type ReactNode } from 'react';
import { IconCheck, IconClipboardList, IconInbox, IconUser } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { useJobWorkspace } from '../job/JobWorkspace';
import type { Job } from '../api';
import { StatusPill } from '../../../ui/desktop/Badge';
import { Button, ButtonLink } from '../../../ui/desktop/Button';
import { ErrorState, errorBody } from '../../../ui/desktop/States';
import { GapNote } from '../../../ui/desktop/Feedback';
import { Ic, cx } from '../../../ui/desktop/Icon';
import { enumLabel, formatDayTime, formatDuration } from '../../../lib/format';
import {
  formatWaiting, isOpen, shortId, useJobInspectionReport, useJobInspectionSessions, type InspectionReport,
} from './jobsData';
import { ReassignDrawer } from './ReassignDrawer';

type StepState = 'done' | 'current' | 'pending';
const STEPS = ['Assigned', 'Custody', 'Inspection', 'Report review', 'Material', 'Quote', 'Authorised', 'Repair', 'Test', 'Dispatch'] as const;

const card = 'glass-strong flex w-full flex-col items-start gap-[16px] overflow-clip rounded-[24px] p-[24px]';
const h2 = 'min-w-0 flex-1 text-[18px] font-semibold leading-[24px] text-fg';

export function JobOverviewTab() {
  const { job, receipt, unit } = useJobWorkspace();
  const me = useMe();
  const reportQ = useJobInspectionReport(job.id);
  const sessionsQ = useJobInspectionSessions(job.id);
  const [drawer, setDrawer] = useState(false);

  const report = reportQ.data ?? null;
  const a = job.current_assignment;
  const canAssign = can.purchaseWork(me.role) && isOpen(job.status);

  // ---- stepper (steps 1–4 from data; 5–10 have no source here → G-C1-1)
  const done = [
    !!a && a.response !== 'DECLINED',
    a?.response === 'ACCEPTED',
    !!report && report.versions.length > 0,
    report?.status === 'ACCEPTED',
  ];
  const firstOpen = done.findIndex((d) => !d);
  const states: StepState[] = STEPS.map((_, i) => (i < 4 ? (done[i] ? 'done' : i === firstOpen ? 'current' : 'pending') : 'pending'));

  return (
    <>
      {/* Stage 177:116082 */}
      <section className="glass-strong flex w-full flex-col items-start gap-[14px] overflow-clip rounded-[24px] p-[24px]">
        <div className="flex w-full items-center gap-[10px] overflow-clip">
          <h2 className={h2}>Where this job is</h2>
          <StatusPill domain="job" value={job.status} />
          <StatusPill domain="route" value={job.route} />
        </div>
        <Stepper states={states} loading={reportQ.isPending} />
        {firstOpen === -1 && (
          <GapNote code="G-C1-1">
            Stages 5–10 (Material → Dispatch) aren't tracked on this overview: GET /jobs/{'{id}'} only carries the BR-02/03
            status and there is no job-progress endpoint. Use the Material, Quote, Authorisation and Repair &amp; test tabs.
          </GapNote>
        )}
      </section>

      {/* Columns 177:116137 */}
      <div className="flex w-full items-stretch gap-[20px]">
        <div className="flex min-w-px flex-1 flex-col items-start gap-[20px]">
          <UnitCard job={job} receipt={receipt} unit={unit} />
          <HistoryCard job={job} report={report} reportQ={reportQ} sessionsQ={sessionsQ} />
        </div>
        <div className="flex w-[420px] shrink-0 flex-col items-start gap-[20px]">
          <NextStepCard job={job} report={report} loading={reportQ.isPending} canAssign={canAssign} onAssign={() => setDrawer(true)} />
          <AssignmentCard job={job} canAssign={canAssign} onAssign={() => setDrawer(true)} />
          <TimeCard sessionsQ={sessionsQ} />
        </div>
      </div>

      {canAssign && (
        <ReassignDrawer open={drawer} onClose={() => setDrawer(false)} jobId={job.id} jobNumber={job.job_number} current={a} />
      )}
    </>
  );
}

// ------------------------------------------------------------------ stepper
function Stepper({ states, loading }: { states: StepState[]; loading: boolean }) {
  return (
    <div className="flex w-full items-center overflow-clip" aria-busy={loading || undefined}>
      {STEPS.map((label, i) => {
        const s = states[i]!;
        return (
          <div key={label} className="contents">
            {i > 0 && <div className={cx('h-[2px] min-w-px flex-1', states[i - 1] === 'done' ? 'bg-success' : 'bg-line')} aria-hidden />}
            <div className="flex shrink-0 flex-col items-center gap-[8px] overflow-clip" aria-current={s === 'current' ? 'step' : undefined}>
              <div className={cx(
                'flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-clip rounded-[14px]',
                s === 'done' ? 'bg-success text-fg-on-accent' : s === 'current' ? 'bg-accent' : 'bg-subtle',
              )}>
                {s === 'done'
                  ? <Ic icon={IconCheck} size={14} />
                  : <span className={cx('whitespace-nowrap text-[12px] leading-[16px]', s === 'current' ? 'text-fg-on-accent' : 'text-fg-muted')}>{i + 1}</span>}
              </div>
              <span className={cx(
                'whitespace-nowrap',
                s === 'current' ? 'text-[14px] font-medium leading-[20px] text-fg'
                  : s === 'done' ? 'text-[12px] leading-[16px] text-fg' : 'text-[12px] leading-[16px] text-fg-muted',
              )}>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
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

function UnitCard({ job, receipt, unit }: { job: Job; receipt: WS['receipt']; unit: WS['unit'] }) {
  const loading = !receipt;
  const ofGroup = receipt && unit ? receipt.equipment_units.filter((u) => u.group_id === unit.group_id).length : 0;
  const v = (x: string | null | undefined) => (loading ? <Skel w={110} /> : x?.trim() || '—');
  return (
    <section className={card}>
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className={h2}>Unit as received</h2>
        <ButtonLink to={`/p/inward/${job.inward_id}`} kind="secondary" icon={<Ic icon={IconInbox} size={18} />}>View inward receipt</ButtonLink>
      </div>
      <div className="flex w-full items-start gap-[40px] overflow-clip">
        {/* G16: no customer name in the API (receipt carries customer_id only). */}
        <KV label="Customer">—</KV>
        <KV label="Inward" mono>{loading ? <Skel w={150} /> : unit ? `${receipt!.jin_number} · unit ${unit.unit_number} of ${ofGroup}` : receipt!.jin_number}</KV>
        <KV label="Serial no." mono>{v(unit?.serial_number)}</KV>
        <KV label="Make / model">{loading ? <Skel w={110} /> : [unit?.observed_make, unit?.observed_model].filter(Boolean).join(' · ') || '—'}</KV>
      </div>
      <div className="flex w-full items-start gap-[40px] overflow-clip">
        <KV label="Reported fault">{v(unit?.reported_fault)}</KV>
        <KV label="Condition">{v(unit?.physical_condition)}</KV>
        <KV label="Accessories">{v(unit?.accessories)}</KV>
      </div>
      <GapNote code="G16">Customer name isn't readable: the receipt only carries customer_id and there is no customers lookup.</GapNote>
    </section>
  );
}

type Tone = 'neutral' | 'progress' | 'success';
type Event = { at: string; title: string; detail?: string | null; tone: Tone };
const DOT: Record<Tone, string> = {
  neutral: 'bg-st-neutral-fg shadow-[0_0_0_3px_var(--color-status-neutral-bg)]',
  progress: 'bg-st-progress-fg shadow-[0_0_0_3px_var(--color-status-progress-bg)]',
  success: 'bg-st-success-fg shadow-[0_0_0_3px_var(--color-status-success-bg)]',
};

function HistoryCard({ job, report, reportQ, sessionsQ }: {
  job: Job;
  report: InspectionReport | null;
  reportQ: ReturnType<typeof useJobInspectionReport>;
  sessionsQ: ReturnType<typeof useJobInspectionSessions>;
}) {
  const a = job.current_assignment;
  const ev: Event[] = [{ at: job.created_at, title: 'Unit verified · job created', tone: 'success' }];
  if (a) {
    ev.push({ at: a.assigned_at, title: a.reassignment_reason ? 'Engineer reassigned' : 'Engineer assigned', detail: a.reassignment_reason, tone: 'neutral' });
    if (a.responded_at && a.response === 'ACCEPTED') ev.push({ at: a.responded_at, title: 'Custody acknowledged', tone: 'success' });
    if (a.responded_at && a.response === 'DECLINED') ev.push({ at: a.responded_at, title: 'Custody declined', detail: a.response_reason, tone: 'neutral' });
  }
  const firstSession = sessionsQ.data?.sessions[0];
  if (firstSession) ev.push({ at: firstSession.started_at, title: 'Inspection started', tone: 'neutral' });
  if (report) {
    for (const v of report.versions) {
      if (v.submitted_at) ev.push({ at: v.submitted_at, title: `Inspection report v${v.version_no} submitted`, detail: v.outcome ? `Outcome ${enumLabel(v.outcome)}` : null, tone: 'progress' });
    }
    for (const r of report.reviews) {
      const vno = report.versions.find((v) => v.id === r.version_id)?.version_no;
      ev.push({
        at: r.reviewed_at,
        title: `Inspection report${vno ? ` v${vno}` : ''} ${r.review_decision === 'ACCEPT' ? 'accepted' : 'returned'}`,
        detail: r.review_comment,
        tone: r.review_decision === 'ACCEPT' ? 'success' : 'neutral',
      });
    }
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
        <ol className="flex w-full flex-col">
          {ev.map((e, i) => (
            <li key={`${e.at}-${e.title}`} className="flex w-full items-start gap-[12px]">
              <div className="flex shrink-0 flex-col items-center gap-[4px] self-stretch overflow-clip pt-[3px]">
                <span className={cx('m-[3px] block h-[12px] w-[12px] shrink-0 rounded-full', DOT[e.tone])} aria-hidden />
                {i < ev.length - 1 && <span className="min-h-px w-[2px] flex-1 bg-line" aria-hidden />}
              </div>
              <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip pb-[20px]">
                <p className="text-[14px] font-medium leading-[20px] text-fg">{e.title}</p>
                <p className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{formatDayTime(e.at)}</p>
                {e.detail && <p className="text-[14px] leading-[20px] text-fg-2">{e.detail}</p>}
              </div>
            </li>
          ))}
          {(reportQ.isPending || sessionsQ.isPending) && <li className="flex w-full flex-col gap-[8px] pl-[24px]"><Skel w={220} /><Skel w={120} /></li>}
        </ol>
      )}
      <GapNote code="G17">Actor names aren't shown — the API returns employee ids only, with no employee lookup. Only the current assignment is readable (earlier assignments aren't listed).</GapNote>
    </section>
  );
}

function NextStepCard({ job, report, loading, canAssign, onAssign }: {
  job: Job; report: InspectionReport | null; loading: boolean; canAssign: boolean; onAssign: () => void;
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
    title = `Review inspection report v${latest.version_no}`;
    const wait = formatWaiting(latest.submitted_at);
    detail = [latest.outcome && `Outcome ${enumLabel(latest.outcome)}`, wait && `waiting ${wait}`].filter(Boolean).join(' · ');
    action = <ButtonLink to={`/p/jobs/${job.id}/inspection`} kind="primary" className="w-full" icon={<Ic icon={IconClipboardList} size={18} />}>Review report</ButtonLink>;
  } else if (report.status === 'ACCEPTED') {
    title = `Inspection report v${latest.version_no} accepted`;
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
      <p className="whitespace-nowrap text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-fg-2">NEXT STEP</p>
      <h2 className="text-[18px] font-semibold leading-[24px] text-fg">{title}</h2>
      {detail && <p className="text-[14px] leading-[20px] text-fg-2">{detail}</p>}
      {action && <div className="flex w-full [&>*]:w-full">{action}</div>}
    </section>
  );
}

function AssignmentCard({ job, canAssign, onAssign }: { job: Job; canAssign: boolean; onAssign: () => void }) {
  const a = job.current_assignment;
  return (
    <section className={cx(card, 'shrink-0')}>
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className={h2}>Assignment</h2>
        {a && <StatusPill domain="assignment" value={a.response} />}
      </div>
      <div className="flex w-full items-center gap-[12px] overflow-clip">
        <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-clip rounded-[22px] bg-subtle text-fg-2" aria-hidden>
          <Ic icon={IconUser} size={20} />
        </span>
        <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
          {a ? (
            <>
              <p className="font-mono text-[13px] font-medium leading-[20px] text-fg" title={a.engineer_id}>Engineer {shortId(a.engineer_id)}</p>
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
