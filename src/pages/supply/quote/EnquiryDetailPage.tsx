// SE1 · Enquiry detail (/s/enquiries/:id) — Figma 237:42866 RECEIVED · 43149 QUOTED · 43441 CANCELLED ·
// 43716 cancel drawer · 43811 cancelled result.
// Header: title = enquiry number, meta "Customer · CHANNEL · received 04 Nov 2026, 10:42".
// Split (gap 20): Enquiry card (flex, radius 24, p-24, gap 14): head 18/24 + status badge; meta row gap 36 (Customer ·
// Channel · Received · Raised by; 12/16 secondary label over 14/20 Medium); quoted details (14/20 secondary); "Lines"
// 15/20 SemiBold; mini table Item flex · Qty 100 → · Condition 140; evidence line (16px file icon + 12/16 secondary).
// Side card 460: "Linked quotes" — RECEIVED: hint + Cancel enquiry (secondary, x) at the bottom; QUOTED: mini table
// Quote 150 · Rev 50 · Stage flex; CANCELLED: "No quote — enquiry was cancelled." + Cancelled by / at / Reason box +
// lock note. Result 43811: success alert "Enquiry cancelled" above the split.
// Data: GET /sales-enquiries/:id; customer + "Raised by" names from GET /sales-supply/enquiries?search=<number>;
// linked-quote revision + stage from GET /sales-supply/quotes?search=<number>; item codes from GET /masters/items/:id.
// Deviations: "Cancelled at" and a canceller name other than the owner have no API field (GapNote); the evidence line
// shows the stored upload id (the API keeps no original file name).
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconFilePlus, IconSearch, IconX } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { enumLabel, formatDateTime, formatQty } from '../../../lib/format';
import {
  Button, Drawer, EmptyState, ErrorState, FormErrors, GapNote, Ic, InlineAlert, PageContent, PageHeader, StateCard, StatusPill,
  TextInput, errorBody,
} from '../../../ui/desktop';
import { apiStatus } from '../../../api/http';
import { supplyApi, useEnquiries, useEnquiry, useQuotes, useSupplyMutation, type EnquiryDetail } from '../api';
import { CardHead, ConditionBadge, DetailCard, KvBox, KvRow, LockNote, MetaItem, MiniHead, MiniRow, SectionLabel, Spacer, type Col } from './local';
import { cellText, fileLabel, itemLabel, useItems } from './data';

const LINE_COLS: Col[] = [{ grow: true }, { w: 100, right: true }, { w: 140 }];
const QUOTE_COLS: Col[] = [{ w: 150 }, { w: 50 }, { grow: true }];

export function EnquiryDetailPage() {
  const { id = '' } = useParams();
  const q = useEnquiry(id);
  const [cancelled, setCancelled] = useState(false);

  if (q.isPending) return <><PageHeader title="Enquiry" meta="Loading…" /><PageContent><DetailSkeleton /></PageContent></>;
  if (q.isError) {
    const nf = apiStatus(q.error) === 404;
    return (
      <>
        <PageHeader title="Enquiry" />
        <PageContent>
          <StateCard>
            {nf
              ? <EmptyState icon={IconSearch} title="Enquiry not found" body="It may belong to another company, or the link is wrong." />
              : <ErrorState title="Couldn't load the enquiry" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />}
          </StateCard>
        </PageContent>
      </>
    );
  }
  return <EnquiryView e={q.data} cancelled={cancelled} onCancelled={() => setCancelled(true)} />;
}

