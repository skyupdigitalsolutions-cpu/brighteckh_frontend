// GL0 · GRNs (177:139959). Data: GET /stores/grns (newest received first).
// Table card 177:139963 = glass-strong, radius 24, p-16, no shadow; columns GRN 120 · PO 110 · Supplier grow · Lines 80 ·
// Received 160 · Status 170 (gap 12). Rows open the GRN (STG1–STG7). Status = server-derived grn_status
// (OPEN / PARTIAL "n OF m POSTED" / POSTED).
import { useState } from 'react';
import { IconInbox } from '@tabler/icons-react';
import { formatDayTime } from '../../../lib/format';
import {
  ButtonLink, EmptyState, ErrorState, PageContent, PageHeader, Pagination, SkeletonRows, TD, TH, THead, TR, errorBody,
} from '../../../ui/desktop';
import { useGrns, type StoresGrnRow } from '../api';
import { GrnBadge, StoresTableCard } from '../ui';

const GAP = 12;
const COLS = { grn: 120, po: 110, lines: 80, received: 160, status: 170 };
const PAGE_SIZE = 25;

export function GrnListPage() {
  const [page, setPage] = useState(1);
  const q = useGrns({ page, page_size: PAGE_SIZE });
  const rows = q.data?.rows ?? [];
  const pages = q.data ? Math.ceil(q.data.total / PAGE_SIZE) : 0;

  return (
    <>
      <PageHeader title="Goods receipts (GRN)" meta="Every receipt at the bay · open ones need inspection" />
      <PageContent>
        <StoresTableCard radius={24}>
          {q.isError ? (
            <div className="flex flex-1 items-center justify-center">
              <ErrorState title="Couldn't load GRNs" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
            </div>
          ) : !q.isPending && rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={IconInbox}
                title="No GRNs yet"
                body="Create a GRN from Receive when a shipment reaches the bay."
                action={<ButtonLink to="/st/receive" kind="secondary">Go to Receive</ButtonLink>}
              />
            </div>
          ) : (
            <>
              <THead gap={GAP}>
                <TH w={COLS.grn}>GRN</TH>
                <TH w={COLS.po}>PO</TH>
                <TH grow>Supplier</TH>
                <TH w={COLS.lines}>Lines</TH>
                <TH w={COLS.received}>Received</TH>
                <TH w={COLS.status}>Status</TH>
              </THead>
              {q.isPending ? <SkeletonRows rows={6} widths={[90, 80, 260, 30, 110, 110]} /> : (
                <div className={q.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
                  {rows.map((r) => <GrnRow key={r.grn_id} r={r} />)}
                </div>
              )}
              {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
            </>
          )}
        </StoresTableCard>
      </PageContent>
    </>
  );
}

function GrnRow({ r }: { r: StoresGrnRow }) {
  return (
    <TR to={`/st/grns/${r.grn_id}`} gap={GAP}>
      <TD w={COLS.grn} kind="id">{r.grn_number}</TD>
      <TD w={COLS.po}><span className="whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-fg-2">{r.po_number}</span></TD>
      <TD grow kind="strong">{r.supplier_name}</TD>
      <TD w={COLS.lines}><span className="font-mono text-[14px] leading-[20px] text-fg-2">{r.lines_total}</span></TD>
      <TD w={COLS.received} kind="text">{formatDayTime(r.received_at)}</TD>
      <TD w={COLS.status}><GrnBadge status={r.grn_status} posted={r.lines_posted} total={r.lines_total} /></TD>
    </TR>
  );
}
