// STD0 · Stores dashboard (/st/dashboard, the Stores landing page) — Figma 177:139286 (ST-D panel 177:139285).
// Header "Good morning, <name>" + "Receiving bay · <company> · n shipments in transit".
// Row 1 (177:139290, 350 tall): Today's priorities (3 gradient task cards, "See all") + Arriving (right card).
// Row 2 (177:139346, 438 tall): Open GRNs · Quarantine · Latest activity.
//
// DATA: no Stores overview endpoint exists — everything is derived from the two Stores lists (STORES_QUALITY):
//   GET /stores/receivable-pos  counts_by_status (RELEASED / ACKNOWLEDGED / SHIPPED) + rows (can_receive, open_grns,
//                               latest shipment / acknowledgement, lines)
//   GET /stores/grns            counts_by_status (OPEN / PARTIAL / POSTED) + rows (lines_posted / lines_total, received)
// Cards:
//   Receive shipments  POs the API accepts a GRN for (ACKNOWLEDGED + SHIPPED); bar = how many of the listed POs already
//                      have a GRN started (open_grns > 0). Figma's "arrived" has no source (nothing records arrival).
//   Inspect & post     open GRNs (OPEN + PARTIAL); bar = posted / total lines over those GRNs.
//   Awaiting supplier  RELEASED POs not yet acknowledged. Deviation: Figma's third card is "Quarantine review" (GAP-STD-1).
// Deviations (GapNotes): GAP-STD-1 quarantine — no Stores-readable quarantine list (the Quarantine pill is hidden pending
// a client decision); GAP-STD-2 latest activity — no Stores activity feed, so the card lists recently posted GRNs.
// Loading / empty / error per card (four states); a full error state when both lists fail.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconClipboardCheck, IconPackageImport, IconTruckDelivery } from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthProvider';
import { formatDayMonth, formatDayTime } from '../../../lib/format';
import { greeting, plural } from '../../../lib/greeting';
import {
  EmptyState, ErrorState, GapNote, GlassCard, PageContent, PageHeader, StateCard, cx, errorBody,
} from '../../../ui/desktop';
import { CardHead, Row2Card, SeeAll, Skel } from '../../purchase/overview/OverviewPage';
import { useGrns, useReceivablePos, type ReceivablePoRow, type StoresGrnRow } from '../api';
import { GrnBadge, PoBadge } from '../ui';

const LIST = 25;

const expected = (r: ReceivablePoRow) =>
  r.latest_shipment?.expected_arrival_date ?? r.acknowledgement?.expected_delivery_date ?? null;

// ------------------------------------------------------------------ Row 1 · Today's priorities
// Task card (177:139296…): the Purchase overview recipe — 1px tone/.35 border, 136° tone/.34 → .10, p-20 radius 22
// gap 14; flag chip 11/14; title 30/34 Medium (2 lines); line 14/20; sub 14/20 secondary; bar 6px + mono "n / m".
function TaskCard({ rgb, flag, title, line, sub, done, all, to, loading }: {
  rgb: string; flag: string; title: [string, string]; line: ReactNode; sub: ReactNode; to: string; loading: boolean;
  done?: number; all?: number;
}) {
  const pct = all ? ((done ?? 0) / all) * 100 : 0;
  return (
    <Link
      to={to}
      className="flex min-w-px flex-1 flex-col items-start gap-[14px] overflow-clip rounded-[22px] border p-[20px]"
      style={{
        borderColor: `rgba(${rgb}, 0.35)`,
        backgroundImage: `linear-gradient(136.0975deg, rgba(${rgb}, 0.34) 14.286%, rgba(${rgb}, 0.1) 85.714%)`,
      }}
    >
      <span className="flex shrink-0 items-start overflow-clip rounded-[12px] bg-dash-pill px-[10px] py-[4px]">
        <span className="whitespace-nowrap text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-dash-text">{flag}</span>
      </span>
      <p className="whitespace-nowrap text-[30px] font-medium leading-[34px] text-dash-text">{title[0]}<br />{title[1]}</p>
      {loading ? <Skel w={150} dark /> : <p className="truncate text-[14px] leading-[20px] text-dash-text">{line}</p>}
      {loading ? <Skel w={110} dark /> : <p className="truncate text-[14px] leading-[20px] text-dash-text-2">{sub}</p>}
      {all != null && (
        <div className="mt-auto flex w-full items-center gap-[12px] overflow-clip">
          <div
            className="flex h-[6px] min-w-px flex-1 items-start overflow-clip rounded-[3px] bg-dash-track"
            role="progressbar" aria-valuemin={0} aria-valuemax={all} aria-valuenow={done ?? 0}
          >
            {pct > 0 && <div className="h-[6px] shrink-0 rounded-[3px] bg-dash-fill" style={{ width: `${pct}%` }} />}
          </div>
          <span className="whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-dash-text">{`${done ?? 0} / ${all}`}</span>
        </div>
      )}
    </Link>
  );
}

