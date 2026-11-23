// SD0 · Sales dashboard (/s) — Figma 177:137225, content 177:137228.
// Row 1 (177:137229): Today's priorities (177:137230, 3 gradient task cards, glass 0.92, p-24, gap 16) + Quote outcomes
// (177:137266, 460 wide, legend + 190px rings).
// Row 2 (177:137294): To send (177:137295) · Awaiting response (177:137321) · Latest activity (177:137340); p-24, gap 6/14.
//
// Data: GET /sales/quotes only (contract: sales-contract.md §A) — raw counts and real rows, no targets.
//   - counts: `counts_by_stage` (whole scope, no date window) from the TO_SEND query.
//   - Send quotes / To send list: stage=TO_SEND (server order = oldest release first).
//   - Chase replies / Awaiting list: stage=AWAITING (server order = newest sent first); the oldest is the last row of
//     the stage (a second page_size=1 query on the last page).
//   - Expiring soon: stage=TO_SEND,AWAITING,IN_DISCUSSION with valid_until_before = today + 8 (IST) — i.e. valid until
//     within the next 7 days, incl. already past; soonest shown. The 7-day window is a display choice (GapNote).
// Deviations (each also a GapNote on screen where it hides a drawn element):
//   - Task-card progress bars ("0 / 3") are not drawn: no "done today" count exists for Sales (no overview endpoint).
//   - "awaiting > 2 days": no chase rule; every AWAITING quote counts, the oldest is shown with its raw age.
//   - Quote outcomes "Last 30 days": counts are current stages over all your quotes, no date window.
//     IN_DISCUSSION has no ring in Figma; it is listed under the legend so the rows add up.
//   - Latest activity: no Sales-readable activity feed (GapNote, card kept empty).
//   - Amounts are pre-tax (revised_pre_tax), not totals incl. tax (total composition open, G-D-2).
//   - Badges show sales_stage ("TO SEND", "AWAITING") where Figma draws BR-04 statuses ("RELEASED TO SALES", "SENT").
import { Link } from 'react-router-dom';
import { IconInbox, IconSend } from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthProvider';
import { formatINR } from '../../../lib/format';
import { cx, EmptyState, ErrorState, GapNote, GlassCard, PageContent, PageHeader, StateCard, errorBody } from '../../../ui/desktop';
import {
  ageText, agoText, dayMonth, istDate, useSalesQuotes, type SalesQuotePage, type SalesQuoteRow, type SalesStageCounts,
} from '../api';
import { CardHead, SeeAll, Skel, StageBadge } from '../ui';

