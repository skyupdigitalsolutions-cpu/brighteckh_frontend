// FI1 · Invoice preview (F-D 247:51039): SO-BLR-000004 INTER STATE 247:52354 · SO-BLR-000002 INTRA STATE 52675 ·
// no-GSTIN customer BLOCKED 52979 · HSN missing BLOCKED 53267.
// Data: POST /sales-invoices/preview {sales_order_id} (no INV number consumed) — read as a query, never cached.
// A refusal comes back as 400 with the server reason (no GSTIN, GST rate / HSN missing, customer not APPROVED, nothing
// invoiceable …) → BLOCKED with that reason, Issue disabled with the same reason (the gate Finance can't clear here).
// Tax is exactly what the server returns: CGST + SGST for INTRA_STATE, IGST for INTER_STATE; the % in the totals label is
// the line rate the server returned (shown only when every line has the same rate). Nothing is computed client-side.
// Issue: POST /sales-invoices with ONE Idempotency-Key per Issue click (kept until success, so a retried click returns
// the same invoice and never consumes a second INV number) → /f/invoices/:id.
// Layout: "Split" 247:52557 gap 20: Invoice card (flex-1, glass-strong r24 p22 gap12) + Side (420, p20): "Bill to" KV,
// spacer, "Preview doesn't consume an INV number." (12/16 muted), Gated action.
// API over Figma: the blocked frames draw the order lines; the API returns only the refusal for a blocked preview, so the
// blocked card shows the reason, not lines. "(example)" labels are dropped — values are real.
// Configured state (Settings, 27 Nov 2026): G13 (GST rate source) and G18 / G19 are answered, so the open-question notes
// are gone. Still not in the backend (pending product-owner decision):
// - G19 cash bill (non-GST) for a customer without GSTIN — 247:52979 is drawn as the designed cash-bill state (badges,
//   "GST Not applicable", Bill to "Not registered") but the server still refuses and has no non-GST bill type, so there
//   are no lines and no "Issue cash bill" action: a GapNote says so.
// - G18 one invoice per dispatch: not enforced; the preview covers every invoiceable line (GapNote).
// HSN missing (53267) stays BLOCKED with the server reason.
import { useRef, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { apiErrorText, apiStatus } from '../../../../api/http';
import { enumLabel, formatDate, formatQty } from '../../../../lib/format';
import {
  Badge, ErrorState, FormErrors, GapNote, GatedAction, Ic, InlineAlert, PageContent, PageHeader, StateCard, errorBody,
} from '../../../../ui/desktop';
import {
  newIdempotencyKey, supplyApi, useSupplyMutation, type InvoicePreview, type InvoiceQueueRow,
} from '../../api';
import { Bars, CardHead, KVBox, PanelHead, SplitCard } from '../ui';
import { InvoiceLinesTable, TaxTotals, type InvoiceLineView } from './parts';

type PreviewLine = {
  line_no: number; description: string; hsn_sac: string; quantity: string | number; uom: string; unit_price_paise: string | number;
  taxable_paise: string | number; cgst_rate: string | number; sgst_rate: string | number; igst_rate: string | number;
};
type Party = { name?: string; gstin?: string | null; state_code?: string | null; state_name?: string | null };

export function InvoicePreviewPage() {
  const { orderId = '' } = useParams();
  const loc = useLocation();
  const row = (loc.state as { row?: InvoiceQueueRow } | null)?.row?.sales_order_id === orderId ? (loc.state as { row: InvoiceQueueRow }).row : null;
  const q = useQuery({
    queryKey: ['supply', 'invoice-preview', orderId],
    queryFn: () => supplyApi.previewInvoice({ sales_order_id: orderId }),
    enabled: !!orderId, retry: false, staleTime: 0, gcTime: 0,
  });

  const so = q.data?.sales_order_number ?? row?.sales_order_number ?? null;
  const title = `Invoice preview${so ? ` · ${so}` : ''}`;

  if (q.isPending) return <Skeleton title={title} />;
  const refused = q.isError && apiStatus(q.error) === 400;
  if (q.isError && !refused) {
    return (
      <>
        <PageHeader title={title} />
        <PageContent>
          <StateCard><ErrorState title="Couldn't build the preview" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} /></StateCard>
        </PageContent>
      </>
    );
  }
  if (refused) return <Blocked title={title} row={row} reason={apiErrorText(q.error).replace(/^BR08:\s*/, '')} />;
  return <Ready title={title} p={q.data!} row={row} />;
}

