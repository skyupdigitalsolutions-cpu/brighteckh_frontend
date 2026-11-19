// SQS1 · Quote, Sales view (/s/product-quotes/:id) — Figma 239:46614 ISSUED · 46898 send drawer · 47089 sent result ·
// 47397 WITH CUSTOMER · 47722 record-response drawer · 47955 PART ACCEPTED response drawer · 48205 ACCEPTED ·
// 48544 PART ACCEPTED.
// Header: title = quote number, meta "Customer · revision n". Split (gap 20):
//   Quote card (flex): head "SQ-… · revision n" + stage badge; lock strip "Issued by Purchase · prices are fixed…";
//   lines table (QuoteLines SalesLinesTable); terms box (Value (pre-tax) · Valid until · Payment · delivery · warranty ·
//   Tax); muted note "Customer sees unit price and list price…".
//   Side card 440 "Sent & responses": newest-first Timeline items (response = success dot for ACCEPTED / PART
//   ACCEPTED, else neutral; sent = progress dot) or "Not sent yet. Send revision n to the customer."; actions at the
//   bottom by stage — ISSUED: Send to customer (primary) · WITH CUSTOMER: Send again (secondary) + Record response
//   (primary) · ACCEPTED / PART ACCEPTED: Draft sales order (primary, cart). Sent result 47089: success alert above.
// Data: GET /sales-quotes/:id (latest revision = highest revision_no); stage + customer name from
// GET /sales-supply/quotes?search=<quote number>. Sales never sees cost or margin.
// Deviations: the customer's city (header meta) and the sender's name (sent meta) have no API field; the ACCEPTED /
// PART ACCEPTED "Accepted" column has no API source (responses carry no lines) → omitted with a GapNote; a DRAFT
// latest revision (TO PRICE) shows a "Purchase is pricing" note and no actions.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconClipboardList, IconSearch, IconSend, IconShoppingCart } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { enumLabel, formatDate, formatDateTime, formatPaise } from '../../../lib/format';
import { apiStatus } from '../../../api/http';
import {
  Button, EmptyState, ErrorState, GapNote, Ic, InlineAlert, PageContent, PageHeader, StateCard, StatusPill, errorBody,
} from '../../../ui/desktop';
import { TimelineItem } from '../../purchase/sourcing/ui';
import { useQuote, useQuotes, type QuoteDetail, type QuoteStage, type ResponseKind } from '../api';
import { CardHead, DetailCard, KvBox, KvRow, LockNote, Spacer } from './local';
import { SalesLinesTable } from './QuoteLines';
import { latestRevision, revisionValue, termsLine } from './data';
import { DraftOrderDrawer, RecordResponseDrawer, SendQuoteDrawer, type Sent } from './SalesQuoteDrawers';

export function SalesQuotePage() {
  const { id = '' } = useParams();
  const q = useQuote(id);
  if (q.isPending) return <><PageHeader title="Quote" meta="Loading…" /><PageContent><QuoteSkeleton side={440} /></PageContent></>;
  if (q.isError) {
    return (
      <>
        <PageHeader title="Quote" />
        <PageContent>
          <StateCard>
            {apiStatus(q.error) === 404
              ? <EmptyState icon={IconSearch} title="Quote not found" body="It may belong to another company, or the link is wrong." />
              : <ErrorState title="Couldn't load the quote" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />}
          </StateCard>
        </PageContent>
      </>
    );
  }
  return <SalesQuoteView quote={q.data} />;
}

