// FI2 · Product invoice INV-BLR-000041 ISSUED (F-D 247:53559). Data: GET /invoices/:id (sales_lines, sales_source,
// totals, allocations). Same split as FI1: Invoice card (number + status + tax regime badges, lines, totals, G21 note)
// + Side (Bill to, read-only note). Success alert only right after issuing (router state).
// API over Figma:
//   - Header meta "· Kavya R": the issuer is an id only (issued_by_id) → omitted.
//   - Bill to "Outward SOUT-…": the invoice read has no outward reference → omitted.
//   - "Download PDF": there is no PDF endpoint (GET /invoices/:id/print returns the JSON print payload) → GapNote INV-1.
//   - Added: payments allocated / balance (allocations, balance_paise) when anything is allocated.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { IconFileOff, IconLock } from '@tabler/icons-react';
import { apiStatus } from '../../../../api/http';
import { enumLabel, formatDate, formatDateTime, formatPaise, formatQty } from '../../../../lib/format';
import {
  Badge, EmptyState, ErrorState, GapNote, Ic, InlineAlert, PageContent, PageHeader, StateCard, StatusPill, errorBody,
} from '../../../../ui/desktop';
import { useInvoice, type InvoiceDetail } from '../../api';
import { Bars, CardHead, KVBox, OpenQuestion, PanelHead, SplitCard } from '../ui';
import { InvoiceLinesTable, TaxTotals, type InvoiceLineView } from './parts';

export function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams();
  const q = useInvoice(invoiceId);
  if (q.isPending) {
    return (
      <>
        <PageHeader title="Invoice" meta=" " />
        <PageContent className="min-h-[808px]">
          <div role="status" aria-label="Loading" className="flex min-h-[808px] w-full flex-1 items-stretch gap-[20px]">
            <SplitCard pad={22} className="min-w-px flex-1"><Bars widths={[200, 640, 600, 600, 300]} /></SplitCard>
            <SplitCard className="w-[420px] shrink-0"><Bars widths={[80, 340, 300]} /></SplitCard>
          </div>
        </PageContent>
      </>
    );
  }
  if (q.isError) {
    return (
      <>
        <PageHeader title="Invoice" />
        <PageContent>
          <StateCard>
            {apiStatus(q.error) === 404
              ? <EmptyState icon={IconFileOff} title="Invoice not found" body={<>It may belong to another company. <Link className="underline" to="/f">Back to product invoices</Link></>} />
              : <ErrorState title="Couldn't load the invoice" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />}
          </StateCard>
        </PageContent>
      </>
    );
  }
  return <Detail inv={q.data} />;
}

function Detail({ inv }: { inv: InvoiceDetail }) {
  const loc = useLocation();
  const nav = useNavigate();
  const [issued] = useState(() => !!(loc.state as { issued?: boolean } | null)?.issued);
  useEffect(() => {
    if ((loc.state as { issued?: boolean } | null)?.issued) nav(loc.pathname, { replace: true, state: null });
  }, [loc.pathname, loc.state, nav]);

  const so = inv.sales_source?.sales_order_number ?? null;
  const lines: InvoiceLineView[] = inv.sales_lines.map((l) => ({
    key: l.id, description: l.description, hsn: l.hsn_sac, qty: formatQty(l.quantity, l.uom), rate: l.unit_price_paise,
    taxable: l.taxable_paise, cgstRate: l.cgst_rate, sgstRate: l.sgst_rate, igstRate: l.igst_rate,
  }));
  const paid = BigInt(inv.amount_paid_paise) > 0n;

  return (
    <>
      <PageHeader title={inv.invoice_number} meta={[inv.invoice_type, so, `issued ${formatDateTime(inv.issued_at)}`].filter(Boolean).join(' · ')} />
      <PageContent className="min-h-[808px]">
        {issued && (
          <InlineAlert tone="success" title={`Invoice issued · ${inv.invoice_number}`}>
            Next number taken from the shared INV series. No repair job number on product invoices.
          </InlineAlert>
        )}
        <div className="flex min-h-[640px] w-full flex-1 items-stretch gap-[20px]">
          <SplitCard pad={22} className="min-w-px flex-1">
            <CardHead right={<><StatusPill domain="invoiceStatus" value={inv.invoice_status} /><Badge tone="neutral" label={enumLabel(inv.tax_regime)} /></>}>{inv.invoice_number}</CardHead>
            <InvoiceLinesTable lines={lines} />
            <TaxTotals regime={inv.tax_regime} lines={lines} sub={inv.sub_total_paise} cgst={inv.cgst_paise} sgst={inv.sgst_paise} igst={inv.igst_paise} total={inv.total_paise} words={inv.total_in_words} />
            <OpenQuestion code="G21">invoice cancellation / credit note for product invoices is not decided, so there is no Cancel action.</OpenQuestion>
          </SplitCard>
          <SplitCard className="w-[420px] shrink-0">
            <PanelHead>Bill to</PanelHead>
            <KVBox rows={[
              ['Customer', inv.customer_name],
              ['GSTIN', inv.customer_gstin],
              ['Place of supply', `${inv.place_of_supply_state_name} (${inv.place_of_supply_state_code})`],
              ['Order', so ?? '—'],
              ['Due', `${formatDate(inv.due_date)} · ${inv.credit_days} days`],
            ]} />
            {paid && (
              <KVBox rows={[
                ['Paid', formatPaise(inv.amount_paid_paise)],
                ['Balance', formatPaise(inv.balance_paise)],
              ]} />
            )}
            <div className="min-h-px w-px flex-1" />
            <div className="flex w-full items-center gap-[8px] overflow-clip rounded-[12px] bg-subtle px-[12px] py-[8px]">
              <Ic icon={IconLock} size={14} className="text-fg-2" />
              <p className="text-[12px] leading-[16px] text-fg-2">Issued invoices are read-only.</p>
            </div>
            <GapNote code="INV-1">Download PDF: the API has no PDF for invoices (GET /invoices/:id/print returns data only).</GapNote>
          </SplitCard>
        </div>
      </PageContent>
    </>
  );
}
