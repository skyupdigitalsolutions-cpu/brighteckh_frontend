// PO2 · Supplier POs for a sales order (Purchase, /p/supply/orders/:id/supplier-pos) — 243:50019.
// Page header "SO-… · supplier POs" + meta; table card (glass-strong r24 p16): header bg-subtle r20 px-16 py-12 gap 10,
// rows px-16 py-14 border-b. Data: GET /sales-orders/:id/purchase-orders (headers, Purchase only).
// API over Figma: the PO header read carries no lines, so the drawn Item / Qty / Value (pre-tax) columns are replaced by
// Created / Released (GapNote). Source = purchase_purpose (SALES ORDER), neutral badge as drawn.
import { Link, useParams } from 'react-router-dom';
import { IconShoppingCart } from '@tabler/icons-react';
import { formatDayTime } from '../../../lib/format';
import { Badge, EmptyState, ErrorState, GapNote, GlassCard, PageContent, PageHeader, SkeletonRows, StatusPill, errorBody } from '../../../ui/desktop';
import { useOrder, useSupplierPos } from '../api';
import { SupplyTabs } from '../ui';
import { MiniHead, MiniRow, TId, TStrong, TText, Td, Th } from './ui';

const COL = { po: 110, created: 140, released: 140, source: 130, status: 140 };

export function SupplierPosPage() {
  const { id = '' } = useParams();
  const order = useOrder(id);
  const q = useSupplierPos(id);
  const so = order.data?.sales_order_number ?? 'Sales order';
  return (
    <>
      <PageHeader
        title={`${so} · supplier POs`}
        meta="POs raised for this sales order · source SALES_ORDER · same PO series as repair POs, no job number"
        action={<Link to={`/p/supply/orders/${id}`} className="text-[14px] font-medium leading-[20px] text-fg underline">Back to order</Link>}
      />
      <PageContent>
        <SupplyTabs />
        <GapNote code="API">The supplier-PO read for a sales order returns PO headers only — item, quantity and value aren’t available here.</GapNote>
        <GlassCard strong radius="rounded-[24px]" className="flex min-h-[586px] w-full flex-1 flex-col items-stretch p-[16px]">
          <MiniHead size="draft">
            <Th w={COL.po}>PO</Th><Th grow>Supplier</Th><Th w={COL.created}>Created</Th><Th w={COL.released}>Released</Th>
            <Th w={COL.source}>Source</Th><Th w={COL.status}>Status</Th>
          </MiniHead>
          {q.isPending ? <SkeletonRows rows={4} widths={[80, 240, 100, 100, 90, 90]} /> : q.isError ? (
            <div className="flex flex-1 items-center justify-center">
              <ErrorState title="Couldn't load supplier POs" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
            </div>
          ) : q.data.length === 0 ? (
            <EmptyState className="w-full" icon={IconShoppingCart} title="No supplier POs yet" body="Authorise sourcing for a line’s shortfall on the order to raise one." />
          ) : q.data.map((p) => (
            <MiniRow key={p.id} size="draft">
              <Td w={COL.po}><TId>{p.po_number}</TId></Td>
              <Td grow><TStrong>{p.supplier_name_snapshot}</TStrong></Td>
              <Td w={COL.created}><TText>{formatDayTime(p.created_at)}</TText></Td>
              <Td w={COL.released}><TText>{formatDayTime(p.released_at)}</TText></Td>
              <Td w={COL.source}><Badge tone="neutral" label={p.purchase_purpose.replace(/_/g, ' ')} /></Td>
              <Td w={COL.status}><StatusPill domain="purchaseOrder" value={p.po_status} /></Td>
            </MiniRow>
          ))}
        </GlassCard>
      </PageContent>
    </>
  );
}
