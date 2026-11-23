// D·P0 · Purchase overview (Figma 177:102544, content 177:102547).
// Row 1 (177:102548): Today's priorities (177:102549, 3 gradient task cards) + Jobs by status (177:102599).
// Row 2 (177:102627, 424 tall): Engineer workload (177:102628), Intake this week (177:102661), Latest activity (177:102704).
//
// Data: GET /overview/purchase (usePurchaseOverview) — raw counts only, no targets/denominators. Where Figma draws a
// target ("4 / 16 today") the card shows what the API supports ("4 verified today"); the progress fill is
// done / (done + remaining), both real counts from the response (see TASKS below for each card's pair).
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconActivity, IconPlus, IconUsers } from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { enumLabel, formatTime } from '../../../lib/format';
import {
  Avatar, Button, cx, EmptyState, ErrorState, errorBody, GlassCard, Ic, PageContent, PageHeader, StateCard,
} from '../../../ui/desktop';
import { usePurchaseOverview, type PurchaseOverview } from '../api';
import { CreateJinDrawer } from '../inward/detail/CreateJinDrawer';
import dotInspection from '../../../assets/figma/overview/dot-inspection.svg';
import dotAssigned from '../../../assets/figma/overview/dot-assigned.svg';
import dotAwaiting from '../../../assets/figma/overview/dot-awaiting.svg';

type Ov = PurchaseOverview;

/** "Good morning/afternoon/evening, <first name>" from the signed-in employee (GET /auth/me) and the local clock. */
function greeting(fullName: string | undefined, now = new Date()) {
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "See all" (177:102631): PillButton look, rendered as a router link.
function SeeAll({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex shrink-0 items-start overflow-clip whitespace-nowrap rounded-t-chip border border-line bg-subtle px-[16px] py-[8px] text-[14px] font-medium leading-[20px] text-fg hover:bg-surface"
    >
      See all
    </Link>
  );
}

function CardHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex w-full shrink-0 items-center gap-[12px] overflow-clip">
      <h2 className="min-w-px flex-1 text-[20px] font-semibold leading-[28px] text-fg">{title}</h2>
      {right}
    </div>
  );
}

/** Loading placeholder bar. */
function Skel({ w, h = 14, dark }: { w: number | string; h?: number; dark?: boolean }) {
  return <span className={cx('block shrink-0 animate-pulse rounded-[6px]', dark ? 'bg-dash-skeleton' : 'bg-disabled')} style={{ width: w, height: h }} aria-hidden />;
}

// ------------------------------------------------------------------ Row 1 · Today's priorities
// Task card (177:102555): 1px tone/.35 border, 136° gradient tone/.34 → tone/.10, p-20, radius 22, gap 14.
// Literal Figma colours: red #da4a3c, purple #7b6fd6, amber #f5a300.
type Task = {
  key: string; rgb: string; flag: string; title: [string, string]; to: string;
  /** Line under the title ("12 units waiting"). */
  waiting: (o: Ov) => string;
  /** Progress label: today's done count, no target ("4 verified today"). */
  today: (o: Ov) => string;
  /** Fill = done / (done + remaining); both are real counts from the response. */
  done: (o: Ov) => number;
  remaining: (o: Ov) => number;
};
const TASKS: Task[] = [
  // Flags are the card labels drawn in Figma (dashboard rank), not the API priority enum (NORMAL/URGENT/CRITICAL).
  {
    key: 'verify', rgb: '218, 74, 60', flag: 'URGENT PRIORITY', title: ['Verify', 'units'], to: '/p/inward',
    waiting: (o) => `${plural(o.verify_units.awaiting, 'unit', 'units')} waiting`,
    today: (o) => `${o.verify_units.verified_today} verified today`,
    done: (o) => o.verify_units.verified_today, remaining: (o) => o.verify_units.awaiting,
  },
  {
    key: 'assign', rgb: '123, 111, 214', flag: 'HIGH PRIORITY', title: ['Assign', 'engineers'], to: '/p/jobs',
    waiting: (o) => `${plural(o.assign_engineers.unassigned, 'job', 'jobs')} waiting`,
    // assigned_today counts assignment rows (reassignments included).
    today: (o) => `${o.assign_engineers.assigned_today} assigned today`,
    done: (o) => o.assign_engineers.assigned_today, remaining: (o) => o.assign_engineers.unassigned,
  },
  {
    key: 'review', rgb: '245, 163, 0', flag: 'NORMAL PRIORITY', title: ['Review', 'reports'], to: '/p/jobs',
    waiting: (o) => `${plural(o.review_reports.awaiting_review, 'report', 'reports')} · ${o.review_reports.returned} returned`,
    today: (o) => `${o.review_reports.reviewed_today} reviewed today`,
    done: (o) => o.review_reports.reviewed_today, remaining: (o) => o.review_reports.awaiting_review,
  },
];

