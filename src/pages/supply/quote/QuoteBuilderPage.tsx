// PQ1 · Quote builder (/p/supply/quotes/:id) — Figma 238:45367 DRAFT · 45746 add-line drawer · 46071 issue BLOCKED ·
// 46444 rev 1 ISSUED locked · 46887 new-revision drawer · 47221 cancel-revision drawer · 47553 rev 2 DRAFT result.
// Header: title = quote number, meta "Customer · from SE-… · revision n". Split (gap 20):
//   Left (flex, gap 20): Lines card (radius 24, p-24, gap 14): head "SQ-… · revision n" + revision badge + Add line
//   (secondary, DRAFT only); BuilderLinesTable; muted note. Revision terms card: 5 fields in a row (gap 12), lock icon
//   in the head once issued.
//   Right (360, gap 20): Totals card (head + PURCHASE ONLY badge; Value (pre-tax) box; G22 warning note); actions card —
//   DRAFT: "Issue to Sales" (revision list when there is history, checks line, blocked alert "Can't issue yet" + gated
//   action "Issue revision n", ghost "Cancel quote") · ISSUED: "Revision history" (list, lock note, Cancel revision
//   secondary + New revision primary) · CANCELLED: history + New revision.
//   Results (47553 etc.): success alert above the split.
// Data: GET /sales-quotes/:id (latest revision = highest revision_no); customer / enquiry / stage from
// GET /sales-supply/quotes?search=<number>; issue checks from GET /lookups/customers?ids= (status) and
// GET /masters/items/:id (status); the server's own reason is shown if the issue is still refused.
// Deviations: Supplier cost / Margin columns and the Supplier cost (landed) / Margin totals have no API source
// (BR-11 quote lines carry no supplier cost) → omitted with one GapNote. Revision terms are read-only (the API has
// no call to edit a DRAFT revision's terms; they are set by Start quote / New revision).
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconFilePlus, IconLock, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { apiStatus } from '../../../api/http';
import { enumLabel, formatDate, formatDateTime, formatPaise } from '../../../lib/format';
import {
  Badge, Button, EmptyState, ErrorState, FormErrors, GapNote, GatedAction, Ic, InlineAlert, PageContent, PageHeader, ReadOnlyField,
  StateCard, StatusPill, errorBody,
} from '../../../ui/desktop';
import { useCustomersByIds } from '../../purchase/api';
import { supplyApi, useQuote, useQuotes, useSupplyMutation, type QuoteDetail, type QuoteRevision } from '../api';
import { CardHead, DetailCard, KvBox, KvRow, LockNote, Spacer } from './local';
import { ALL_CUSTOMER_STATUSES, ISSUABLE_ITEM, latestRevision, revisionValue, useItems } from './data';
import { BuilderLinesTable } from './QuoteLines';
import { QuoteSkeleton } from './SalesQuotePage';
import { AddLineDrawer, CancelRevisionDrawer, NewRevisionDrawer } from './BuilderDrawers';

export function QuoteBuilderPage() {
  const { id = '' } = useParams();
  const q = useQuote(id);
  if (q.isPending) return <><PageHeader title="Quote" meta="Loading…" /><PageContent><QuoteSkeleton side={360} /></PageContent></>;
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
  return <Builder quote={q.data} />;
}

type Banner = { title: string; body: string } | null;

