// Job workspace · Material tab — Figma "J2 · Job · Material" 177:116381 (Columns 177:116394).
// Columns gap 20: Left flex (gap 20) = Material request card(s) (177:116396: glass-strong p-24 gap-16 radius 24; head
// 18/24 request number + status badge; line rows bg-subtle radius 16 px-16 py-12 gap-16 = item code Data/ID secondary
// over name 14/20 Medium · quantity Data/Number strong · "IN STORE n UOM" badge) + "Issued to engineer" (177:116413,
// flex-1, empty state "Nothing issued yet"). Right 420 (gap 20) = Next step (177:116418: plain glass-strong card,
// 11/14 "NEXT STEP", 18/24 title, 14/20 secondary detail, full-width primary) + Reservations (177:116423, flex-1).
//
// Data: material requests = GET /material-requests filtered by job_id + GET /material-requests/{id} (gap G-MR-1, no
// per-job read); in-store = the current BR-04 stock check line (available_to_allocate) or the MR line's
// available_stock_snapshot; issues = GET /jobs/{id}/material-issues; reservations = GET /jobs/{id}/reservations with item
// names via GET /jobs/{id}/stock-rechecks lines; item names = GET /lookups/item-bridge?ids=.
// Writes here: POST /material-requests/{id}/start-processing (PURCHASE) from the Next step card. Everything else links
// to the tab that owns it (stock check / RFQ = Sourcing, reserve = Authorisation).
// Deviations: Figma "Open request" button is not drawn — there is no Purchase material-request screen yet (D·P3 inbox
// is unbuilt). Change requests show the engineer's reason: proposed_change is free-form JSON, so no "2 → 3" diff.
import type { ReactNode } from 'react';
import { IconPackage, IconPlayerPlay, IconStack2 } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { useJobWorkspace } from '../job/JobWorkspace';
import { useItemBridgeByIds, useStockChecks, useEmployeesByIds } from '../api';
import { Badge, StatusPill } from '../../../ui/desktop/Badge';
import { Button, ButtonLink } from '../../../ui/desktop/Button';
import { EmptyState, ErrorState, errorBody } from '../../../ui/desktop/States';
import { FormErrors, GapNote, InlineAlert } from '../../../ui/desktop/Feedback';
import { Ic } from '../../../ui/desktop/Icon';
import type { Tone } from '../../../lib/tones';
import { formatDayTime, formatQty } from '../../../lib/format';
import { TabSkeleton } from './ui';
import {
  useJobMaterial, useJobMaterialRequests, useJobReservations, useJobStockRechecks, useStartMrProcessing,
  type MaterialRequest, type Reservation,
} from './data';

const card = 'glass-strong flex w-full flex-col items-start gap-[16px] overflow-clip rounded-[24px] p-[24px]';
const h2 = 'min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg';
const RES_TONE: Record<Reservation['reservation_status'], Tone> = { PROPOSED: 'neutral', COMMITTED: 'success', RELEASED: 'neutral', CANCELLED: 'blocked' };

