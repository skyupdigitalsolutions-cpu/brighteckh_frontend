// D·P0 · Purchase overview (Figma 177:102544, content 177:102547).
// Row 1 (177:102548): Today's priorities (177:102549, 3 gradient task cards) + Jobs by status (177:102599).
// Row 2 (177:102627, 424 tall): Engineer workload (177:102628), Intake this week (177:102661), Latest activity (177:102704).
//
// G22: no endpoint returns dashboard metrics, task counts, open-job counts per status, intake per day or an activity
// feed (G17: no engineer/employee lookup for the workload list). Every card keeps its designed container, head and
// "See all" link; the data slots render an explicit "not available" treatment + GapNote — never sample numbers.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconActivity, IconPlus, IconUsers } from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { Button, EmptyState, GapNote, GlassCard, Ic, PageContent, PageHeader } from '../../../ui/desktop';
import { CreateJinDrawer } from '../inward/detail/CreateJinDrawer';
import dotInspection from '../../../assets/figma/overview/dot-inspection.svg';
import dotAssigned from '../../../assets/figma/overview/dot-assigned.svg';
import dotAwaiting from '../../../assets/figma/overview/dot-awaiting.svg';
import ringTracks from '../../../assets/figma/overview/rings-tracks.svg';

/** "Good morning/afternoon/evening, <first name>" from the signed-in employee (GET /auth/me) and the local clock. */
function greeting(fullName: string | undefined, now = new Date()) {
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

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

// ------------------------------------------------------------------ Row 1 · Today's priorities
// Task card (177:102555): 1px tone/.35 border, 136° gradient tone/.34 → tone/.10, p-20, radius 22, gap 14.
// Literal Figma colours: red #da4a3c, purple #7b6fd6, amber #f5a300.
type Task = { key: string; rgb: string; flag: string; title: [string, string]; to: string; what: string };
const TASKS: Task[] = [
  // Flags are the card labels drawn in Figma (dashboard rank), not the API priority enum (NORMAL/URGENT/CRITICAL).
  { key: 'verify', rgb: '218, 74, 60', flag: 'URGENT PRIORITY', title: ['Verify', 'units'], to: '/p/inward', what: 'units waiting' },
  { key: 'assign', rgb: '123, 111, 214', flag: 'HIGH PRIORITY', title: ['Assign', 'engineers'], to: '/p/jobs', what: 'jobs waiting' },
  { key: 'review', rgb: '245, 163, 0', flag: 'NORMAL PRIORITY', title: ['Review', 'reports'], to: '/p/jobs', what: 'reports waiting' },
];

function TaskCard({ t }: { t: Task }) {
  return (
    <Link
      to={t.to}
      className="flex min-w-px flex-1 flex-col items-start gap-[14px] overflow-clip rounded-[22px] border p-[20px]"
      style={{
        borderColor: `rgba(${t.rgb}, 0.35)`,
        backgroundImage: `linear-gradient(136.0975deg, rgba(${t.rgb}, 0.34) 14.286%, rgba(${t.rgb}, 0.1) 85.714%)`,
      }}
    >
      <span className="flex shrink-0 items-start overflow-clip rounded-[12px] bg-[rgba(255,255,255,0.75)] px-[10px] py-[4px]">
        <span className="whitespace-nowrap text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-[#18181b]">{t.flag}</span>
      </span>
      <p className="whitespace-nowrap text-[30px] font-medium leading-[34px] text-[#18181b]">
        {t.title[0]}<br />{t.title[1]}
      </p>
      {/* G22: count not available — say so instead of a number. */}
      <p className="whitespace-nowrap text-[14px] leading-[20px] text-[#3f3f46]">— {t.what}</p>
      {/* People row (30px avatars): no source for who is involved (G22/G17) — slot kept empty at its drawn height. */}
      <div className="h-[30px] shrink-0" aria-hidden />
      <div className="flex w-full items-center gap-[12px] overflow-clip">
        <div className="flex h-[6px] min-w-px flex-1 items-start overflow-clip rounded-[3px] bg-[rgba(24,24,27,0.1)]" aria-hidden />
        <span className="whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-[#18181b]">— / — today</span>
      </div>
    </Link>
  );
}

function TodaysPriorities() {
  return (
    <GlassCard className="flex min-w-px flex-1 flex-col items-start gap-[20px] bg-[rgba(255,255,255,0.92)] p-[24px]">
      <CardHead title="Today's priorities" right={<SeeAll to="/p/jobs" />} />
      <div className="flex w-full items-start gap-[16px] overflow-clip">
        {TASKS.map((t) => <TaskCard key={t.key} t={t} />)}
      </div>
      <GapNote code="G22">No endpoint returns today's task counts, the people on them or today's progress, so the cards show no numbers.</GapNote>
    </GlassCard>
  );
}

// ------------------------------------------------------------------ Row 1 · Jobs by status
// Legend rows map to service_jobs.status (API enum): INSPECTION, ASSIGNED, AWAITING_ASSIGNMENT.
const LEGEND = [
  { status: 'INSPECTION', label: 'In inspection', dot: dotInspection },
  { status: 'ASSIGNED', label: 'Assigned', dot: dotAssigned },
  { status: 'AWAITING_ASSIGNMENT', label: 'Awaiting assignment', dot: dotAwaiting },
] as const;

function JobsByStatus() {
  return (
    <Link to="/p/jobs" className="glass flex w-[484px] shrink-0 flex-col items-start gap-[20px] self-stretch overflow-clip rounded-t-card p-[24px]">
      <CardHead
        title="Jobs by status"
        right={<p className="shrink-0 whitespace-nowrap text-[14px] leading-[20px] text-fg-2">— open jobs</p>}
      />
      <div className="flex min-h-px w-full flex-1 items-center gap-[16px] overflow-clip">
        <div className="flex min-w-px flex-1 flex-col items-start gap-[18px] overflow-clip">
          {LEGEND.map((l) => (
            <div key={l.status} className="flex shrink-0 flex-col items-start gap-[2px] overflow-clip" title={l.status}>
              <div className="flex items-center gap-[8px] overflow-clip">
                <img src={l.dot} alt="" width={10} height={10} className="h-[10px] w-[10px] shrink-0" />
                <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{l.label}</span>
              </div>
              <span className="whitespace-pre font-mono text-[22px] font-semibold leading-[24px] text-fg">{'—  ·  —'}</span>
            </div>
          ))}
        </div>
        {/* Rings 200×200: only the empty tracks of the Figma asset — the coloured arcs are data (G22). */}
        <img src={ringTracks} alt="" width={200} height={200} className="h-[200px] w-[200px] shrink-0" />
      </div>
      <GapNote code="G22">No endpoint counts open jobs by status (and there is no Purchase jobs list, G15).</GapNote>
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

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // working days Mon–Sat (client calendar, migration 012)

function IntakeThisWeek() {
  return (
    <Row2Card title="Intake this week" to="/p/inward" gap={20}>
      <div className="flex w-full shrink-0 items-start justify-end gap-[16px] overflow-clip">
        <div className="flex items-center gap-[6px] overflow-clip">
          <span className="h-[12px] w-[12px] shrink-0 rounded-[3px] bg-[#da4a3c]" aria-hidden />
          <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">Units received</span>
        </div>
        <div className="flex items-center gap-[6px] overflow-clip">
          <span className="h-[12px] w-[12px] shrink-0 rounded-[3px] bg-[#8a8a92]" aria-hidden />
          <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">Verified</span>
        </div>
      </div>
      {/* Bars area: no per-day intake source — no bars are drawn (a zero bar would be a fake value). */}
      <div className="flex min-h-px w-full flex-1 flex-col justify-end gap-[8px] overflow-clip">
        <div className="flex min-h-px flex-1 items-center">
          <GapNote code="G22">No endpoint returns units received / verified per day (and there is no inward list, G14).</GapNote>
        </div>
        <div className="flex w-full items-end justify-between">
          {DAYS.map((d) => (
            <span key={d} className="w-[46px] text-center text-[12px] leading-[16px] text-fg-muted">{d}</span>
          ))}
        </div>
      </div>
    </Row2Card>
  );
}

function EngineerWorkload() {
  return (
    <Row2Card title="Engineer workload" to="/p/jobs" gap={12}>
      <div className="flex min-h-px w-full flex-1 flex-col items-center justify-center gap-[12px]">
        <EmptyState icon={IconUsers} title="Workload isn't available yet" className="w-full px-0 py-0" />
        <GapNote code="G17 · G22">No engineer / employee lookup and no open-job count per engineer.</GapNote>
      </div>
    </Row2Card>
  );
}

function LatestActivity() {
  return (
    <Row2Card title="Latest activity" to="/p/jobs" gap={14}>
      <div className="flex min-h-px w-full flex-1 flex-col items-center justify-center gap-[12px]">
        <EmptyState icon={IconActivity} title="Activity isn't available yet" className="w-full px-0 py-0" />
        <GapNote code="G22">No activity feed endpoint (the audit log is not exposed to Purchase).</GapNote>
      </div>
    </Row2Card>
  );
}

// ------------------------------------------------------------------ page
export function PurchaseOverviewPage() {
  const { me } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = !!me && can.purchaseWork(me.role);
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
        <div className="flex w-full items-start gap-[20px]">
          <TodaysPriorities />
          <JobsByStatus />
        </div>
        <div className="flex h-[424px] w-full items-start gap-[20px]">
          <EngineerWorkload />
          <IntakeThisWeek />
          <LatestActivity />
        </div>
      </PageContent>
      {canCreate && <CreateJinDrawer open={createOpen} onClose={() => setCreateOpen(false)} />}
    </>
  );
}