function Builder({ quote }: { quote: QuoteDetail }) {
  const me = useMe();
  const isPurchase = me.role === 'PURCHASE';
  const rowQ = useQuotes({ search: quote.quote_number, page_size: 5 });
  const row = rowQ.data?.rows.find((r) => r.quote_id === quote.id);
  const rev = latestRevision(quote);
  const [banner, setBanner] = useState<Banner>(null);
  const [drawer, setDrawer] = useState<'line' | 'revision' | 'cancel' | null>(null);

  if (!rev) {
    return (
      <>
        <PageHeader title={quote.quote_number} />
        <PageContent><StateCard><EmptyState icon={IconSearch} title="No revision yet" body="This quote has no revision to price." /></StateCard></PageContent>
      </>
    );
  }
  const draft = rev.revision_status === 'DRAFT';
  const issued = rev.revision_status === 'ISSUED';
  const customer = row?.customer_name ?? '…';
  const history = [...quote.revisions].sort((a, b) => b.revision_no - a.revision_no);

  return (
    <>
      <PageHeader title={quote.quote_number} meta={`${customer} · from ${row?.enquiry_number ?? '…'} · revision ${rev.revision_no}`} />
      <PageContent className="flex-1">
        {banner && <InlineAlert tone="success" title={banner.title}>{banner.body}</InlineAlert>}
        <div className="flex min-h-[640px] w-full flex-1 items-stretch gap-[20px]">
          <div className="flex min-w-px flex-1 flex-col gap-[20px]">
            <DetailCard className="w-full flex-1">
              <CardHead title={`${quote.quote_number} · revision ${rev.revision_no}`}>
                <StatusPill domain="supplyRevision" value={rev.revision_status} />
                {isPurchase && draft && (
                  <Button kind="secondary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setDrawer('line')}>Add line</Button>
                )}
              </CardHead>
              <BuilderLinesTable lines={rev.lines} locked={!draft} />
              <p className="w-full text-[12px] leading-[16px] text-fg-muted">Stock is indicative (ledger allocatable) — nothing is reserved by a quote.</p>
            </DetailCard>
            <TermsCard rev={rev} />
          </div>

          <div className="flex w-[360px] shrink-0 flex-col gap-[20px]">
            <DetailCard className="w-full">
              <CardHead title="Totals"><Badge tone="neutral" label="PURCHASE ONLY" /></CardHead>
              <KvBox>
                <KvRow label="Value (pre-tax)" mono>{rev.lines.length ? formatPaise(revisionValue(rev.lines)) : '—'}</KvRow>
              </KvBox>
              <GapNote code="GAP">Supplier cost and margin aren’t shown: BR-11 quote lines carry no supplier cost and no cost source is defined.</GapNote>
              <GapNote code="G22">CLIENT-UNCONFIRMED — discount / margin bands are not defined, so no band warning is shown.</GapNote>
            </DetailCard>

            <DetailCard className="w-full flex-1">
              <CardHead title={draft ? 'Issue to Sales' : 'Revision history'} />
              {(history.length > 1 || !draft) && <RevisionList revisions={history} />}
              <Spacer />
              {isPurchase && draft && (
                <IssuePanel
                  quote={quote}
                  rev={rev}
                  prevIssued={history.find((r) => r.revision_no < rev.revision_no && r.revision_status === 'ISSUED')}
                  onIssued={() => setBanner({ title: `Revision ${rev.revision_no} issued`, body: 'It is read-only now. Sales can send it to the customer.' })}
                  onCancel={() => setDrawer('cancel')}
                />
              )}
              {issued && <LockNote>Issued revisions are immutable. Changes need a new revision.</LockNote>}
              {isPurchase && !draft && (
                <div className="flex w-full items-start gap-[10px] [&>*]:min-w-px [&>*]:flex-1">
                  {issued && <Button kind="secondary" icon={<Ic icon={IconX} size={18} />} onClick={() => setDrawer('cancel')}>Cancel revision</Button>}
                  <Button kind="primary" icon={<Ic icon={IconFilePlus} size={18} />} onClick={() => setDrawer('revision')}>New revision</Button>
                </div>
              )}
            </DetailCard>
          </div>
        </div>
      </PageContent>

      {isPurchase && (
        <>
          {draft && (
            <AddLineDrawer
              open={drawer === 'line'}
              onClose={() => setDrawer(null)}
              revision={rev}
              subtitle={`${quote.quote_number} · revision ${rev.revision_no} (DRAFT)`}
              onAdded={() => setDrawer(null)}
            />
          )}
          {!draft && (
            <NewRevisionDrawer
              open={drawer === 'revision'}
              onClose={() => setDrawer(null)}
              quoteId={quote.id}
              from={rev}
              quoteNumber={quote.quote_number}
              onCreated={(n) => { setDrawer(null); setBanner({ title: `Revision ${n} created`, body: 'Add or check the lines, then issue.' }); }}
            />
          )}
          {rev.revision_status !== 'CANCELLED' && (
            <CancelRevisionDrawer
              open={drawer === 'cancel'}
              onClose={() => setDrawer(null)}
              revision={rev}
              quoteNumber={quote.quote_number}
              onCancelled={() => { setDrawer(null); setBanner({ title: `Revision ${rev.revision_no} cancelled`, body: 'Start a new revision to quote again.' }); }}
            />
          )}
        </>
      )}
    </>
  );
}