export function MaterialTab() {
  const { job } = useJobWorkspace();
  const me = useMe();
  const isPurchase = can.purchaseWork(me.role);
  const mrQ = useJobMaterialRequests(job.id);
  const matQ = useJobMaterial(job.id);
  const checksQ = useStockChecks(job.id);
  const resQ = useJobReservations(job.id, isPurchase);
  const recheckQ = useJobStockRechecks(job.id, isPurchase);

  const mrs = mrQ.data ?? [];
  const currentCheck = checksQ.data?.find((c) => c.is_current) ?? checksQ.data?.[0];
  const recheckLines = (recheckQ.data ?? []).flatMap((r) => r.lines);
  const itemIds = [
    ...mrs.flatMap((m) => m.lines.map((l) => l.item_bridge_id)),
    ...(matQ.data?.issues.map((i) => i.item_bridge_id) ?? []),
    ...recheckLines.map((l) => l.item_bridge_id),
  ];
  const itemsQ = useItemBridgeByIds(itemIds);
  const item = (id: string) => itemsQ.data?.[id];

  if (mrQ.isPending || matQ.isPending) return <TabSkeleton right={420} />;

  return (
    <div className="flex min-h-[738px] w-full flex-1 items-stretch gap-[20px]">
      <div className="flex min-w-px flex-1 flex-col gap-[20px]">
        {mrQ.isError ? (
          <section className={card}><ErrorState title="Couldn't load the material request" body={errorBody(mrQ.error)} onRetry={() => mrQ.refetch()} retrying={mrQ.isFetching} /></section>
        ) : mrs.length === 0 ? (
          <section className={card}>
            <div className="flex w-full items-center gap-[10px] overflow-clip"><h2 className={h2}>Material request</h2></div>
            <div className="flex w-full justify-center"><EmptyState icon={IconPackage} title="No material request yet" body="The engineer raises it from the mobile app after the inspection report. Its lines appear here." /></div>
          </section>
        ) : mrs.map((mr) => (
          <section key={mr.id} className={card}>
            <div className="flex w-full items-center gap-[10px] overflow-clip">
              <h2 className={h2}>{mr.request_number}</h2>
              {mr.priority !== 'NORMAL' && <Badge tone={mr.priority === 'CRITICAL' ? 'blocked' : 'progress'} label={mr.priority} />}
              <StatusPill domain="materialRequest" value={mr.status} />
            </div>
            {mr.lines.map((l) => {
              const it = item(l.item_bridge_id);
              const sc = currentCheck?.lines.find((x) => x.material_request_line_id === l.id);
              const avail = sc?.available_to_allocate ?? l.available_stock_snapshot;
              const enough = avail != null && Number(avail) >= Number(l.quantity);
              return (
                <div key={l.id} className="flex w-full items-center gap-[16px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px]">
                  <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
                    <span className="font-mono text-[13px] font-medium leading-[18px] text-fg-2">{it?.item_code ?? '…'}</span>
                    <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{it?.item_name ?? 'Loading item…'}</span>
                    {(l.preferred_manufacturer || l.preferred_part_number) && (
                      <span className="truncate text-[12px] leading-[16px] text-fg-2">Preferred: {[l.preferred_manufacturer, l.preferred_part_number].filter(Boolean).join(' ')}</span>
                    )}
                  </div>
                  <span className="shrink-0 whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatQty(l.quantity, l.uom_snapshot)}</span>
                  {avail != null && <Badge tone={enough ? 'success' : 'blocked'} label={`IN STORE ${formatQty(avail, l.uom_snapshot)}`} />}
                </div>
              );
            })}
            <ChangeRequests mr={mr} />
          </section>
        ))}

        <section className={`${card} min-h-px flex-1`}>
          <div className="flex w-full items-center overflow-clip"><h2 className={h2}>Issued to engineer</h2></div>
          {matQ.isError ? (
            <ErrorState title="Couldn't load issued material" body={errorBody(matQ.error)} onRetry={() => matQ.refetch()} retrying={matQ.isFetching} />
          ) : !matQ.data || matQ.data.issues.length === 0 ? (
            <div className="flex w-full justify-center"><EmptyState icon={IconPackage} title="Nothing issued yet" body="Material is issued after the job is authorised and stock is reserved." /></div>
          ) : matQ.data.issues.map((i) => {
            const it = item(i.item_bridge_id);
            const pendingReturn = Number(i.return_pending_quantity) > 0;
            return (
              <div key={i.id} className="flex w-full items-center gap-[16px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px]">
                <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
                  <span className="font-mono text-[13px] font-medium leading-[18px] text-fg-2">{it?.item_code ?? '…'}</span>
                  <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{it?.item_name ?? 'Loading item…'}</span>
                  <span className="text-[12px] leading-[16px] text-fg-2">
                    Used {formatQty(i.consumed_quantity)} · returned {formatQty(i.returned_quantity)}{pendingReturn ? ` · ${formatQty(i.return_pending_quantity)} return pending` : ''} · {formatDayTime(i.posted_at ?? i.created_at)}
                  </span>
                </div>
                <span className="shrink-0 whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatQty(i.issued_quantity, i.uom)}</span>
                <StatusPill domain="issue" value={i.issue_status} />
              </div>
            );
          })}
        </section>
      </div>

      <div className="flex w-[420px] shrink-0 flex-col gap-[20px] overflow-clip">
        <NextStep mrs={mrs} hasCheck={!!currentCheck} hasShortage={!!currentCheck?.lines.some((l) => Number(l.shortage_quantity) > 0)} reservations={resQ.data} issued={(matQ.data?.issues.length ?? 0) > 0} isPurchase={isPurchase} />
        <section className={`${card} min-h-px flex-1`}>
          <div className="flex w-full items-center overflow-clip"><h2 className={h2}>Reservations</h2></div>
          {!isPurchase ? (
            <p className="text-[14px] leading-[20px] text-fg-2">Reservations are visible to Purchase only.</p>
          ) : resQ.isError ? (
            <p className="text-[12px] leading-[16px] text-st-blocked-fg">{errorBody(resQ.error)}</p>
          ) : resQ.isPending ? (
            <p className="text-[14px] leading-[20px] text-fg-2">Loading…</p>
          ) : (resQ.data ?? []).length === 0 ? (
            <p className="text-[14px] leading-[20px] text-fg-2">None yet — reserved after authorisation.</p>
          ) : resQ.data!.map((r) => {
            const line = recheckLines.find((l) => l.id === r.stock_recheck_line_id);
            const it = line ? item(line.item_bridge_id) : undefined;
            return (
              <div key={r.id} className="flex w-full items-center gap-[12px] overflow-clip">
                <div className="flex min-w-px flex-1 flex-col items-start overflow-clip whitespace-nowrap">
                  <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{it?.item_name ?? 'Item'}</span>
                  <span className="font-mono text-[13px] font-medium leading-[18px] text-fg-2">{formatQty(r.reserved_quantity, line?.uom)}</span>
                </div>
                <Badge tone={RES_TONE[r.reservation_status]} label={r.reservation_status} />
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function ChangeRequests({ mr }: { mr: MaterialRequest }) {
  const pending = mr.change_requests.filter((c) => c.review_status === 'PENDING');
  const empQ = useEmployeesByIds(pending.map((c) => c.requested_by_id));
  if (pending.length === 0) return null;
  return (
    <>
      {pending.map((c) => (
        <InlineAlert key={c.id} tone="progress" title={`Change requested${empQ.data?.[c.requested_by_id] ? ` by ${empQ.data[c.requested_by_id]!.full_name}` : ''}`}>
          {c.change_reason}
        </InlineAlert>
      ))}
      <GapNote code="UI-MR">Reviewing a change request (POST /material-requests/{'{id}'}/change-requests/{'{crId}'}/review) belongs to the Material requests screen (Figma D·P3), which isn&apos;t built yet.</GapNote>
    </>
  );
}

function NextStep({ mrs, hasCheck, hasShortage, reservations, issued, isPurchase }: {
  mrs: MaterialRequest[]; hasCheck: boolean; hasShortage: boolean; reservations: Reservation[] | undefined; issued: boolean; isPurchase: boolean;
}) {
  const { job } = useJobWorkspace();
  const start = useStartMrProcessing(job.id);
  const mr = mrs[0];
  const base = `/p/jobs/${job.id}`;
  const committed = (reservations ?? []).some((r) => r.reservation_status === 'COMMITTED');
  let title: string; let detail: ReactNode = null; let action: ReactNode = null;

  if (!mr) { title = 'Waiting for the material request'; detail = 'Raised by the engineer after the inspection report is accepted.'; }
  else if (mr.status === 'SUBMITTED') {
    title = 'Start processing the request';
    detail = `${mr.lines.length} ${mr.lines.length === 1 ? 'line' : 'lines'} submitted ${formatDayTime(mr.submitted_at)}. Starting locks it from engineer edits.`;
    if (isPurchase) action = <Button kind="primary" block busy={start.isPending} icon={<Ic icon={IconPlayerPlay} size={18} />} onClick={() => start.mutate(mr.id)}>Start processing</Button>;
  } else if (mr.change_requests.some((c) => c.review_status === 'PENDING')) {
    title = 'Review the change request'; detail = 'The engineer asked to change this request — see the note on the request card.';
  } else if (!hasCheck) {
    const short = mr.lines.filter((l) => l.available_stock_snapshot != null && Number(l.available_stock_snapshot) < Number(l.quantity)).length;
    title = 'Run a stock check';
    detail = short ? `${short} ${short === 1 ? 'line is' : 'lines are'} not in store. Snapshot stock, then raise an RFQ for the shortage.` : 'Snapshot stock against the request lines before quoting.';
    if (isPurchase) action = <ButtonLink to={`${base}/sourcing`} icon={<Ic icon={IconStack2} size={18} />} className="w-full">Run stock check</ButtonLink>;
  } else if (!committed && !issued) {
    title = hasShortage ? 'Source the shortage, then quote' : 'Quote and get authorisation';
    detail = hasShortage ? 'The stock check found a shortage. Raise an RFQ on the Sourcing tab.' : 'Stock covers the request. Material is reserved once the customer authorises the job.';
    action = <ButtonLink to={`${base}/${hasShortage ? 'sourcing' : 'authorisation'}`} kind="secondary" className="w-full">{hasShortage ? 'Open sourcing' : 'Open authorisation'}</ButtonLink>;
  } else if (!issued) {
    title = 'Issue reserved material'; detail = 'Stock is reserved for this job. Issue it to the engineer when repair starts.';
  } else { title = 'Material is with the engineer'; detail = 'Consumption and returns appear as the engineer records them.'; }

  return (
    <section className="glass-strong flex w-full shrink-0 flex-col items-start gap-[16px] overflow-clip rounded-[24px] p-[24px]">
      <p className="whitespace-nowrap text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-fg-2">NEXT STEP</p>
      <h2 className="text-[18px] font-semibold leading-[24px] text-fg">{title}</h2>
      {detail && <p className="text-[14px] leading-[20px] text-fg-2">{detail}</p>}
      <FormErrors error={start.error} title="Couldn't start processing" />
      {action}
    </section>
  );
}