function DetailSkeleton() {
  return (
    <div className="flex w-full gap-[20px]">
      <DetailCard className="min-h-[600px] flex-1">
        {[220, 480, 360, 640, 640].map((w, i) => <div key={i} className="h-[14px] animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />)}
      </DetailCard>
      <DetailCard className="min-h-[600px] w-[460px] shrink-0">
        {[160, 360].map((w, i) => <div key={i} className="h-[14px] animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />)}
      </DetailCard>
    </div>
  );
}

function EnquiryView({ e, cancelled, onCancelled }: { e: EnquiryDetail; cancelled: boolean; onCancelled: () => void }) {
  const me = useMe();
  const [cancelOpen, setCancelOpen] = useState(false);
  const rowQ = useEnquiries({ search: e.enquiry_number, page_size: 5 });
  const row = rowQ.data?.rows.find((r) => r.id === e.id);
  const quotesQ = useQuotes({ search: e.enquiry_number, page_size: 50 }, e.quotes.length > 0);
  const quoteRows = quotesQ.data?.rows ?? [];
  const items = useItems(e.lines.map((l) => l.item_id));
  const owner = row?.sales_owner_name ? `${row.sales_owner_name} · Sales` : '—';
  const customer = row?.customer_name ?? '…';
  const canCancel = me.role === 'SALES' && e.status === 'RECEIVED';
  const cancelledBy = e.cancelled_by_id && e.cancelled_by_id === e.sales_owner_id ? owner : null;

  return (
    <>
      <PageHeader title={e.enquiry_number} meta={`${customer} · ${enumLabel(e.enquiry_channel)} · received ${formatDateTime(e.created_at)}`} />
      <PageContent className="flex-1">
        {cancelled && e.status === 'CANCELLED' && (
          <InlineAlert tone="success" title="Enquiry cancelled">{e.enquiry_number} is now read-only.</InlineAlert>
        )}
        <div className="flex min-h-[600px] w-full flex-1 items-stretch gap-[20px]">
          <DetailCard className="min-w-px flex-1">
            <CardHead title={e.enquiry_number}><StatusPill domain="supplyEnquiry" value={e.status} /></CardHead>
            <div className="flex w-full items-start gap-[36px] overflow-clip">
              <MetaItem label="Customer">{customer}</MetaItem>
              <MetaItem label="Channel">{enumLabel(e.enquiry_channel)}</MetaItem>
              <MetaItem label="Received">{formatDateTime(e.created_at)}</MetaItem>
              <MetaItem label="Raised by">{owner}</MetaItem>
            </div>
            <p className="w-full text-[14px] leading-[20px] text-fg-2">“{e.enquiry_details}”</p>
            <SectionLabel>Lines</SectionLabel>
            <div className="flex w-full flex-col">
              <MiniHead cols={LINE_COLS} labels={['Item', 'Qty', 'Condition']} />
              {e.lines.map((l) => (
                <MiniRow
                  key={l.id}
                  cols={LINE_COLS}
                  cells={[
                    <span className={cellText.strong}>{itemLabel(l.item_id ? items.map[l.item_id]?.item_code : undefined, l.product_description)}</span>,
                    <span className={cellText.num}>{formatQty(l.requested_qty, l.uom)}</span>,
                    l.desired_condition ? <ConditionBadge value={l.desired_condition} /> : <span className="text-[14px] text-fg-muted">—</span>,
                  ]}
                />
              ))}
            </div>
            {e.source_evidence_uri && (
              <div className="flex w-full items-center gap-[8px] overflow-clip">
                <Ic icon={IconFilePlus} size={16} className="text-fg" />
                <p className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{fileLabel(e.source_evidence_uri)} · source evidence</p>
              </div>
            )}
          </DetailCard>

          <DetailCard className="w-[460px] shrink-0">
            <CardHead title="Linked quotes" />
            {e.status === 'CANCELLED' ? (
              <>
                <p className="w-full text-[14px] leading-[20px] text-fg-2">No quote — enquiry was cancelled.</p>
                <KvBox>
                  {cancelledBy && <KvRow label="Cancelled by">{cancelledBy}</KvRow>}
                  <KvRow label="Reason">{e.cancel_reason ?? '—'}</KvRow>
                </KvBox>
                <GapNote code="GAP">The enquiry read has no cancellation time{cancelledBy ? '' : ' and no canceller name'}.</GapNote>
                <LockNote>Cancelled enquiries are read-only.</LockNote>
              </>
            ) : e.quotes.length === 0 ? (
              <p className="w-full text-[14px] leading-[20px] text-fg-2">Purchase prices it next. The quote appears here once Purchase starts it (stage TO PRICE).</p>
            ) : (
              <div className="flex w-full flex-col">
                <MiniHead cols={QUOTE_COLS} labels={['Quote', 'Rev', 'Stage']} />
                {e.quotes.map((qt) => {
                  const r = quoteRows.find((x) => x.quote_id === qt.id);
                  return (
                    <MiniRow
                      key={qt.id}
                      cols={QUOTE_COLS}
                      to={`/s/product-quotes/${qt.id}`}
                      cells={[
                        <span className={cellText.id}>{qt.quote_number}</span>,
                        <span className={cellText.num}>{r ? r.revision_no : '—'}</span>,
                        r ? <StatusPill domain="supplyQuoteStage" value={r.stage} /> : <span className="text-[14px] text-fg-muted">—</span>,
                      ]}
                    />
                  );
                })}
              </div>
            )}
            <Spacer />
            {canCancel && (
              <div className="flex w-full items-start">
                <Button kind="secondary" block icon={<Ic icon={IconX} size={18} />} onClick={() => setCancelOpen(true)}>Cancel enquiry</Button>
              </div>
            )}
          </DetailCard>
        </div>
      </PageContent>
      {canCancel && (
        <CancelEnquiryDrawer
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          enquiry={e}
          customer={customer}
          onDone={() => { setCancelOpen(false); onCancelled(); }}
        />
      )}
    </>
  );
}

// 237:43716: title "Cancel enquiry", subtitle "SE-… · Customer"; blocked alert "This can't be undone"; Reason *
// (helper "Required"); footer Keep enquiry (secondary) + Cancel enquiry (danger, x icon).
function CancelEnquiryDrawer({ open, onClose, enquiry, customer, onDone }: {
  open: boolean; onClose: () => void; enquiry: EnquiryDetail; customer: string; onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const m = useSupplyMutation((r: string) => supplyApi.cancelEnquiry(enquiry.id, r));
  const close = () => { setReason(''); setTried(false); m.reset(); onClose(); };
  const submit = () => {
    setTried(true);
    if (!reason.trim()) return;
    m.mutate(reason.trim(), { onSuccess: () => { setReason(''); setTried(false); m.reset(); onDone(); } });
  };
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      bodyGap={16}
      title="Cancel enquiry"
      subtitle={`${enquiry.enquiry_number} · ${customer}`}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Keep enquiry</Button>
          <Button kind="danger" type="submit" busy={m.isPending} icon={<Ic icon={IconX} size={18} />}>Cancel enquiry</Button>
        </>
      )}
    >
      <InlineAlert tone="blocked" title="This can't be undone">The enquiry becomes read-only. Raise a new enquiry if the customer comes back.</InlineAlert>
      <TextInput
        label="Reason *"
        value={reason}
        autoFocus
        onChange={(ev) => setReason(ev.target.value)}
        helper="Required"
        error={tried && !reason.trim() ? 'Enter why the enquiry is cancelled.' : null}
      />
      <FormErrors error={m.error} title="The enquiry wasn't cancelled" />
    </Drawer>
  );
}