const firstTwo = (xs: string[]) => (xs.length === 0 ? '—' : xs.slice(0, 2).join(' · ') + (xs.length > 2 ? ` +${xs.length - 2}` : ''));

function TodaysPriorities({ pos, grns, released }: {
  pos: ReturnType<typeof useReceivablePos>; grns: ReturnType<typeof useGrns>; released: ReturnType<typeof useReceivablePos>;
}) {
  const ready = pos.data?.rows ?? [];
  const readyCount = pos.data?.total ?? 0;
  const open = grns.data?.rows ?? [];
  const openCount = grns.data?.total ?? 0;
  const firstOpen = open[0];
  const linesPosted = open.reduce((s, g) => s + g.lines_posted, 0);
  const linesTotal = open.reduce((s, g) => s + g.lines_total, 0);
  const rel = released.data?.rows ?? [];
  const relCount = released.data?.total ?? 0;
  return (
    <GlassCard className="flex min-w-px flex-1 flex-col items-start gap-[20px] bg-dash-card p-[24px]">
      <CardHead title="Today's priorities" right={<SeeAll to="/st/receive" />} />
      <div className="flex w-full flex-1 items-stretch gap-[16px] overflow-clip">
        <TaskCard
          rgb="218, 74, 60" flag="URGENT PRIORITY" title={['Receive', 'shipments']} to="/st/receive" loading={pos.isPending}
          line={readyCount === 0 ? 'Nothing to receive' : firstTwo(ready.map((r) => r.po_number))}
          sub={readyCount === 0 ? 'No acknowledged or shipped POs' : `${plural(readyCount, 'PO', 'POs')} ready for a GRN`}
          done={ready.filter((r) => r.open_grns > 0).length} all={ready.length}
        />
        <TaskCard
          rgb="123, 111, 214" flag="HIGH PRIORITY" title={['Inspect', '& post']} to={firstOpen ? `/st/grns/${firstOpen.grn_id}` : '/st/grns'} loading={grns.isPending}
          line={firstOpen ? `${firstOpen.grn_number} · ${firstOpen.lines_total - firstOpen.lines_posted} of ${firstOpen.lines_total} lines open` : 'No open GRNs'}
          sub={openCount === 0 ? 'Every GRN is posted' : `${plural(openCount, 'GRN', 'GRNs')} to finish · ${firstOpen?.supplier_name ?? ''}`}
          done={linesPosted} all={linesTotal}
        />
        <TaskCard
          rgb="245, 163, 0" flag="NORMAL PRIORITY" title={['Awaiting', 'supplier']} to="/st/receive" loading={released.isPending}
          line={relCount === 0 ? 'No POs waiting' : firstTwo(rel.map((r) => r.po_number))}
          sub={relCount === 0 ? 'Every released PO is acknowledged' : `${plural(relCount, 'PO', 'POs')} released, not yet acknowledged`}
        />
      </div>
    </GlassCard>
  );
}

