// MD0 · Management overview (/mg/overview) — Figma 177:140122 (M-D panel 177:140121, view only).
// Header "Business overview" + "<company> · live · view only".
// Row 1 (177:140126, 272 tall): "Today at a glance" (3 gradient cards: OPEN JOBS red · QUOTE PIPELINE purple · POs IN
//   FLIGHT amber, "View only" chip) + "Jobs by stage" (rings, 484 wide — the Purchase overview's JobsByStatus).
// Row 2 (177:140180, 516 tall): Turnaround (days) · Quote pipeline · Attention needed.
//
// DATA (all already open to MANAGEMENT, nothing new on the server):
//   GET /overview/purchase  open jobs by status, units awaiting verification, unassigned jobs, intake this week.
//   GET /quotes?status=X    per status: `total` = count; Σ latest_revised_pre_tax over the rows (page_size 100) = value.
//   GET /jobs               attention list: ON_HOLD jobs + unassigned URGENT / CRITICAL open jobs.
// Deviations (GapNotes):
//   G-MD-1 POs in flight: GET /purchase-orders is PURCHASE-only (pending client decision) → the card says so, no value.
//   G-MD-2 Turnaround: no receipt → dispatch duration or target exists in any read. The slot shows "Intake this week"
//          (units received vs verified, same bar chart) instead.
//   G-MD-3 Quote values are PRE-TAX (the list returns no total; quote total composition is an open client decision);
//          "Accepted · 30 days" and "Win rate · 30 days" are all-time (GET /quotes has no date filter); margin has no
//          rule (BR-10's is UNVERIFIED). If a status has > 100 quotes the value covers the newest 100.
//   G-MD-4 Attention: two-fail gate, SLA risk, overdue POs and quarantine holds have no Management read.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconChecklist, IconLock } from '@tabler/icons-react';
import { useAuth } from '../../auth/AuthProvider';
import { formatINR } from '../../lib/format';
import { plural } from '../../lib/greeting';
import {
  EmptyState, ErrorState, GapNote, GlassCard, Ic, PageContent, PageHeader, PriorityChip, StateCard, StatusPill, cx, errorBody,
} from '../../ui/desktop';
import { useJobsList, usePurchaseOverview, useQuotesList, type JobListRow, type PurchaseOverview } from '../purchase/api';
import { OPEN_STATUSES } from '../purchase/jobs/jobsData';
import { CardHead, IntakeThisWeek, JobsByStatus, Row2Card, Skel } from '../purchase/overview/OverviewPage';
import { paiseToDec, toPaise } from '../purchase/quotes/money';
import type { QuoteStatus } from '../purchase/quotes/api';

const PAGE = 100;

/** One status of the quote pipeline: count (`total`) + Σ pre-tax of the returned rows. */
function useQuoteBucket(status: QuoteStatus, withRows = true) {
  const q = useQuotesList({ status, page_size: withRows ? PAGE : 1 });
  const rows = q.data?.rows ?? [];
  const sum = rows.reduce<bigint>((s, r) => s + (toPaise(r.latest_revised_pre_tax) ?? 0n), 0n);
  return {
    q,
    count: q.data?.total ?? null,
    value: q.data ? formatINR(paiseToDec(sum)) : null,
    partial: !!q.data && withRows && q.data.total > rows.length,
  };
}
type Bucket = ReturnType<typeof useQuoteBucket>;

// ------------------------------------------------------------------ Row 1 · Today at a glance
// Glance card (177:140131…): same gradient recipe as the Purchase task cards — 1px tone/.35 border, 136° tone/.34 → .10,
// p-20 radius 22 gap 14; chip 11/14 SemiBold; big value 40/48 mono SemiBold; line 14/20; sub 12/16.
function GlanceCard({ rgb, flag, value, line, sub, to }: {
  rgb: string; flag: string; value: ReactNode; line: ReactNode; sub?: ReactNode; to?: string;
}) {
  const cls = 'flex min-w-px flex-1 flex-col items-start gap-[12px] overflow-clip rounded-[22px] border p-[20px]';
  const style = {
    borderColor: `rgba(${rgb}, 0.35)`,
    backgroundImage: `linear-gradient(136.0975deg, rgba(${rgb}, 0.34) 14.286%, rgba(${rgb}, 0.1) 85.714%)`,
  };
  const inner = (
    <>
      <span className="flex shrink-0 items-start overflow-clip rounded-[12px] bg-dash-pill px-[10px] py-[4px]">
        <span className="whitespace-nowrap text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-dash-text">{flag}</span>
      </span>
      <p className="whitespace-nowrap font-mono text-[40px] font-semibold leading-[48px] text-dash-text">{value}</p>
      <p className="text-[14px] leading-[20px] text-dash-text-2">{line}</p>
      {sub && <p className="text-[12px] leading-[16px] text-dash-text-2">{sub}</p>}
    </>
  );
  return to ? <Link to={to} className={cls} style={style}>{inner}</Link> : <div className={cls} style={style}>{inner}</div>;
}

