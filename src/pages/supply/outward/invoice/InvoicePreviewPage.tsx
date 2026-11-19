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
import { useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IconAlertTriangle } from '@tabler/icons-react';
import { apiErrorText, apiStatus } from '../../../../api/http';
import { enumLabel, formatDate, formatQty } from '../../../../lib/format';
import {
  Badge, ErrorState, FormErrors, GatedAction, InlineAlert, PageContent, PageHeader, StateCard, errorBody,
} from '../../../../ui/desktop';
import {
  newIdempotencyKey, supplyApi, useSupplyMutation, type InvoicePreview, type InvoiceQueueRow,
} from '../../api';
import { Bars, CardHead, KVBox, OpenQuestion, PanelHead, SplitCard } from '../ui';
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
            <OpenQuestion code="G13">whether the GST rate is per company, per HSN or per item is not decided.</OpenQuestion>
            <OpenQuestion code="G18">one invoice per dispatch vs one combined invoice per order is not decided — this preview covers every invoiceable line of {p.sales_order_number} under the {p.invoice_trigger} trigger.</OpenQuestion>
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
  const rate = /HSN|GST rate|PRODUCT_SALE/i.test(reason);
  return (
    <>
      <PageHeader title={title} meta={[row?.customer_name, gstin ? 'customer has no GSTIN' : rate ? 'HSN / GST rate missing' : 'invoice blocked'].filter(Boolean).join(' · ')} />
      <PageContent className="min-h-[808px]">
        <div className="flex min-h-[640px] w-full flex-1 items-stretch gap-[20px]">
          <SplitCard pad={22} className="min-w-px flex-1">
            <CardHead right={<><Badge tone="neutral" label="PREVIEW" /><Badge tone="blocked" label="BLOCKED" /></>}>Preview · no number consumed</CardHead>
            <InlineAlert tone="blocked" icon={IconAlertTriangle} title="The server won't build this invoice">{reason}</InlineAlert>
            {gstin && <OpenQuestion code="G19">tax regime and invoice format for a customer without GSTIN (B2C / unregistered) is not decided.</OpenQuestion>}
            {rate && <OpenQuestion code="G13">whether the GST rate / HSN is per company, per HSN or per item is not decided.</OpenQuestion>}
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
