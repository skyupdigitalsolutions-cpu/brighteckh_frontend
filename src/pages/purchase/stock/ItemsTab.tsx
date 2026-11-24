// M1 · Stock · Items (/p/stock/items) — Figma D·M1 177:104933; 03i 177:130382: Status menu 177:130383 (+ results
// 130556–130841), Type menu 177:130892, search "igbt" 177:131288, Page 2 177:131355, row menus 177:131511 … 177:132701
// (View item · Check availability · Use in BOM · Copy item code), item detail drawers 177:132871 … 177:134224.
// Table: Item code 130 (mono) · Standard name flex · Type 130 · UoM 70 · Stock flag 120 · Status 150 · 36 kebab; pagination.
// Drawer: code (mono) + name, status + type badges, facts (Base UoM, Stock flag, Classification CC / SS / TT, Use case,
// Created name · date), Used in, Availability; footer Check availability.
//
// DATA: GET /stock/items (PURCHASE) — server pagination, `status` / `record_type`, debounced `search`, option counts from
// `counts_by_status` / `counts_by_record_type` (search scope); drawer = GET /stock/items/{id}.
// Read-only pill (product owner, 23 Nov 2026): "+ New item", "Use in BOM" and the drawer's Approve / Save draft are not
// shown here. Loading / empty / error states are the kit's (not drawn).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBox, IconChartBar, IconCopy, IconEye, IconSearch } from '@tabler/icons-react';
import {
  Badge, Button, Drawer, EmptyState, ErrorState, FilterMenu, Ic, PageContent, Pagination, RowMenuTrigger, SearchField,
  SkeletonRows, StatusPill, TD, TH, TR, TableCard, ToolbarCard, ToolbarSpacer, errorBody, useToast, type FilterOption,
  type RowMenuItem,
} from '../../../ui/desktop';
import { enumLabel, formatDate } from '../../../lib/format';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { useStockItem, useStockItems, type ItemRow, type MasterStatus, type RecordType } from './api';
import { StockHeader, StockTabs } from './shared';
import { num, qtyText } from './stockUtils';

const PAGE_SIZE = 25;
const COLS = { code: 130, type: 130, uom: 70, flag: 120, status: 150, menu: 36 } as const;
// Figma's Status menu (177:130383) offers these 6; INACTIVE exists in the DB and is listed last.
const STATUSES: MasterStatus[] = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'ON_HOLD', 'SUPERSEDED', 'INACTIVE'];
const TYPES: RecordType[] = ['ITEM', 'COMPONENT', 'CONSUMABLE'];
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function ItemsTab() {
  const [status, setStatus] = useState<MasterStatus | 'ALL'>('ALL');
  const [type, setType] = useState<RecordType | 'ALL'>('ALL');
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useStockItems({
    page, page_size: PAGE_SIZE,
    ...(status === 'ALL' ? {} : { status }), ...(type === 'ALL' ? {} : { record_type: type }), ...(search ? { search } : {}),
  });
  const data = q.data;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];
  const sc = data?.counts_by_status;
  const tc = data?.counts_by_record_type;
  const statusOptions: FilterOption<MasterStatus | 'ALL'>[] = [
    { value: 'ALL', label: 'All' }, ...STATUSES.map((s) => ({ value: s, label: sc ? `${cap(s)} · ${sc[s]}` : cap(s) })),
  ];
  const typeOptions: FilterOption<RecordType | 'ALL'>[] = [
    { value: 'ALL', label: 'All' }, ...TYPES.map((t) => ({ value: t, label: tc ? `${cap(t)} · ${tc[t]}` : cap(t) })),
  ];
  const filtered = status !== 'ALL' || type !== 'ALL' || !!search;

  return (
    <>
      <StockHeader meta="Only approved items can be requested by engineers." />
      <PageContent className="flex-1">
        <StockTabs />
        <ToolbarCard className="pl-[20px]">
          <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">
            {!data ? '…' : `${total} item${total === 1 ? '' : 's'}`}
          </p>
          <ToolbarSpacer />
          <SearchField value={text} onChange={(v) => { setText(v); setPage(1); }} placeholder="Search code or name" />
          <FilterMenu label="Status" value={status} options={statusOptions} allValue="ALL" align="end" onChange={(v) => { setStatus(v); setPage(1); }} />
          <FilterMenu label="Type" value={type} options={typeOptions} allValue="ALL" align="end" onChange={(v) => { setType(v); setPage(1); }} />
        </ToolbarCard>

        <TableCard fill>
          <div role="row" className="flex w-full shrink-0 items-start gap-[12px] overflow-clip rounded-t-popover bg-subtle px-[16px] py-[12px]">
            <TH w={COLS.code}>Item code</TH>
            <TH grow>Standard name</TH>
            <TH w={COLS.type}>Type</TH>
            <TH w={COLS.uom}>UoM</TH>
            <TH w={COLS.flag}>Stock flag</TH>
            <TH w={COLS.status}>Status</TH>
            <TH w={COLS.menu}>{''}</TH>
          </div>
          {q.isPending ? <SkeletonRows rows={8} /> : q.isError ? (
            <div className="flex flex-1 items-center justify-center">
              <ErrorState title="Couldn't load items" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={search ? IconSearch : IconBox}
                title={search ? `No items match “${search}”` : filtered ? 'No items for this filter' : 'No items in the Item Master yet'}
                body={search ? 'Search covers item code, standard name and short description.' : undefined}
              />
            </div>
          ) : (
            <div className={q.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
              {rows.map((r) => <ItemRowView key={r.id} r={r} onOpen={() => setOpenId(r.id)} />)}
            </div>
          )}
        </TableCard>
        {pages > 1 && <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} />}
      </PageContent>

      <ItemDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function copy(toast: ReturnType<typeof useToast>, text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast({ tone: 'success', title: 'Copied', body: text }),
    () => toast({ tone: 'blocked', title: "Couldn't copy", body: text }),
  );
}