function TaskCard({ t, o }: { t: Task; o?: Ov }) {
  const done = o ? t.done(o) : 0;
  const all = o ? done + t.remaining(o) : 0;
  const pct = all > 0 ? (done / all) * 100 : 0;
  return (
    <Link
      to={t.to}
      className="flex min-w-px flex-1 flex-col items-start gap-[14px] overflow-clip rounded-[22px] border p-[20px]"
      style={{
        borderColor: `rgba(${t.rgb}, 0.35)`,
        backgroundImage: `linear-gradient(136.0975deg, rgba(${t.rgb}, 0.34) 14.286%, rgba(${t.rgb}, 0.1) 85.714%)`,
      }}
    >
      <span className="flex shrink-0 items-start overflow-clip rounded-[12px] bg-dash-pill px-[10px] py-[4px]">
        <span className="whitespace-nowrap text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-dash-text">{t.flag}</span>
      </span>
      <p className="whitespace-nowrap text-[30px] font-medium leading-[34px] text-dash-text">
        {t.title[0]}<br />{t.title[1]}
      </p>
      {o
        ? <p className="whitespace-nowrap text-[14px] leading-[20px] text-dash-text-2">{t.waiting(o)}</p>
        : <span className="flex h-[20px] items-center"><Skel w={110} dark /></span>}
      {/* People row (30px avatars): the overview does not say who is on each task — slot kept at its drawn height. */}
      <div className="h-[30px] shrink-0" aria-hidden />
      <div className="flex w-full items-center gap-[12px] overflow-clip">
        <div
          className="flex h-[6px] min-w-px flex-1 items-start overflow-clip rounded-[3px] bg-dash-track"
          role={o ? 'progressbar' : undefined}
          aria-valuemin={0}
          aria-valuemax={all}
          aria-valuenow={done}
          aria-label={o ? `${done} done today, ${t.remaining(o)} still waiting` : undefined}
        >
          {pct > 0 && <div className="h-[6px] shrink-0 rounded-[3px] bg-dash-fill" style={{ width: `${pct}%` }} />}
        </div>
        {o
          ? <span className="whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-dash-text">{t.today(o)}</span>
          : <Skel w={90} dark />}
      </div>
    </Link>
  );
}

function TodaysPriorities({ o }: { o?: Ov }) {
  return (
    <GlassCard className="flex min-w-px flex-1 flex-col items-start gap-[20px] bg-dash-card p-[24px]">
      <CardHead title="Today's priorities" right={<SeeAll to="/p/jobs" />} />
      <div className="flex w-full items-start gap-[16px] overflow-clip">
        {TASKS.map((t) => <TaskCard key={t.key} t={t} o={o} />)}
      </div>
    </GlassCard>
  );
}

// ------------------------------------------------------------------ Row 1 · Jobs by status
// Legend rows map to service_jobs.status (API enum). Colours from the Figma arcs / legend dots (177:102620):
// outer ring red = In inspection, middle purple = Assigned, inner teal = Awaiting assignment.
const LEGEND = [
  { status: 'INSPECTION', label: 'In inspection', dot: dotInspection, colour: '#DA4A3C', r: 92 },
  { status: 'ASSIGNED', label: 'Assigned', dot: dotAssigned, colour: '#7B6FD6', r: 70 },
  { status: 'AWAITING_ASSIGNMENT', label: 'Awaiting assignment', dot: dotAwaiting, colour: '#2BA597', r: 48 },
] as const;

/** Clockwise arc from 12 o'clock covering `f` (0..1) of a circle of radius r around (100,100). */
function arcPath(r: number, f: number) {
  const a = Math.min(f, 0.9999) * 2 * Math.PI;
  const x = 100 + r * Math.sin(a);
  const y = 100 - r * Math.cos(a);
  return `M 100 ${100 - r} A ${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(3)} ${y.toFixed(3)}`;
}

