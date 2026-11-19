// SE0 · Enquiries (/s/enquiries) — Figma 237:40368 list · 40701 loading · 41006 empty · 41279 error ·
// 41552 RECEIVED · 41840 QUOTED · 42128 CANCELLED · 42401 search "kaveri" · 42677 create drawer (CreateEnquiryDrawer).
// Page header "Enquiries" + meta; tab bar (glass-strong, radius 28) "All · n" + one tab per status (counts =
// counts_by_status under the current search); toolbar: New enquiry (primary, SALES only) · count · search 320;
// table card (radius 24): header + rows gap 12 — Enquiry 170 (Data/ID) · Customer flex (Body strong) · Channel 130
// (14/20 secondary) · Lines 80 (Data/Number) · Received 200 (14/20 secondary) · Status 160 (badge).
// Empty (41006): header row kept, kit EmptyState under it. Error (41279): header kept + blocked alert + "Try again".
// Data: GET /sales-supply/enquiries (status csv, search, page, page_size).
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconPackage, IconPlus, IconSearch } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { enumLabel, formatDateTime } from '../../../lib/format';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import {
  Button, EmptyState, Ic, PageContent, PageHeader, Pagination, SearchField, SkeletonRows, StatusPill, TD, TH, THead, TR, Tab, ToolbarSpacer,
} from '../../../ui/desktop';
import { SalesTabBar, SalesTableCard } from '../../sales/ui';
import { ENQUIRY_STATUSES, useEnquiries, type EnquiryRow, type EnquiryStatus } from '../api';
import { ListToolbar, TableError } from './local';
import { CreateEnquiryDrawer } from './CreateEnquiryDrawer';

type TabKey = 'ALL' | EnquiryStatus;
const PAGE_SIZE = 25;
const COLS = { enquiry: 170, channel: 130, lines: 80, received: 200, status: 160 };
const GAP = 12;

export function EnquiriesPage() {
  const me = useMe();
  const canCreate = me.role === 'SALES';
  const [params, setParams] = useSearchParams();
  const raw = params.get('status');
  const tab: TabKey = (ENQUIRY_STATUSES as readonly string[]).includes(raw ?? '') ? (raw as EnquiryStatus) : 'ALL';
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const q = useEnquiries({ ...(tab === 'ALL' ? {} : { status: [tab] }), page, page_size: PAGE_SIZE, ...(search ? { search } : {}) });
  const data = q.data;
  const counts = data?.counts_by_status;
  const all = counts ? ENQUIRY_STATUSES.reduce((s, st) => s + (counts[st] ?? 0), 0) : null;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];
  const countLabel = !data ? '…' : search ? `${total} result${total === 1 ? '' : 's'}` : `${total} enquir${total === 1 ? 'y' : 'ies'}`;

  const selectTab = (k: TabKey) => {
    setPage(1);
    setParams((p) => { const n = new URLSearchParams(p); if (k === 'ALL') n.delete('status'); else n.set('status', k); return n; }, { replace: true });
  };

  return (
    <>
      <PageHeader title="Enquiries" meta="Product enquiries from customers · catalogue items only" />
      <PageContent className="flex-1">
        <SalesTabBar label="Enquiry status">
          <Tab active={tab === 'ALL'} onClick={() => selectTab('ALL')} label="All" count={all} />
          {ENQUIRY_STATUSES.map((s) => (
            <Tab key={s} active={tab === s} onClick={() => selectTab(s)} label={enumLabel(s)} count={counts ? counts[s] ?? 0 : null} />
          ))}
        </SalesTabBar>

        <ListToolbar>
          {canCreate && (
            <Button kind="primary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setCreating(true)}>New enquiry</Button>
          )}
          {!q.isError && <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{countLabel}</p>}
          <ToolbarSpacer />
          <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} width={320} placeholder="Search number or customer" label="Search enquiries" />
        </ListToolbar>

        <SalesTableCard>
          <THead gap={GAP}>
            <TH w={COLS.enquiry}>Enquiry</TH>
            <TH grow>Customer</TH>
            <TH w={COLS.channel}>Channel</TH>
            <TH w={COLS.lines}>Lines</TH>
            <TH w={COLS.received}>Received</TH>
            <TH w={COLS.status}>Status</TH>
          </THead>
          {q.isPending ? <SkeletonRows rows={8} widths={[110, 260, 80, 30, 130, 90]} /> : q.isError ? (
            <TableError title="Couldn't load enquiries" error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
          ) : rows.length === 0 ? (
            <div className="flex w-full justify-center">
              <EmptyState
                icon={search ? IconSearch : IconPackage}
                title={search ? `No enquiries match “${search}”` : tab === 'ALL' ? 'No enquiries yet' : `No ${enumLabel(tab)} enquiries`}
                body={search
                  ? 'Search covers enquiry number, customer name or code, and the enquiry details.'
                  : tab === 'ALL' ? 'When a customer asks for parts by email, WhatsApp, phone or in person, log it here with New enquiry.' : undefined}
              />
            </div>
          ) : (
            <div className={q.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
              {rows.map((r) => <EnquiryListRow key={r.id} r={r} />)}
            </div>
          )}
          {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} className="mt-auto" />}
        </SalesTableCard>
      </PageContent>
      {canCreate && <CreateEnquiryDrawer open={creating} onClose={() => setCreating(false)} />}
    </>
  );
}

function EnquiryListRow({ r }: { r: EnquiryRow }) {
  return (
    <TR to={`/s/enquiries/${r.id}`} gap={GAP}>
      <TD w={COLS.enquiry} kind="id">{r.enquiry_number}</TD>
      <TD grow kind="strong">{r.customer_name}</TD>
      <TD w={COLS.channel} kind="text">{enumLabel(r.enquiry_channel)}</TD>
      <TD w={COLS.lines} kind="number">{r.line_count}</TD>
      <TD w={COLS.received} kind="text">{formatDateTime(r.created_at)}</TD>
      <TD w={COLS.status}><StatusPill domain="supplyEnquiry" value={r.status} /></TD>
    </TR>
  );
}