export function QuoteSkeleton({ side }: { side: number }) {
  return (
    <div className="flex w-full gap-[20px]">
      <DetailCard className="min-h-[600px] flex-1">
        {[260, 720, 720, 720, 480].map((w, i) => <div key={i} className="h-[14px] max-w-full animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />)}
      </DetailCard>
      <DetailCard className="min-h-[600px] shrink-0" >
        <div style={{ width: side - 50 }} className="flex flex-col gap-[14px]">
          {[160, 300, 260].map((w, i) => <div key={i} className="h-[14px] animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />)}
        </div>
      </DetailCard>
    </div>
  );
}

type Banner = { title: string; body: string } | null;

function SalesQuoteView({ quote }: { quote: QuoteDetail }) {
  const me = useMe();
  const isSales = me.role === 'SALES';
  const rowQ = useQuotes({ search: quote.quote_number, page_size: 5 });
  const row = rowQ.data?.rows.find((r) => r.quote_id === quote.id);
  const rev = latestRevision(quote);
  const [banner, setBanner] = useState<Banner>(null);
  const [drawer, setDrawer] = useState<'send' | 'response' | 'order' | null>(null);
  if (!rev) {
    return (
      <>
        <PageHeader title={quote.quote_number} />
        <PageContent><StateCard><EmptyState icon={IconSearch} title="No revision yet" body="Purchase hasn't started pricing this quote." /></StateCard></PageContent>
      </>
    );
  }
  const stage: QuoteStage | undefined = row?.stage;
  const customer = row?.customer_name ?? '…';
  const subtitle = `${quote.quote_number} · revision ${rev.revision_no} · ${customer}`;
  const issued = rev.revision_status === 'ISSUED';

  type Ev = { key: string; at: string; title: string; meta: string; tone: 'neutral' | 'progress' | 'success' };
  const events: Ev[] = [
    ...rev.dispatch_events.map((d) => ({
      key: d.id, at: d.sent_at, title: `Sent · ${enumLabel(d.channel)}`, meta: `${d.recipient_snapshot} · ${formatDateTime(d.sent_at)}`, tone: 'progress' as const,
    })),
    ...rev.customer_responses.map((r) => ({
      key: r.id, at: r.received_at, title: `Response · ${enumLabel(r.response_kind)}`,
      meta: `${r.notes ? `“${r.notes}” · ` : ''}${formatDateTime(r.received_at)}`,
      tone: (r.response_kind === 'ACCEPTED' || r.response_kind === 'PART_ACCEPTED' ? 'success' : 'neutral') as Ev['tone'],
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const onSent = (s: Sent) => {
    setDrawer(null);
    setBanner({ title: 'Sent and logged', body: `${enumLabel(s.channel)} to ${s.recipient} · ${formatDateTime(s.at)}.` });
  };
  const onRecorded = (k: ResponseKind) => {
    setDrawer(null);
    setBanner({ title: 'Response recorded', body: `${enumLabel(k)} on revision ${rev.revision_no}.` });
  };

  return (
    <>
      <PageHeader title={quote.quote_number} meta={`${customer} · revision ${rev.revision_no}`} />
      <PageContent className="flex-1">
        {banner && <InlineAlert tone="success" title={banner.title}>{banner.body}</InlineAlert>}
        <div className="flex min-h-[600px] w-full flex-1 items-stretch gap-[20px]">
          <DetailCard className="min-w-px flex-1">
            <CardHead title={`${quote.quote_number} · revision ${rev.revision_no}`}>
              {stage ? <StatusPill domain="supplyQuoteStage" value={stage} /> : <StatusPill domain="supplyRevision" value={rev.revision_status} />}
            </CardHead>
            {issued
              ? <LockNote>Issued by Purchase · prices are fixed. Changes need a new revision from Purchase.</LockNote>
              : rev.revision_status === 'DRAFT'
                ? <LockNote>Purchase is pricing revision {rev.revision_no}. Prices can change until Purchase issues it.</LockNote>
                : <LockNote>Revision {rev.revision_no} was cancelled by Purchase.</LockNote>}
            <SalesLinesTable lines={rev.lines} />
            {(stage === 'ACCEPTED' || stage === 'PART_ACCEPTED') && (
              <GapNote code="GAP">Accepted quantities per line aren't stored with the customer's response; they are set when the sales order is drafted.</GapNote>
            )}
            <KvBox>
              <KvRow label="Value (pre-tax)" mono>{formatPaise(revisionValue(rev.lines))}</KvRow>
              <KvRow label="Valid until">{formatDate(rev.validity_until)}</KvRow>
              <KvRow label="Payment · delivery · warranty">{termsLine(rev)}</KvRow>
              <KvRow label="Tax">{rev.tax_terms_snapshot ?? '—'}</KvRow>
            </KvBox>
            <p className="w-full text-[12px] leading-[16px] text-fg-muted">Customer sees unit price and list price. Supplier cost and margin are never shown in Sales.</p>
          </DetailCard>

          <DetailCard className="w-[440px] shrink-0">
            <CardHead title="Sent & responses" />
            {events.length === 0 ? (
              <p className="w-full text-[14px] leading-[20px] text-fg-2">
                {issued ? `Not sent yet. Send revision ${rev.revision_no} to the customer.` : 'Nothing sent yet — Purchase hasn’t issued this revision.'}
              </p>
            ) : (
              <div className="flex w-full flex-col">
                {events.map((e, i) => <TimelineItem key={e.key} title={e.title} meta={e.meta} tone={e.tone} last={i === events.length - 1} />)}
              </div>
            )}
            {row && row.sales_order_count > 0 && (
              <p className="w-full text-[12px] leading-[16px] text-fg-2">{row.sales_order_count} sales order{row.sales_order_count === 1 ? '' : 's'} drafted from this quote.</p>
            )}
            <Spacer />
            {isSales && issued && stage && (
              <div className="flex w-full items-start gap-[10px] [&>*]:min-w-px [&>*]:flex-1">
                {stage === 'ISSUED' && (
                  <Button kind="primary" icon={<Ic icon={IconSend} size={18} />} onClick={() => setDrawer('send')}>Send to customer</Button>
                )}
                {stage === 'WITH_CUSTOMER' && (
                  <>
                    <Button kind="secondary" icon={<Ic icon={IconSend} size={18} />} onClick={() => setDrawer('send')}>Send again</Button>
                    <Button kind="primary" icon={<Ic icon={IconClipboardList} size={18} />} onClick={() => setDrawer('response')}>Record response</Button>
                  </>
                )}
                {(stage === 'ACCEPTED' || stage === 'PART_ACCEPTED') && (
                  <Button kind="primary" icon={<Ic icon={IconShoppingCart} size={18} />} onClick={() => setDrawer('order')}>Draft sales order</Button>
                )}
              </div>
            )}
          </DetailCard>
        </div>
      </PageContent>
      {isSales && issued && (
        <>
          <SendQuoteDrawer open={drawer === 'send'} onClose={() => setDrawer(null)} revision={rev} subtitle={subtitle} onSent={onSent} />
          <RecordResponseDrawer open={drawer === 'response'} onClose={() => setDrawer(null)} revision={rev} subtitle={subtitle} onRecorded={onRecorded} />
          {stage && <DraftOrderDrawer open={drawer === 'order'} onClose={() => setDrawer(null)} revision={rev} subtitle={subtitle} stage={stage} />}
        </>
      )}
    </>
  );
}