// Rings 200×200 (177:102620): three 16px tracks (#18181b @ 7%) at radii 92 / 70 / 48, each with a butt-capped arc
// starting at 12 o'clock, clockwise, sweep = that status's share of open jobs.
function Rings({ shares }: { shares: number[] | null }) {
  return (
    <svg width={200} height={200} viewBox="0 0 200 200" className="h-[200px] w-[200px] shrink-0" aria-hidden>
      {LEGEND.map((l, i) => (
        <g key={l.status}>
          <circle cx={100} cy={100} r={l.r} fill="none" style={{ stroke: 'var(--color-chart-track)' }} strokeWidth={16} />
          {shares && shares[i]! > 0 && (
            <path d={arcPath(l.r, shares[i]!)} fill="none" stroke={l.colour} strokeWidth={16} strokeLinecap="butt" />
          )}
        </g>
      ))}
    </svg>
  );
}

const pctText = (n: number, total: number) => `${total > 0 ? Math.round((n / total) * 100) : 0}%`;

function JobsByStatus({ o }: { o?: Ov }) {
  const all = o?.jobs_by_status ?? [];
  const counts = new Map(all.map((s) => [s.status, s.count]));
  const total = all.reduce((s, x) => s + x.count, 0);
  const shown = LEGEND.map((l) => counts.get(l.status) ?? 0);
  // Open statuses Figma has no row for (JOB_CREATED, ACCEPTED, ON_HOLD) — summed into one muted line so the rows
  // add up to the head total.
  const others = all.filter((s) => !LEGEND.some((l) => l.status === s.status) && s.count > 0);
  const otherCount = others.reduce((s, x) => s + x.count, 0);
  return (
    <Link to="/p/jobs" className="glass flex w-[484px] shrink-0 flex-col items-start gap-[20px] self-stretch overflow-clip rounded-t-card p-[24px]">
      <CardHead
        title="Jobs by status"
        right={o
          ? <p className="shrink-0 whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{plural(total, 'open job', 'open jobs')}</p>
          : <Skel w={90} />}
      />
      <div className="flex min-h-px w-full flex-1 items-center gap-[16px] overflow-clip">
        <div className="flex min-w-px flex-1 flex-col items-start gap-[18px] overflow-clip">
          {LEGEND.map((l, i) => (
            <div key={l.status} className="flex shrink-0 flex-col items-start gap-[2px] overflow-clip" title={l.status}>
              <div className="flex items-center gap-[8px] overflow-clip">
                <img src={l.dot} alt="" width={10} height={10} className="h-[10px] w-[10px] shrink-0" />
                <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{l.label}</span>
              </div>
              {o
                ? <span className="whitespace-pre font-mono text-[22px] font-semibold leading-[24px] text-fg">{`${pctText(shown[i]!, total)}  ·  ${shown[i]}`}</span>
                : <span className="flex h-[24px] items-center"><Skel w={100} h={18} /></span>}
            </div>
          ))}
          {otherCount > 0 && (
            <p className="text-[12px] leading-[16px] text-fg-muted">
              + {otherCount} {otherCount === 1 ? 'job' : 'jobs'} {others.map((s) => enumLabel(s.status).toLowerCase()).join(' / ')}
            </p>
          )}
        </div>
        <Rings shares={o ? shown.map((n) => (total > 0 ? n / total : 0)) : null} />
      </div>
    </Link>
  );
}

// ------------------------------------------------------------------ Row 2
function Row2Card({ title, to, gap, children }: { title: string; to: string; gap: number; children: ReactNode }) {
  return (
    <GlassCard className="flex h-full min-w-px flex-1 flex-col items-start p-[24px]" style={{ gap }}>
      <CardHead title={title} right={<SeeAll to={to} />} />
      {children}
    </GlassCard>
  );
}

type Weekday = Ov['intake_this_week'][number]['weekday'];
const DAYS: { wd: Weekday; label: string }[] = [ // working days Mon–Sat (client calendar, migration 012)
  { wd: 'MON', label: 'Mon' }, { wd: 'TUE', label: 'Tue' }, { wd: 'WED', label: 'Wed' },
  { wd: 'THU', label: 'Thu' }, { wd: 'FRI', label: 'Fri' }, { wd: 'SAT', label: 'Sat' },
];