function Ready({ title, p, row }: { title: string; p: InvoicePreview; row: InvoiceQueueRow | null }) {
  const nav = useNavigate();
  const key = useRef<string | null>(null);
  const issue = useSupplyMutation((k: string) => supplyApi.issueInvoice({ sales_order_id: p.sales_order_id }, k));
  const cust = p.customer as Party;
  const pos = p.place_of_supply as Party;
  const lines: InvoiceLineView[] = (p.lines as unknown as PreviewLine[]).map((l) => ({
    key: String(l.line_no), description: l.description, hsn: l.hsn_sac, qty: formatQty(String(l.quantity), l.uom),
    rate: String(l.unit_price_paise), taxable: String(l.taxable_paise),
    cgstRate: String(l.cgst_rate), sgstRate: String(l.sgst_rate), igstRate: String(l.igst_rate),
  }));

  const onIssue = () => {
    if (!key.current) key.current = newIdempotencyKey();
    issue.mutate(key.current, {
      onSuccess: (inv) => { key.current = null; nav(`/f/invoices/${inv.id}`, { state: { issued: true } }); },
    });
  };

  return (
    <>
      <PageHeader title={title} meta={[cust.name, pos.state_name && `${pos.state_name} (${pos.state_code})`, enumLabel(p.tax_regime)].filter(Boolean).join(' · ')} />
      <PageContent className="min-h-[808px]">
        <div className="flex min-h-[640px] w-full flex-1 items-stretch gap-[20px]">
          <SplitCard pad={22} className="min-w-px flex-1">
            <CardHead right={<><Badge tone="neutral" label="PREVIEW" /><Badge tone="neutral" label={enumLabel(p.tax_regime)} /></>}>Preview · no number consumed</CardHead>
            <InvoiceLinesTable lines={lines} />
            <TaxTotals regime={p.tax_regime} lines={lines} sub={String(p.sub_total_paise)} cgst={String(p.cgst_paise)} sgst={String(p.sgst_paise)} igst={String(p.igst_paise)} total={String(p.total_paise)} words={p.total_in_words} />
            <InfoNote>Product GST rate from Admin › Settings › Company & tax; HSN comes from each item (Stock › Items).</InfoNote>
            <GapNote code="G18">One invoice per dispatch isn't enforced by the backend yet: this preview covers every invoiceable line of {p.sales_order_number} under the {p.invoice_trigger} trigger.</GapNote>
          </SplitCard>
          <SplitCard className="w-[420px] shrink-0">
            <PanelHead>Bill to</PanelHead>
            <KVBox rows={[
              ['Customer', cust.name ?? '—'],
              ['GSTIN', cust.gstin ?? '—'],
              ['Place of supply', pos.state_name ? `${pos.state_name} (${pos.state_code})` : pos.state_code ?? '—'],
              ['Order', p.sales_order_number],
              ...(row?.trigger_event_ref ? [['Outward', row.trigger_event_ref] as [string, string]] : []),
              ['Invoice date · due', `${formatDate(p.invoice_date)} · ${formatDate(p.due_date)} (${p.credit_days} days)`],
            ]} />
            <div className="min-h-px w-px flex-1" />
            <FormErrors error={issue.error} title="The invoice wasn't issued" />
            <p className="w-full text-[12px] leading-[16px] text-fg-muted">Preview doesn't consume an INV number.</p>
            <GatedAction
              ready
              reason=""
              readyNote={`Trigger met (${p.invoice_trigger}) · GST configured`}
              primaryLabel="Issue invoice"
              busy={issue.isPending}
              onPrimary={onIssue}
            />
          </SplitCard>
        </div>
      </PageContent>
    </>
  );
}

