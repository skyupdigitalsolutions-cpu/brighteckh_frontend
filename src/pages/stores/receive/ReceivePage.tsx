// STR0 · Receive · POs to receive (177:139392). Data: GET /stores/receivable-pos.
// Table card 177:139396 (radius 28, p-16, no shadow); header + rows gap 12; columns PO 120 · Supplier grow · Lines 80 ·
// Carrier / AWB 240 · Expected 130 · Status 150 · action 150. Note under the rows: 12/16 muted.
// API over Figma:
//   - Status = the PO's po_status. Figma draws "ARRIVED" for shipped POs, which is not a PO status; SHIPPED is shown.
//   - Expected = the latest shipment's expected_arrival_date, else the acknowledgement's expected_delivery_date.
//     Figma's "· arrived" suffix has no API source (nothing records arrival before the GRN) and is not shown.
//   - "Create GRN" shows whenever the API accepts a GRN (can_receive = ACKNOWLEDGED or SHIPPED). Figma draws ACKNOWLEDGED
//     as "Not arrived yet" with no button, but POST /purchase-orders/:id/grns accepts ACKNOWLEDGED POs.
//     RELEASED (not yet acknowledged) rows say so and have no action.
import { useState } from 'react';
import { IconInbox, IconTruckDelivery } from '@tabler/icons-react';
import { formatDayMonth } from '../../../lib/format';
import {
  ButtonLink, EmptyState, ErrorState, Ic, PageContent, PageHeader, Pagination, SkeletonRows, TD, TH, THead, TR, errorBody,
} from '../../../ui/desktop';
import { useReceivablePos, type ReceivablePoRow } from '../api';
import { PoBadge, PricesNote, StoresTableCard } from '../ui';

const GAP = 12;
const COLS = { po: 120, lines: 80, carrier: 240, expected: 130, status: 150, action: 150 };
const PAGE_SIZE = 25;

export function ReceivePage() {
  const [page, setPage] = useState(1);
  const q = useReceivablePos({ page, page_size: PAGE_SIZE });
  const rows = q.data?.rows ?? [];
  const pages = q.data ? Math.ceil(q.data.total / PAGE_SIZE) : 0;

  return (
    <>
      <PageHeader title="Receive shipments" meta="Purchase orders shipped or arriving · create a GRN when goods reach the bay" />
      <PageContent>
        <StoresTableCard>
          {q.isError ? (
            <div className="flex flex-1 items-center justify-center">
              <ErrorState title="Couldn't load purchase orders" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
            </div>
          ) : !q.isPending && rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={IconTruckDelivery}
                title="Nothing to receive"
                body="Purchase orders appear here once Purchase releases them to a supplier. You can create a GRN after the supplier acknowledges."
              />
            </div>
          ) : (
            <>
              <THead gap={GAP}>
                <TH w={COLS.po}>PO</TH>
                <TH grow>Supplier</TH>
                <TH w={COLS.lines}>Lines</TH>
                <TH w={COLS.carrier}>Carrier / AWB</TH>
                <TH w={COLS.expected}>Expected</TH>
                <TH w={COLS.status}>Status</TH>
                <TH w={COLS.action} />
              </THead>
              {q.isPending ? <SkeletonRows rows={6} widths={[90, 260, 30, 200, 90, 110, 120]} /> : (
                <div className={q.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
                  {rows.map((r) => <PoRow key={r.po_id} r={r} />)}
                </div>
              )}
              <PricesNote indent />
              {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
            </>
          )}
        </StoresTableCard>
      </PageContent>
    </>
  );
}

function PoRow({ r }: { r: ReceivablePoRow }) {
  const sh = r.latest_shipment;
  const carrier = sh && (sh.carrier || sh.awb_or_lr_number) ? [sh.carrier, sh.awb_or_lr_number].filter(Boolean).join(' · ') : '—';
  const expected = sh?.expected_arrival_date ?? r.acknowledgement?.expected_delivery_date ?? null;
  return (
    <TR gap={GAP}>
      <TD w={COLS.po} kind="id">{r.po_number}</TD>
      <TD grow kind="strong">{r.supplier_name}</TD>
      <TD w={COLS.lines}><span className="font-mono text-[14px] leading-[20px] text-fg-2">{r.lines_total}</span></TD>
      <TD w={COLS.carrier} kind="text">{carrier}</TD>
      <TD w={COLS.expected} kind="text">{formatDayMonth(expected)}</TD>
      <TD w={COLS.status}><PoBadge status={r.po_status} /></TD>
      <TD w={COLS.action}>
        {r.can_receive
          ? <ButtonLink to={`/st/receive/${r.po_id}`} icon={<Ic icon={IconInbox} size={18} />}>Create GRN</ButtonLink>
          : <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-muted">Not acknowledged yet</span>}
      </TD>
    </TR>
  );
}