// Bars (177:102673): per day a pair of 20-wide, radius-10 bars (gap 6) — received #da4a3c, verified #8a8a92 — over a
// 12/16 muted day label (gap 8). Heights scale to the week's largest value (the tallest bar fills the bar area).
function IntakeThisWeek({ o }: { o?: Ov }) {
  const days = o?.intake_this_week ?? [];
  const max = Math.max(0, ...days.flatMap((d) => [d.units_received, d.units_verified]));
  const h = (n: number) => (max > 0 ? `${(n / max) * 100}%` : '0%');
  return (
    <Row2Card title="Intake this week" to="/p/inward" gap={20}>
      <div className="flex w-full shrink-0 items-start justify-end gap-[16px] overflow-clip">
        <div className="flex items-center gap-[6px] overflow-clip">
          <span className="h-[12px] w-[12px] shrink-0 rounded-[3px] bg-brand-logo" aria-hidden />
          <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">Units received</span>
        </div>
        <div className="flex items-center gap-[6px] overflow-clip">
          <span className="h-[12px] w-[12px] shrink-0 rounded-[3px] bg-chart-bar-muted" aria-hidden />
          <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">Verified</span>
        </div>
      </div>
      <div className="relative flex min-h-px w-full flex-1 items-stretch justify-between overflow-clip">
        {DAYS.map(({ wd, label }) => {
          const d = days.find((x) => x.weekday === wd);
          return (
            <div
              key={wd}
              className="flex shrink-0 flex-col items-center gap-[8px] overflow-clip"
              title={d ? `${label} ${d.date}: ${d.units_received} received · ${d.units_verified} verified` : undefined}
              aria-label={d ? `${label}: ${d.units_received} units received, ${d.units_verified} verified` : undefined}
            >
              <div className="flex min-h-px flex-1 items-end gap-[6px] overflow-clip">
                {o ? (
                  <>
                    <div className="w-[20px] shrink-0 rounded-[10px] bg-brand-logo" style={{ height: h(d?.units_received ?? 0) }} />
                    <div className="w-[20px] shrink-0 rounded-[10px] bg-chart-bar-muted" style={{ height: h(d?.units_verified ?? 0) }} />
                  </>
                ) : (
                  <>
                    <div className="h-[40%] w-[20px] shrink-0 animate-pulse rounded-[10px] bg-disabled" />
                    <div className="h-[30%] w-[20px] shrink-0 animate-pulse rounded-[10px] bg-disabled" />
                  </>
                )}
              </div>
              <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-muted">{label}</span>
            </div>
          );
        })}
        {o && max === 0 && (
          <p className="absolute inset-x-0 top-[40%] text-center text-[14px] leading-[20px] text-fg-2">No units received or verified this week yet</p>
        )}
      </div>
    </Row2Card>
  );
}

// Workload row (177:102633): py-10, gap 12, 1px bottom border (not on the last row); 40px avatar; name 14/20 Medium +
// 12/16 secondary sub-line; right "n open jobs" 14/20 secondary. Sub-line = employee code (+ awaiting custody): the
// API has no job title ("Service engineer" in Figma). Most open jobs first (API order); the list scrolls.
function EngineerWorkload({ o }: { o?: Ov }) {
  const rows = o?.engineer_workload ?? [];
  return (
    <Row2Card title="Engineer workload" to="/p/jobs" gap={12}>
      {!o ? (
        Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex w-full items-center gap-[12px] py-[10px]">
            <span className="h-[40px] w-[40px] shrink-0 animate-pulse rounded-full bg-disabled" />
            <div className="flex flex-1 flex-col gap-[6px]"><Skel w={120} /><Skel w={80} h={10} /></div>
          </div>
        ))
      ) : rows.length === 0 ? (
        <div className="flex min-h-px w-full flex-1 items-center justify-center">
          <EmptyState icon={IconUsers} title="No active engineers" body="Engineers appear here once they are set up as employees." className="w-full px-0 py-0" />
        </div>
      ) : (
        <div className="flex min-h-px w-full flex-1 flex-col overflow-y-auto">
          {rows.map((e, i) => (
            <div
              key={e.engineer_id}
              className={cx('flex w-full shrink-0 items-center gap-[12px] overflow-clip py-[10px]', i < rows.length - 1 && 'border-b border-line')}
            >
              <Avatar name={e.full_name} seed={e.engineer_id} size={40} ring />
              <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
                <p className="text-[14px] font-medium leading-[20px] text-fg">{e.full_name}</p>
                <p className="text-[12px] leading-[16px] text-fg-2">
                  {e.employee_code}{e.pending_custody > 0 ? ` · ${e.pending_custody} awaiting custody` : ''}
                </p>
              </div>
              <p className="shrink-0 whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{plural(e.open_jobs, 'open job', 'open jobs')}</p>
            </div>
          ))}
          {o.engineers_total > rows.length && (
            <p className="pt-[10px] text-[12px] leading-[16px] text-fg-muted">Showing {rows.length} of {o.engineers_total} engineers</p>
          )}
        </div>
      )}
    </Row2Card>
  );
}