function TodayAtAGlance({ o, withSales, sent, accepted, rejected }: {
  o?: PurchaseOverview; withSales: Bucket; sent: Bucket; accepted: Bucket; rejected: Bucket;
}) {
  const open = o?.jobs_by_status.reduce((s, x) => s + x.count, 0);
  const pipeCount = withSales.count != null && sent.count != null ? withSales.count + sent.count : null;
  const pipeValue = withSales.q.data && sent.q.data
    ? formatINR(paiseToDec([...withSales.q.data.rows, ...sent.q.data.rows].reduce<bigint>((s, r) => s + (toPaise(r.latest_revised_pre_tax) ?? 0n), 0n)))
    : null;
  const decided = accepted.count != null && rejected.count != null ? accepted.count + rejected.count : null;
  const winRate = decided ? `${Math.round(((accepted.count ?? 0) / decided) * 100)} %` : '—';
  return (
    <GlassCard className="flex min-w-px flex-1 flex-col items-start gap-[20px] bg-dash-card p-[24px]">
      <CardHead
        title="Today at a glance"
        right={(
          <span className="flex shrink-0 items-center gap-[6px] rounded-t-chip border border-line bg-subtle px-[12px] py-[6px] text-[12px] leading-[16px] text-fg-2">
            <Ic icon={IconLock} size={14} /> View only
          </span>
        )}
      />
      <div className="flex w-full items-stretch gap-[16px] overflow-clip">
        <GlanceCard
          rgb="218, 74, 60" flag="OPEN JOBS" to="/mg/jobs"
          value={open ?? <Skel w={70} h={36} dark />}
          line={o ? `${o.verify_units.awaiting} awaiting verification · ${o.assign_engineers.unassigned} unassigned` : <Skel w={200} dark />}
          sub={o ? `${o.verify_units.verified_today} verified today` : undefined}
        />
        <GlanceCard
          rgb="123, 111, 214" flag="QUOTE PIPELINE" to="/mg/quotes"
          value={pipeValue ?? <Skel w={160} h={36} dark />}
          line={pipeCount != null ? `${plural(pipeCount, 'quote', 'quotes')} with customers or Sales · pre-tax` : <Skel w={200} dark />}
          sub={decided != null ? `Win rate ${winRate} · all time` : undefined}
        />
        <GlanceCard
          rgb="245, 163, 0" flag="POs IN FLIGHT"
          value="—"
          line="Supplier purchase orders aren't visible to Management yet."
          sub="Pending a client decision on the PO role scope."
        />
      </div>
    </GlassCard>
  );
}

// ------------------------------------------------------------------ Row 2 · Quote pipeline (177:140220)
function PipelineRow({ label, b, last }: { label: string; b: Bucket; last?: boolean }) {
  return (
    <div className={cx('flex w-full items-center gap-[12px] py-[12px]', !last && 'border-b border-line')}>
      <div className="flex min-w-px flex-1 flex-col gap-[2px]">
        <p className="text-[14px] font-medium leading-[20px] text-fg">{label}</p>
        <p className="text-[12px] leading-[16px] text-fg-2">{b.count == null ? '…' : plural(b.count, 'quote', 'quotes')}</p>
      </div>
      <p className="shrink-0 whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">
        {b.q.isError ? '—' : b.value ?? <Skel w={90} />}
      </p>
    </div>
  );
}

function QuotePipeline({ draft, withSales, sent, accepted }: { draft: Bucket; withSales: Bucket; sent: Bucket; accepted: Bucket }) {
  const all = [draft, withSales, sent, accepted];
  const failed = all.find((b) => b.q.isError);
  return (
    <Row2Card title="Quote pipeline" to="/mg/quotes" gap={8}>
      {failed ? (
        <div className="flex w-full flex-1 items-center justify-center">
          <ErrorState title="Couldn't load quotes" body={errorBody(failed.q.error)} onRetry={() => all.forEach((b) => b.q.refetch())} retrying={failed.q.isFetching} />
        </div>
      ) : (
        <div className="flex w-full flex-col">
          <PipelineRow label="Draft (Purchase)" b={draft} />
          <PipelineRow label="Released to Sales" b={withSales} />
          <PipelineRow label="With customer" b={sent} />
          <PipelineRow label="Accepted · all time" b={accepted} />
          <div className="flex w-full items-center gap-[12px] py-[12px]">
            <div className="flex min-w-px flex-1 flex-col gap-[2px]">
              <p className="text-[14px] font-medium leading-[20px] text-fg">Margin on accepted</p>
              <p className="text-[12px] leading-[16px] text-fg-2">avg</p>
            </div>
            <p className="shrink-0 font-mono text-[14px] font-semibold leading-[20px] text-fg">—</p>
          </div>
        </div>
      )}
      <div className="mt-auto flex w-full flex-col gap-[8px]">
        <GapNote code="G-MD-3">
          Values are pre-tax (the quote total composition is an open client decision), &ldquo;Accepted&rdquo; is all time (the
          quote list has no date filter) and no margin rule exists, so no margin is shown.
          {all.some((b) => b.partial) && ' A status with more than 100 quotes is summed over its newest 100.'}
        </GapNote>
      </div>
    </Row2Card>
  );
}