function ItemRowView({ r, onOpen }: { r: ItemRow; onOpen: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menu: RowMenuItem[] = [
    { label: 'View item', icon: IconEye, onSelect: onOpen },
    { label: 'Check availability', icon: IconChartBar, onSelect: () => navigate(`/p/stock?item=${r.id}`) },
    { label: 'Copy item code', icon: IconCopy, onSelect: () => copy(toast, r.item_code) },
  ];
  return (
    <TR onClick={onOpen} selected={menuOpen} className="gap-[12px]">
      <TD w={COLS.code} kind="id">{r.item_code}</TD>
      <TD grow kind="strong">{r.standard_name}</TD>
      <TD w={COLS.type} kind="text">{enumLabel(r.record_type)}</TD>
      <TD w={COLS.uom} kind="text">{r.base_uom}</TD>
      <TD w={COLS.flag} kind="text">{enumLabel(r.stock_flag)}</TD>
      <TD w={COLS.status}><StatusPill domain="itemStatus" value={r.status} /></TD>
      <TD w={COLS.menu}><RowMenuTrigger items={menu} label={`Actions for ${r.item_code}`} onOpenChange={setMenuOpen} /></TD>
    </TR>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full items-start justify-between gap-[16px] text-[13px] leading-[18px]">
      <span className="shrink-0 text-fg-2">{label}</span>
      <span className="min-w-0 text-right font-medium text-fg">{children}</span>
    </div>
  );
}

function ItemDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const q = useStockItem(id);
  const it = q.data;
  const bal = new Map<string, number>();
  for (const b of it?.availability.balances ?? []) bal.set(b.role, (bal.get(b.role) ?? 0) + num(b.qty_on_hand));
  const inTransit = bal.get('IN_TRANSIT') ?? 0;
  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      variant="side"
      title={<span className="font-mono">{it?.item_code ?? 'Item'}</span>}
      subtitle={it?.standard_name}
      footer={it && (
        <Button kind="secondary" icon={<Ic icon={IconChartBar} size={18} />} onClick={() => navigate(`/p/stock?item=${it.id}`)}>Check availability</Button>
      )}
    >
      {q.isPending ? <SkeletonRows rows={5} /> : q.isError || !it ? (
        <ErrorState title="Couldn't load this item" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <>
          <div className="flex flex-wrap gap-[8px]">
            <StatusPill domain="itemStatus" value={it.status} />
            <Badge tone="neutral" label={enumLabel(it.record_type)} />
          </div>
          <div className="flex w-full flex-col gap-[10px] rounded-t-md bg-subtle px-[12px] py-[12px]">
            <FactRow label="Base UoM">{it.base_uom}</FactRow>
            <FactRow label="Stock flag">{enumLabel(it.stock_flag)}</FactRow>
            <FactRow label="Classification (CC / SS / TT)">{it.cc} / {it.ss} / {it.tt}</FactRow>
            <FactRow label="Use case">{it.use_case}</FactRow>
            {it.short_description && <FactRow label="Description">{it.short_description}</FactRow>}
            <FactRow label="Created">{it.created_by_name} · {formatDate(it.created_at)}</FactRow>
            {it.tech_approved_at && <FactRow label="Approved">{it.tech_approved_by_name ?? '—'} · {formatDate(it.tech_approved_at)}</FactRow>}
          </div>
          <section className="flex w-full flex-col gap-[6px]">
            <h3 className="text-[14px] font-semibold leading-[20px] text-fg">Used in</h3>
            {it.used_in.length === 0 ? (
              <p className="text-[13px] leading-[18px] text-fg-2">Not on any assembly&apos;s latest BOM revision.</p>
            ) : it.used_in.map((u) => (
              <button key={u.assembly_id} type="button" onClick={() => navigate(`/p/stock/assemblies/${u.assembly_id}`)}
                className="text-left text-[13px] leading-[18px] text-fg-2 hover:text-fg">
                <span className="font-mono">{u.assembly_code}</span> · {u.standard_name} · ×{qtyText(num(u.qty_per))} (rev {u.bom_revision})
              </button>
            ))}
          </section>
          <section className="flex w-full flex-col gap-[6px]">
            <h3 className="text-[14px] font-semibold leading-[20px] text-fg">Availability</h3>
            <p className="text-[13px] leading-[18px] text-fg-2">
              {qtyText(num(it.availability.allocatable))} {it.base_uom} allocatable · {qtyText(num(it.availability.reserved))} reserved · {qtyText(inTransit)} in transit
            </p>
          </section>
        </>
      )}
    </Drawer>
  );
}
