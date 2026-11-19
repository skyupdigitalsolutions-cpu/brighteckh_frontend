// POUT0 · Outwards (PS-D 238:41629): list 246:49514 · loading 49826 · empty 50134 · error 50410 · create drawer 50686.
// Data: GET /sales-supply/outwards (search + paging, newest first). The create drawer opens from "New outward" and
// automatically on ?create=<orderId> (stage B's "Create outward" button).
// Columns (Header row 246:49757, gap 10): Outward 180 · Customer grow · Order 150 · Lines 60 (right) · Mode 150 ·
// Dispatched 170 · Status 150. DRAFT / CANCELLED-before-dispatch rows have no number → "Draft · not numbered" (Data/ID).
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconPackage, IconPlus, IconSearch } from '@tabler/icons-react';
import { enumLabel, formatDateTime } from '../../../lib/format';
import {
  Button, EmptyState, ErrorState, Ic, PageContent, PageHeader, Pagination, SearchField, SkeletonRows, StatusPill, errorBody,
} from '../../../ui/desktop';
import { useOutwards, type OutwardRow } from '../api';
import { SupplyTabs } from '../ui';
import { CreateOutwardDrawer } from './CreateOutwardDrawer';
import { T } from './text';
import { HeadRow, ListCard, ListRow, ListToolbar, Td, Th } from './ui';

const W = { out: 180, order: 150, lines: 60, mode: 150, at: 170, status: 150 };
const PAGE_SIZE = 25;

export function OutwardListPage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const createFor = params.get('create');
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useOutwards({ search: search.trim() || undefined, page, page_size: PAGE_SIZE });

  const open = drawer || createFor !== null;
  const close = () => {
    setDrawer(false);
    if (createFor !== null) { params.delete('create'); setParams(params, { replace: true }); }
  };
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Sales & Supply" meta="Direct product sales · price quotes, verify orders, dispatch" />
      <PageContent className="flex-1 gap-[16px]">
        <SupplyTabs />
        <ListToolbar>
          <Button icon={<Ic icon={IconPlus} size={18} />} onClick={() => setDrawer(true)}>New outward</Button>
          {q.data && <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{total} {total === 1 ? 'outward' : 'outwards'}</p>}
          <div className="h-px min-w-px flex-1" aria-hidden />
          <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search outward / customer" label="Search outwards" />
        </ListToolbar>

        <ListCard center={q.isError}>
          {q.isError ? (
            <ErrorState title="Couldn't load outwards" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
          ) : (
            <>
              <HeadRow>
                <Th w={W.out}>Outward</Th><Th grow>Customer</Th><Th w={W.order}>Order</Th><Th w={W.lines} right>Lines</Th>
                <Th w={W.mode}>Mode</Th><Th w={W.at}>Dispatched</Th><Th w={W.status}>Status</Th>
              </HeadRow>
              {q.isPending ? <SkeletonRows rows={6} widths={[150, 260, 120, 40, 120, 140, 90]} />
                : q.data.rows.length === 0 ? (
                  <div className="flex w-full flex-1 justify-center">
                    {search.trim()
                      ? <EmptyState icon={IconSearch} title="No outwards match" body={`Nothing matches "${search.trim()}". Search by SOUT number, customer, tracking reference or SO number.`} />
                      : <EmptyState icon={IconPackage} title="No outwards yet" body="Create one from an order once at least one reservation is CONFIRMED." />}
                  </div>
                ) : q.data.rows.map((r) => <Row key={r.id} r={r} />)}
              {pages > 1 && <Pagination className="mt-[16px]" page={page} pages={pages} onChange={setPage} />}
            </>
          )}
        </ListCard>
      </PageContent>

      <CreateOutwardDrawer
        open={open}
        initialOrderId={createFor ?? undefined}
        onClose={close}
        onCreated={(id) => { close(); nav(`/p/supply/outwards/${id}`, { state: { created: true } }); }}
      />
    </>
  );
}

function Row({ r }: { r: OutwardRow }) {
  const orders = r.sales_orders.map((s) => s.sales_order_number).filter(Boolean);
  return (
    <ListRow to={`/p/supply/outwards/${r.id}`}>
      <Td w={W.out}><span className={T.id}>{r.outward_number ?? 'Draft · not numbered'}</span></Td>
      <Td grow><span className={T.strong}>{r.customer_name}</span></Td>
      <Td w={W.order}><span className={T.id} title={orders.join(', ')}>{orders[0] ?? '—'}{orders.length > 1 ? ` +${orders.length - 1}` : ''}</span></Td>
      <Td w={W.lines} right><span className={T.num}>{r.lines_total}</span></Td>
      <Td w={W.mode}><span className={T.text}>{enumLabel(r.dispatch_mode)}</span></Td>
      <Td w={W.at}><span className={T.text}>{r.dispatched_at ? formatDateTime(r.dispatched_at) : '—'}</span></Td>
      <Td w={W.status}><StatusPill domain="supplyOutward" value={r.status} /></Td>
    </ListRow>
  );
}