// ------------------------------------------------------------------ Row 2 · Attention needed (177:140250)
function AttentionRow({ row, badge, sub, last }: { row: JobListRow; badge: ReactNode; sub: string; last?: boolean }) {
  return (
    <Link
      to={`/mg/jobs/${row.id}/overview`}
      className={cx('flex w-full items-center gap-[12px] rounded-[14px] px-[14px] py-[12px] hover:bg-subtle', !last && 'mb-[4px]')}
    >
      <div className="flex min-w-px flex-1 flex-col gap-[2px] overflow-clip">
        <p className="truncate text-[14px] font-medium leading-[20px] text-fg">
          <span className="font-mono">{row.job_number}</span> · {[row.assembly_name, row.observed_model].filter(Boolean).join(' · ') || 'Equipment'}
        </p>
        <p className="truncate text-[12px] leading-[16px] text-fg-2">{sub}</p>
      </div>
      <span className="shrink-0">{badge}</span>
    </Link>
  );
}

function AttentionNeeded() {
  const held = useJobsList({ status: ['ON_HOLD'], page_size: 4 });
  const urgent = useJobsList({
    status: OPEN_STATUSES.filter((s) => s !== 'ON_HOLD'), priority: ['CRITICAL', 'URGENT'], engineer_id: 'unassigned', page_size: 4,
  });
  const failed = held.isError ? held : urgent.isError ? urgent : null;
  const loading = held.isPending || urgent.isPending;
  const items = [
    ...(urgent.data?.rows ?? []).map((r) => ({ r, badge: <PriorityChip priority={r.priority} />, sub: `Unassigned · ${r.customer_name}` })),
    ...(held.data?.rows ?? []).map((r) => ({ r, badge: <StatusPill domain="job" value={r.status} />, sub: `${r.current_engineer_name ?? 'Unassigned'} · ${r.customer_name}` })),
  ].slice(0, 6);
  return (
    <Row2Card title="Attention needed" to="/mg/jobs" gap={12}>
      {failed ? (
        <div className="flex w-full flex-1 items-center justify-center">
          <ErrorState title="Couldn't load jobs" body={errorBody(failed.error)} onRetry={() => { void held.refetch(); void urgent.refetch(); }} retrying={failed.isFetching} />
        </div>
      ) : loading ? (
        <div className="flex w-full flex-col gap-[14px]">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="flex flex-col gap-[6px]"><Skel w={220} /><Skel w={140} h={10} /></div>)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex min-h-px w-full flex-1 items-center justify-center">
          <EmptyState icon={IconChecklist} title="Nothing needs attention" body="No jobs on hold and no unassigned urgent or critical jobs." className="w-full px-0 py-0" />
        </div>
      ) : (
        <div className="flex min-h-px w-full flex-1 flex-col overflow-y-auto">
          {items.map((x, i) => <AttentionRow key={x.r.id} row={x.r} badge={x.badge} sub={x.sub} last={i === items.length - 1} />)}
        </div>
      )}
      <div className="mt-auto w-full">
        <GapNote code="G-MD-4">Shows jobs on hold and unassigned urgent / critical jobs. Two-fail gates, SLA risk, overdue purchase orders and quarantine holds have no Management read.</GapNote>
      </div>
    </Row2Card>
  );
}

// ------------------------------------------------------------------ page
export function ManagementOverviewPage() {
  const { companyName } = useAuth();
  const ov = usePurchaseOverview();
  const o = ov.data;
  const draft = useQuoteBucket('DRAFT');
  const withSales = useQuoteBucket('RELEASED_TO_SALES');
  const sent = useQuoteBucket('SENT');
  const accepted = useQuoteBucket('ACCEPTED');
  const rejected = useQuoteBucket('REJECTED', false);
  return (
    <>
      <PageHeader title="Business overview" meta={[companyName, 'live', 'view only'].filter(Boolean).join(' · ')} />
      <PageContent>
        {ov.isError && !o ? (
          <StateCard>
            <ErrorState title="Couldn't load the overview" body={errorBody(ov.error)} onRetry={() => ov.refetch()} retrying={ov.isFetching} />
          </StateCard>
        ) : (
          <>
            <div className="flex w-full items-stretch gap-[20px]" aria-busy={ov.isPending}>
              <TodayAtAGlance o={o} withSales={withSales} sent={sent} accepted={accepted} rejected={rejected} />
              <JobsByStatus o={o} title="Jobs by stage" to="/mg/jobs" />
            </div>
            <div className="flex h-[516px] w-full items-start gap-[20px]">
              <IntakeThisWeek
                o={o}
                to={null}
                note={<GapNote code="G-MD-2">Turnaround (receipt → dispatch, days vs target) has no source yet, so this card shows the week&apos;s intake instead.</GapNote>}
              />
              <QuotePipeline draft={draft} withSales={withSales} sent={sent} accepted={accepted} />
              <AttentionNeeded />
            </div>
          </>
        )}
      </PageContent>
    </>
  );
}