function greeting(fullName: string | undefined, now = new Date()) {
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ------------------------------------------------------------------ Row 1 · Today's priorities
// Task card (177:137236): 1px tone/.35 border, 138° gradient tone/.34 → tone/.10, p-20, radius 22, gap 14.
// Flag chip white/.75 radius 12 px-10 py-4 11/14 SemiBold; title 30/34 Medium; line 1 14/20 Medium #18181b;
// line 2 14/20 Regular #3f3f46. Literal Figma colours: red #da4a3c, purple #7b6fd6, amber #f5a300.
function TaskCard({ rgb, flag, title, to, line1, line2, loading }: {
  rgb: string; flag: string; title: [string, string]; to: string; line1?: string; line2?: string; loading: boolean;
}) {
  return (
    <Link
      to={to}
      className="flex min-w-px flex-1 flex-col items-start gap-[14px] overflow-clip rounded-[22px] border p-[20px]"
      style={{
        borderColor: `rgba(${rgb}, 0.35)`,
        backgroundImage: `linear-gradient(138.08deg, rgba(${rgb}, 0.34) 14.286%, rgba(${rgb}, 0.1) 85.714%)`,
      }}
    >
      <span className="flex shrink-0 items-start overflow-clip rounded-[12px] bg-dash-pill px-[10px] py-[4px]">
        <span className="whitespace-nowrap text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-dash-text">{flag}</span>
      </span>
      <p className="whitespace-nowrap text-[30px] font-medium leading-[34px] text-dash-text">{title[0]}<br />{title[1]}</p>
      {loading ? (
        <>
          <span className="flex h-[20px] items-center"><Skel w={150} dark /></span>
          <span className="flex h-[20px] items-center"><Skel w={120} dark /></span>
        </>
      ) : (
        <>
          <p className="max-w-full truncate whitespace-nowrap text-[14px] font-medium leading-[20px] text-dash-text">{line1}</p>
          <p className="max-w-full truncate whitespace-nowrap text-[14px] leading-[20px] text-dash-text-2">{line2 ?? ' '}</p>
        </>
      )}
    </Link>
  );
}

function validityText(r: SalesQuoteRow, today: string) {
  if (!r.valid_until) return `${r.quote_number}`;
  return r.valid_until < today ? `${r.quote_number} validity passed ${dayMonth(r.valid_until)}` : `${r.quote_number} valid until ${dayMonth(r.valid_until)}`;
}

function TodaysPriorities({ toSend, awaiting, oldestAwaiting, expiring, loading }: {
  toSend?: SalesQuotePage; awaiting?: SalesQuotePage; oldestAwaiting?: SalesQuoteRow; expiring?: SalesQuotePage; loading: boolean;
}) {
  const today = istDate();
  const oldestToSend = toSend?.rows[0];
  const soonest = [...(expiring?.rows ?? [])].sort((a, b) => (a.valid_until ?? '').localeCompare(b.valid_until ?? ''))[0];
  const awaitingCustomers = [...new Set((awaiting?.rows ?? []).map((r) => r.customer_name))];
  const nExp = expiring?.total ?? 0;
  return (
    <GlassCard className="flex min-w-px flex-1 flex-col items-start gap-[16px] bg-dash-card p-[24px]">
      <CardHead title="Today's priorities" right={<SeeAll to="/s/to-send" />} />
      <div className="flex w-full items-start gap-[16px] overflow-clip">
        <TaskCard
          rgb="218, 74, 60" flag="URGENT PRIORITY" title={['Send', 'quotes']} to="/s/to-send" loading={loading}
          line1={toSend ? `${toSend.total} released by Purchase` : undefined}
          line2={oldestToSend ? `Oldest: ${oldestToSend.quote_number} · ${ageText(oldestToSend.released_to_sales_at)}` : 'Nothing waiting'}
        />
        <TaskCard
          rgb="123, 111, 214" flag="HIGH PRIORITY" title={['Chase', 'replies']} to="/s/sent?stage=AWAITING" loading={loading}
          line1={awaiting ? `${plural(awaiting.total, 'quote', 'quotes')} awaiting a reply` : undefined}
          line2={oldestAwaiting
            ? `Oldest: ${oldestAwaiting.quote_number} · sent ${agoText(oldestAwaiting.sent_at)}`
            : awaitingCustomers.length ? awaitingCustomers.join(' · ') : 'No replies pending'}
        />
        <TaskCard
          rgb="245, 163, 0" flag="NORMAL PRIORITY" title={['Expiring', 'soon']}
          to={soonest ? (soonest.sales_stage === 'TO_SEND' ? `/s/to-send?q=${soonest.quote_id}` : `/s/quotes/${soonest.quote_id}`) : '/s/sent'}
          loading={loading}
          line1={soonest ? validityText(soonest, today) : 'Nothing expiring in 7 days'}
          line2={soonest ? `${soonest.customer_name} · ${formatINR(soonest.revised_pre_tax)}${nExp > 1 ? ` · +${nExp - 1} more` : ''}` : undefined}
        />
      </div>
      <div className="flex w-full flex-col gap-[8px]">
        <GapNote code="G-S4">No progress bars: Sales has no overview endpoint, so there is no “done today” count to measure against.</GapNote>
        <GapNote code="CHASE">No chase rule exists (Figma “awaiting &gt; 2 days”). Every awaiting quote is counted; the oldest shows its raw age since sending.</GapNote>
        <GapNote code="EXPIRY">“Soon” = valid until within the next 7 days, including dates already passed. This is a display window, not a business rule — nothing expires a quote automatically.</GapNote>
      </div>
    </GlassCard>
  );
}

// ------------------------------------------------------------------ Row 1 · Quote outcomes
// Legend (177:137271, gap 18): 10px dot + 14/20 secondary label; value Data/Number 22/24 SemiBold "45%  ·  9".
// Rings 190×190 (177:137287): outer teal = Accepted, middle purple = Awaiting, inner red = Rejected / expired.
const OUTCOMES = [
  { key: 'accepted', label: 'Accepted', colour: '#2BA597', r: 92, count: (c: SalesStageCounts) => c.ACCEPTED },
  { key: 'awaiting', label: 'Awaiting', colour: '#7B6FD6', r: 70, count: (c: SalesStageCounts) => c.AWAITING },
  { key: 'closed', label: 'Rejected / expired', colour: '#DA4A3C', r: 48, count: (c: SalesStageCounts) => c.REJECTED + c.EXPIRED },
] as const;

function arcPath(r: number, f: number) {
  const a = Math.min(f, 0.9999) * 2 * Math.PI;
  const x = 100 + r * Math.sin(a);
  const y = 100 - r * Math.cos(a);
  return `M 100 ${100 - r} A ${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(3)} ${y.toFixed(3)}`;
}

function QuoteOutcomes({ counts }: { counts?: SalesStageCounts }) {
  const sent = counts ? counts.AWAITING + counts.IN_DISCUSSION + counts.ACCEPTED + counts.REJECTED + counts.EXPIRED : 0;
  const pct = (n: number) => `${sent > 0 ? Math.round((n / sent) * 100) : 0}%`;
  return (
    <Link to="/s/sent" className="glass flex w-[460px] shrink-0 flex-col items-start gap-[16px] self-stretch overflow-clip rounded-t-card p-[24px]">
      <CardHead
        title="Quote outcomes"
        right={counts
          ? <p className="shrink-0 whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{plural(sent, 'sent quote', 'sent quotes')} · now</p>
          : <Skel w={90} />}
      />
      <div className="flex min-h-px w-full flex-1 items-center gap-[16px] overflow-clip">
        <div className="flex min-w-px flex-1 flex-col items-start gap-[18px] overflow-clip">
          {OUTCOMES.map((o) => (
            <div key={o.key} className="flex shrink-0 flex-col items-start gap-[2px] overflow-clip">
              <div className="flex items-center gap-[8px] overflow-clip">
                <span className="h-[10px] w-[10px] shrink-0 rounded-full" style={{ backgroundColor: o.colour }} aria-hidden />
                <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{o.label}</span>
              </div>
              {counts
                ? <span className="whitespace-pre font-mono text-[22px] font-semibold leading-[24px] text-fg">{`${pct(o.count(counts))}  ·  ${o.count(counts)}`}</span>
                : <span className="flex h-[24px] items-center"><Skel w={100} h={18} /></span>}
            </div>
          ))}
          {counts && counts.IN_DISCUSSION > 0 && (
            <p className="text-[12px] leading-[16px] text-fg-muted">+ {counts.IN_DISCUSSION} in discussion ({pct(counts.IN_DISCUSSION)})</p>
          )}
        </div>
        <svg width={190} height={190} viewBox="0 0 200 200" className="h-[190px] w-[190px] shrink-0" aria-hidden>
          {OUTCOMES.map((o) => {
            const f = counts && sent > 0 ? o.count(counts) / sent : 0;
            return (
              <g key={o.key}>
                <circle cx={100} cy={100} r={o.r} fill="none" style={{ stroke: 'var(--color-chart-track)' }} strokeWidth={16} />
                {f > 0 && <path d={arcPath(o.r, f)} fill="none" stroke={o.colour} strokeWidth={16} strokeLinecap="butt" />}
              </g>
            );
          })}
        </svg>
      </div>
      <GapNote code="G-S4">Figma shows the last 30 days; these are the current stages of every quote released to you — the API has no date window.</GapNote>
    </Link>
  );
}

// ------------------------------------------------------------------ Row 2
// List row (177:137300): py-12, gap 12, 1px bottom border (not on the last row); "Q-00087" Data/ID + amount
// Data/Number secondary (gap 8); sub-line 12/16 secondary; badge right.
function QuoteListRow({ r, to, sub, last }: { r: SalesQuoteRow; to: string; sub: string; last: boolean }) {
  return (
    <Link to={to} className={cx('flex w-full shrink-0 items-center gap-[12px] overflow-clip py-[12px]', !last && 'border-b border-line')}>
      <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
        <div className="flex items-center gap-[8px] overflow-clip">
          <span className="font-mono text-[13px] font-medium leading-[18px] text-fg">{r.quote_number}</span>
          <span className="font-mono text-[14px] leading-[20px] text-fg-2" title="Pre-tax">{formatINR(r.revised_pre_tax)}</span>
        </div>
        <p className="max-w-full truncate text-[12px] leading-[16px] text-fg-2">{sub}</p>
      </div>
      <StageBadge stage={r.sales_stage} />
    </Link>
  );
}

function ListCard({ title, seeAll, q, empty, to, sub }: {
  title: string; seeAll: string;
  q: { data?: SalesQuotePage; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown; isFetching: boolean };
  empty: { icon: typeof IconSend; title: string; body: string };
  to: (r: SalesQuoteRow) => string; sub: (r: SalesQuoteRow) => string;
}) {
  const rows = q.data?.rows ?? [];
  return (
    <GlassCard className="flex h-full min-w-px flex-1 flex-col items-start gap-[6px] p-[24px]">
      <CardHead title={title} right={<SeeAll to={seeAll} />} />
      {q.isPending ? (
        Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex w-full flex-col gap-[6px] py-[12px]"><Skel w={160} /><Skel w={110} h={10} /></div>
        ))
      ) : q.isError ? (
        <div className="flex min-h-px w-full flex-1 items-center justify-center">
          <ErrorState title={`Couldn't load ${title.toLowerCase()}`} body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-px w-full flex-1 items-center justify-center">
          <EmptyState icon={empty.icon} title={empty.title} body={empty.body} className="w-full px-0 py-0" />
        </div>
      ) : (
        <div className="flex min-h-px w-full flex-1 flex-col overflow-y-auto">
          {rows.map((r, i) => <QuoteListRow key={r.quote_id} r={r} to={to(r)} sub={sub(r)} last={i === rows.length - 1} />)}
          {q.data && q.data.total > rows.length && (
            <p className="pt-[10px] text-[12px] leading-[16px] text-fg-muted">Showing {rows.length} of {q.data.total}</p>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function LatestActivity() {
  return (
    <GlassCard className="flex h-full min-w-px flex-1 flex-col items-start gap-[14px] p-[24px]">
      <CardHead title="Latest activity" />
      <GapNote code="G-S4">
        No Sales activity feed: the activity log is only readable through the Purchase overview. The latest reply on each
        quote is on <Link to="/s/responses" className="underline">Responses</Link>.
      </GapNote>
    </GlassCard>
  );
}

// ------------------------------------------------------------------ page
const LIST_SIZE = 5;

export function SalesDashboardPage() {
  const { me } = useAuth();
  const toSendQ = useSalesQuotes({ stage: ['TO_SEND'], page_size: LIST_SIZE });
  const awaitingQ = useSalesQuotes({ stage: ['AWAITING'], page_size: LIST_SIZE });
  const awaitingTotal = awaitingQ.data?.total ?? 0;
  const oldestQ = useSalesQuotes({ stage: ['AWAITING'], page_size: 1, page: Math.max(1, awaitingTotal) }, awaitingTotal > 0);
  const expiringQ = useSalesQuotes({ stage: ['TO_SEND', 'AWAITING', 'IN_DISCUSSION'], valid_until_before: istDate(8), page_size: 100 });

  const counts = toSendQ.data?.counts_by_stage;
  const meta = counts
    ? `Sales · ${plural(counts.TO_SEND, 'quote', 'quotes')} ready to send · ${counts.AWAITING} awaiting a reply`
    : 'Sales';
  const fatal = toSendQ.isError && !toSendQ.data;

  return (
    <>
      <PageHeader title={greeting(me?.full_name)} meta={meta} />
      <PageContent>
        {fatal ? (
          <StateCard>
            <ErrorState title="Couldn't load your quotes" body={errorBody(toSendQ.error)} onRetry={() => toSendQ.refetch()} retrying={toSendQ.isFetching} />
          </StateCard>
        ) : (
          <>
            <div className="flex w-full items-start gap-[20px]" aria-busy={toSendQ.isPending}>
              <TodaysPriorities
                toSend={toSendQ.data}
                awaiting={awaitingQ.data}
                oldestAwaiting={oldestQ.data?.rows[0]}
                expiring={expiringQ.data}
                loading={toSendQ.isPending || awaitingQ.isPending || expiringQ.isPending}
              />
              <QuoteOutcomes counts={counts} />
            </div>
            <div className="flex h-[424px] w-full items-start gap-[20px]">
              <ListCard
                title="To send" seeAll="/s/to-send" q={toSendQ}
                empty={{ icon: IconSend, title: 'Nothing to send', body: 'Quotes appear here when Purchase releases them to you.' }}
                to={(r) => `/s/to-send?q=${r.quote_id}`}
                sub={(r) => `${r.customer_name} · released ${agoText(r.released_to_sales_at)}`}
              />
              <ListCard
                title="Awaiting response" seeAll="/s/sent?stage=AWAITING" q={awaitingQ}
                empty={{ icon: IconInbox, title: 'No replies pending', body: 'Sent quotes without a customer response show here.' }}
                to={(r) => `/s/quotes/${r.quote_id}`}
                sub={(r) => `${r.customer_name}${r.sent_at ? ` · sent ${agoText(r.sent_at)}` : ''}`}
              />
              <LatestActivity />
            </div>
          </>
        )}
      </PageContent>
    </>
  );
}