function Blocked({ title, row, reason }: { title: string; row: InvoiceQueueRow | null; reason: string }) {
  const gstin = /GSTIN/i.test(reason);
  if (gstin) return <CashBill title={title} row={row} reason={reason} />;
  const rate = /HSN|GST rate|PRODUCT_SALE/i.test(reason);
  return (
    <>
      <PageHeader title={title} meta={[row?.customer_name, rate ? 'HSN / GST rate missing' : 'invoice blocked'].filter(Boolean).join(' · ')} />
      <PageContent className="min-h-[808px]">
        <div className="flex min-h-[640px] w-full flex-1 items-stretch gap-[20px]">
          <SplitCard pad={22} className="min-w-px flex-1">
            <CardHead right={<><Badge tone="neutral" label="PREVIEW" /><Badge tone="blocked" label="BLOCKED" /></>}>Preview · no number consumed</CardHead>
            <InlineAlert tone="blocked" icon={IconAlertTriangle} title="The server won't build this invoice">{reason}</InlineAlert>
            {rate && <InfoNote>Set the HSN on the item in Stock › Items. The product GST rate is set in Admin › Settings › Company & tax.</InfoNote>}
          </SplitCard>
          <SplitCard className="w-[420px] shrink-0">
            <PanelHead>Bill to</PanelHead>
            <KVBox rows={[
              ['Customer', row?.customer_name ?? '—'],
              ['Order', row?.sales_order_number ?? '—'],
              ...(row?.trigger_event_ref ? [['Outward', row.trigger_event_ref] as [string, string]] : []),
            ]} />
            <div className="min-h-px w-px flex-1" />
            <GatedAction ready={false} reason={reason} readyNote="" primaryLabel="Issue invoice" onPrimary={() => undefined} />
          </SplitCard>
        </div>
      </PageContent>
    </>
  );
}

/** FI1 cash bill 247:52979 — designed state for a customer without GSTIN; the backend has no non-GST bill type yet. */
function CashBill({ title, row, reason }: { title: string; row: InvoiceQueueRow | null; reason: string }) {
  return (
    <>
      <PageHeader title={title} meta={[row?.customer_name, 'no GSTIN → cash bill (non-GST)'].filter(Boolean).join(' · ')} />
      <PageContent className="min-h-[808px]">
        <div className="flex min-h-[640px] w-full flex-1 items-stretch gap-[20px]">
          <SplitCard pad={22} className="min-w-px flex-1">
            <CardHead right={<><Badge tone="neutral" label="PREVIEW" /><Badge tone="neutral" label="CASH BILL · NON-GST" /></>}>Cash bill preview · no number consumed</CardHead>
            <div className="flex w-full items-center justify-end gap-[16px] text-[14px] leading-[20px]">
              <span className="text-fg-2">GST</span><span className="font-mono text-fg">Not applicable</span>
            </div>
            <InfoNote>Customers without GSTIN get a cash bill (non-GST) — Admin › Settings › Policies.</InfoNote>
            <GapNote code="G19">The non-GST cash bill isn't in the backend yet, so the bill lines and total can't be built and it can't be issued. Server: {reason}</GapNote>
          </SplitCard>
          <SplitCard className="w-[420px] shrink-0">
            <PanelHead>Bill to</PanelHead>
            <KVBox rows={[
              ['Customer', row?.customer_name ?? '—'],
              ['GSTIN', 'Not registered'],
              ['Place of supply', '—'],
              ['Order', row?.sales_order_number ?? '—'],
              ...(row?.trigger_event_ref ? [['Outward', row.trigger_event_ref] as [string, string]] : []),
            ]} />
            <div className="min-h-px w-px flex-1" />
          </SplitCard>
        </div>
      </PageContent>
    </>
  );
}

function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[8px] overflow-clip rounded-[12px] bg-subtle px-[12px] py-[10px]">
      <Ic icon={IconInfoCircle} size={16} className="shrink-0 text-fg-2" />
      <p className="min-w-px flex-1 text-[12px] leading-[16px] text-fg-2">{children}</p>
    </div>
  );
}

function Skeleton({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} meta=" " />
      <PageContent className="min-h-[808px]">
        <div role="status" aria-label="Loading" className="flex min-h-[808px] w-full flex-1 items-stretch gap-[20px]">
          <SplitCard pad={22} className="min-w-px flex-1"><Bars widths={[220, 640, 600, 600, 300]} /></SplitCard>
          <SplitCard className="w-[420px] shrink-0"><Bars widths={[80, 340, 300]} /></SplitCard>
        </div>
      </PageContent>
    </>
  );
}