function TermsCard({ rev }: { rev: QuoteRevision }) {
  const locked = rev.revision_status !== 'DRAFT';
  return (
    <DetailCard className="w-full shrink-0">
      <CardHead title="Revision terms">{locked && <Ic icon={IconLock} size={18} className="text-fg-2" />}</CardHead>
      <div className="flex w-full items-start gap-[12px] [&>*]:min-w-px [&>*]:flex-1">
        <ReadOnlyField label="Valid until *" value={formatDate(rev.validity_until)} />
        <ReadOnlyField label="Payment terms" value={rev.payment_terms_snapshot ?? ''} />
        <ReadOnlyField label="Delivery terms" value={rev.delivery_terms_snapshot ?? ''} />
        <ReadOnlyField label="Warranty" value={rev.warranty_terms_snapshot ?? ''} />
        <ReadOnlyField label="Tax terms" value={rev.tax_terms_snapshot ?? ''} />
      </div>
      {!locked && <GapNote code="GAP">A DRAFT revision’s terms can’t be edited — the API sets them when the quote or revision is created.</GapNote>}
    </DetailCard>
  );
}

function RevisionList({ revisions }: { revisions: QuoteRevision[] }) {
  return (
    <div className="flex w-full flex-col gap-[10px]">
      {revisions.map((r) => (
        <div key={r.id} className="flex w-full items-center gap-[10px] overflow-clip rounded-[14px] bg-subtle px-[10px] py-[10px]">
          <div className="flex min-w-px flex-1 flex-col gap-[2px]">
            <p className="text-[14px] font-medium leading-[20px] text-fg">Revision {r.revision_no}</p>
            <p className="text-[12px] leading-[16px] text-fg-2">
              {formatDateTime(r.released_at ?? r.created_at)}{r.revision_reason ? ` · ${r.revision_reason}` : ''}
            </p>
          </div>
          <StatusPill domain="supplyRevision" value={r.revision_status} />
        </div>
      ))}
    </div>
  );
}

function IssuePanel({ quote, rev, prevIssued, onIssued, onCancel }: {
  quote: QuoteDetail; rev: QuoteRevision; prevIssued?: QuoteRevision; onIssued: () => void; onCancel: () => void;
}) {
  const cust = useCustomersByIds([quote.customer_id], { status: ALL_CUSTOMER_STATUSES });
  const items = useItems(rev.lines.map((l) => l.item_id));
  const m = useSupplyMutation((id: string) => supplyApi.issueRevision(id));
  const c = cust.data?.[quote.customer_id];
  const custOk = !c || c.status === 'APPROVED';
  const badItems = rev.lines
    .map((l) => items.map[l.item_id])
    .filter((it): it is NonNullable<typeof it> => !!it && !ISSUABLE_ITEM.includes(it.status));
  const itemsOk = badItems.length === 0;
  const hasLines = rev.lines.length > 0;
  const ready = hasLines && custOk && itemsOk;
  const mark = (ok: boolean) => (ok ? '✓' : '✗');

  const reasons: string[] = [];
  if (c && !custOk) reasons.push(`Customer ${c.customer_name} is not APPROVED (status ${enumLabel(c.status)}).`);
  for (const it of badItems) reasons.push(`Item ${it.item_code} is ${enumLabel(it.status)} — only APPROVED / ACTIVE items can be issued.`);
  const fix = !hasLines ? 'Add at least one line first'
    : !custOk && !itemsOk ? 'Approve the customer and the items first'
      : !custOk ? 'Approve the customer first' : 'Approve the items first';

  return (
    <div className="flex w-full flex-col gap-[14px]">
      <p className="w-full text-[12px] leading-[16px] text-fg-2">
        Checks: customer APPROVED {mark(custOk)} · all items APPROVED / ACTIVE {mark(itemsOk)} · lines added {mark(hasLines)} · validity set ✓
      </p>
      {reasons.length > 0 && <InlineAlert tone="blocked" title="Can't issue yet">{reasons.join(' ')}</InlineAlert>}
      <GatedAction
        ready={ready}
        reason={fix}
        readyNote={prevIssued
          ? `Ready to issue — revision ${rev.revision_no} replaces revision ${prevIssued.revision_no}`
          : `Ready to issue — revision ${rev.revision_no} becomes read-only`}
        primaryLabel={`Issue revision ${rev.revision_no}`}
        busy={m.isPending}
        onPrimary={() => m.mutate(rev.id, { onSuccess: () => { m.reset(); onIssued(); } })}
      />
      <FormErrors error={m.error} title="The revision wasn't issued" />
      <Button kind="ghost" block icon={<Ic icon={IconX} size={18} />} onClick={onCancel}>Cancel quote</Button>
    </div>
  );
}