// Activity row (177:102709 / 177:102717): alternating sides. Right (items-end): name then 28px avatar, bubble
// red/.22; left: avatar then name, bubble bg-subtle. Bubble px-14 py-10 radius 16, 14/20; time 12/16 muted.
// The API returns the audit action code + entity only (no document numbers), so the bubble shows the action in words.
const ACTION_PREFIX = /^(BR\d+[A-Z]?|FDN|CAL|AUTH)_/;
function actionText(action: string) {
  const s = enumLabel(action.replace(ACTION_PREFIX, '')).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function activityLink(table: string, id: string) {
  if (table === 'service_jobs') return `/p/jobs/${id}`;
  if (table === 'inward_receipts') return `/p/inward/${id}`;
  return null;
}

function LatestActivity({ o }: { o?: Ov }) {
  const rows = o?.latest_activity ?? [];
  return (
    <Row2Card title="Latest activity" to="/p/jobs" gap={14}>
      {!o ? (
        <div className="flex w-full flex-col gap-[14px]">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="flex flex-col gap-[6px]"><Skel w={100} /><Skel w={220} h={40} /></div>)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-px w-full flex-1 items-center justify-center">
          <EmptyState icon={IconActivity} title="No activity yet" body="Receipts, verifications and assignments show up here as they happen." className="w-full px-0 py-0" />
        </div>
      ) : (
        <div className="flex min-h-px w-full flex-1 flex-col gap-[14px] overflow-y-auto">
          {rows.map((a, i) => {
            const right = i % 2 === 0;
            const name = a.actor_name ?? 'System';
            const to = activityLink(a.entity_table, a.entity_id);
            const inner = (
              <>
                <div className={cx('flex items-center gap-[8px] overflow-clip', right && 'flex-row-reverse')}>
                  <Avatar name={name} seed={a.actor_id ?? name} size={28} ring />
                  <p className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{name}</p>
                </div>
                <div className={cx('flex max-w-full items-start overflow-clip rounded-[16px] px-[14px] py-[10px]', right ? 'bg-[rgba(218,74,60,0.22)]' : 'bg-subtle')}>
                  <p className="truncate text-[14px] leading-[20px] text-fg">{actionText(a.action)}</p>
                </div>
                <p className="whitespace-nowrap text-[12px] leading-[16px] text-fg-muted">{formatTime(a.changed_at)}</p>
              </>
            );
            const cls = cx('flex w-full shrink-0 flex-col gap-[6px] overflow-clip', right ? 'items-end' : 'items-start');
            const title = `${a.action} · ${a.entity_table}`;
            return to
              ? <Link key={a.id} to={to} className={cls} title={title}>{inner}</Link>
              : <div key={a.id} className={cls} title={title}>{inner}</div>;
          })}
        </div>
      )}
    </Row2Card>
  );
}

// ------------------------------------------------------------------ page
export function PurchaseOverviewPage() {
  const { me } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = !!me && can.purchaseWork(me.role);
  const q = usePurchaseOverview();
  const o = q.data;
  return (
    <>
      <PageHeader
        title={greeting(me?.full_name)}
        meta="Here's what's moving through Purchase today."
        action={canCreate ? (
          <Button icon={<Ic icon={IconPlus} size={18} />} onClick={() => setCreateOpen(true)}>New JIN</Button>
        ) : undefined}
      />
      <PageContent>
        {q.isError && !o ? (
          <StateCard>
            <ErrorState title="Couldn't load the overview" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
          </StateCard>
        ) : (
          <>
            <div className="flex w-full items-start gap-[20px]" aria-busy={q.isPending}>
              <TodaysPriorities o={o} />
              <JobsByStatus o={o} />
            </div>
            <div className="flex h-[424px] w-full items-start gap-[20px]">
              <EngineerWorkload o={o} />
              <IntakeThisWeek o={o} />
              <LatestActivity o={o} />
            </div>
          </>
        )}
      </PageContent>
      {canCreate && <CreateJinDrawer open={createOpen} onClose={() => setCreateOpen(false)} />}
    </>
  );
}