// ------------------------------------------------------------------ Row 1 · Arriving (177:139336)
function Arriving({ pos }: { pos: ReturnType<typeof useReceivablePos> }) {
  const rows = (pos.data?.rows ?? []).slice(0, 4);
  return (
    <GlassCard className="flex w-[460px] shrink-0 flex-col items-start gap-[16px] p-[24px]">
      <CardHead title="Arriving" right={<span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">Shipped · acknowledged</span>} />
      {pos.isError ? (
        <div className="flex w-full flex-1 items-center justify-center">
          <ErrorState title="Couldn't load POs" body={errorBody(pos.error)} onRetry={() => pos.refetch()} retrying={pos.isFetching} />
        </div>
      ) : pos.isPending ? (
        <div className="flex w-full flex-col gap-[16px]">{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex flex-col gap-[6px]"><Skel w={240} /><Skel w={150} h={10} /></div>)}</div>
      ) : rows.length === 0 ? (
        <div className="flex w-full flex-1 items-center justify-center">
          <EmptyState icon={IconTruckDelivery} title="Nothing on the way" body="Shipped and acknowledged purchase orders show up here." className="w-full px-0 py-0" />
        </div>
      ) : (
        <div className="flex w-full flex-col gap-[4px]">
          {rows.map((r) => {
            const sh = r.latest_shipment;
            const exp = expected(r);
            const detail = [
              sh ? [sh.carrier, sh.awb_or_lr_number].filter(Boolean).join(' · ') : null,
              exp ? `Expected ${formatDayMonth(exp)}` : null,
              plural(r.lines_total, 'line', 'lines'),
            ].filter(Boolean).join(' · ');
            return (
              <Link key={r.po_id} to={r.can_receive ? `/st/receive/${r.po_id}` : '/st/receive'} className="flex w-full items-center gap-[12px] rounded-[14px] px-[14px] py-[10px] hover:bg-subtle">
                <div className="flex min-w-px flex-1 flex-col gap-[2px] overflow-clip">
                  <p className="truncate text-[14px] font-medium leading-[20px] text-fg">{r.po_number} · {r.supplier_name}</p>
                  <p className="truncate text-[12px] leading-[16px] text-fg-2">{detail}</p>
                </div>
                <PoBadge status={r.po_status} />
              </Link>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

// ------------------------------------------------------------------ Row 2
function GrnList({ q, empty, when }: {
  q: ReturnType<typeof useGrns>; empty: { title: string; body: string }; when?: (g: StoresGrnRow) => string;
}) {
  const rows = (q.data?.rows ?? []).slice(0, 6);
  if (q.isError) {
    return (
      <div className="flex w-full flex-1 items-center justify-center">
        <ErrorState title="Couldn't load GRNs" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
      </div>
    );
  }
  if (q.isPending) return <div className="flex w-full flex-col gap-[14px]">{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex flex-col gap-[6px]"><Skel w={120} /><Skel w={200} h={10} /></div>)}</div>;
  if (rows.length === 0) {
    return (
      <div className="flex min-h-px w-full flex-1 items-center justify-center">
        <EmptyState icon={IconClipboardCheck} title={empty.title} body={empty.body} className="w-full px-0 py-0" />
      </div>
    );
  }
  return (
    <div className="flex min-h-px w-full flex-1 flex-col overflow-y-auto">
      {rows.map((g, i) => (
        <Link
          key={g.grn_id}
          to={`/st/grns/${g.grn_id}`}
          className={cx('flex w-full items-center gap-[12px] py-[12px] hover:bg-subtle', i < rows.length - 1 && 'border-b border-line')}
        >
          <div className="flex min-w-px flex-1 flex-col gap-[2px] overflow-clip">
            <p className="font-mono text-[13px] font-medium leading-[18px] text-fg">{g.grn_number}</p>
            <p className="truncate text-[12px] leading-[16px] text-fg-2">
              {when ? when(g) : `${g.po_number} · ${g.supplier_name} · ${g.lines_posted} of ${g.lines_total} lines posted`}
            </p>
          </div>
          <GrnBadge status={g.grn_status} posted={g.lines_posted} total={g.lines_total} />
        </Link>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ page
export function StoresDashboardPage() {
  const { me, companyCode } = useAuth();
  const ready = useReceivablePos({ status: ['SHIPPED', 'ACKNOWLEDGED'], page_size: LIST });
  const released = useReceivablePos({ status: ['RELEASED'], page_size: LIST });
  const open = useGrns({ status: ['OPEN', 'PARTIAL'], page_size: LIST });
  const posted = useGrns({ status: ['POSTED'], page_size: 6 });
  const shipped = ready.data?.counts_by_status.SHIPPED;
  const meta = ['Receiving bay', companyCode, shipped != null ? `${plural(shipped, 'shipment', 'shipments')} in transit` : null].filter(Boolean).join(' · ');
  const allFailed = ready.isError && open.isError && !ready.data && !open.data;

  return (
    <>
      <PageHeader title={greeting(me?.full_name)} meta={meta} />
      <PageContent>
        {allFailed ? (
          <StateCard>
            <ErrorState
              title="Couldn't load the dashboard"
              body={errorBody(ready.error)}
              onRetry={() => { void ready.refetch(); void open.refetch(); void released.refetch(); void posted.refetch(); }}
              retrying={ready.isFetching}
            />
          </StateCard>
        ) : (
          <>
            <div className="flex h-[350px] w-full items-stretch gap-[20px]">
              <TodaysPriorities pos={ready} grns={open} released={released} />
              <Arriving pos={ready} />
            </div>
            <div className="flex h-[438px] w-full items-start gap-[20px]">
              <Row2Card title="Open GRNs" to="/st/grns" gap={12}>
                <GrnList q={open} empty={{ title: 'No open GRNs', body: 'GRNs with lines still to inspect and post show up here.' }} />
              </Row2Card>
              <Row2Card title="Quarantine" to={null} gap={12}>
                <div className="flex min-h-px w-full flex-1 items-center justify-center">
                  <EmptyState icon={IconPackageImport} title="Not available yet" body="Held and rejected stock will be listed here once the Quarantine feature is scoped." className="w-full px-0 py-0" />
                </div>
                <GapNote code="GAP-STD-1">No Stores-readable quarantine list exists, and supplier returns / hold release are undecided (pending client decision).</GapNote>
              </Row2Card>
              <Row2Card title="Recently posted" to="/st/grns" gap={12}>
                <GrnList
                  q={posted}
                  empty={{ title: 'Nothing posted yet', body: 'Posted GRNs show up here.' }}
                  when={(g) => `${g.po_number} · ${g.supplier_name} · received ${formatDayTime(g.received_at)} by ${g.received_by_name}`}
                />
                <GapNote code="GAP-STD-2">There is no Stores activity feed: this card lists the latest fully posted GRNs instead.</GapNote>
              </Row2Card>
            </div>
          </>
        )}
      </PageContent>
    </>
  );
}
