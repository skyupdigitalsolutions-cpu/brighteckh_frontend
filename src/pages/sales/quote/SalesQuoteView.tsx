// Sales quote view: the "To send" right-hand pane and the full quote page (/s/quotes/:quoteId).
// Figma (page 177:102060, section S-D · Sales · Desktop panel 177:137224):
//   SQ · To send · Q-00087 / Q-00086 / Q-00084  177:137360 / 177:137479 / 177:137586 → pane "Customer quote" 177:137385
//     glass-strong radius 24, p-24, gap 14; head 18/24 SemiBold + lock chip; meta row gap 36 (Job / Equipment /
//     Valid until / Revision); lines table; totals; spacer; send row (12/16 muted footnote + Preview + Send).
//   SQ · Sent · Q-00087 / 86 / 84  177:138183 / 177:138285 / 177:138387 → success alert after send.
//   SS · Q-00083 / Q-00082 SENT 177:138825 / 177:138868, Q-00081 ACCEPTED 177:138915, Q-00080 REJECTED 177:138975,
//   Q-00079 EXPIRED 177:139031 → page: header (quote no. + "customer · equipment · job"), locked banner, split
//     (quote card flex-1 | response card w-460, gap 20).
//   SS · response recorded 177:139171 → success alert above the banner.
//   Record response drawer 177:139083 → RecordResponseDrawer. PDF preview 177:137693/137869/138026 → QuotePreview.
//
// API reality (the full list is in the build report):
// - Send = POST /quotes/:id/send with NO body: no To/CC, email or PDF → no recipient inputs, GapNote G3.
// - BR-04 quote_status never becomes ACCEPTED/REJECTED/EXPIRED; the outcome badge is derived from the latest BR-05
//   response of the shown revision (matched on source_br04_quote_revision_id, never quote_revision_id).
// - Sent time/sender = revision sent_at / sent_by_name (GET /quotes/:id, from the BR04_QUOTE_SENT audit row). No
//   recipient exists, so Figma's "to purchase@…" is dropped.
// - Revision numbers are shown as stored (0-based), like the Purchase quote screens.
// - Equipment = the unit's observed make · model (assembly names are PURCHASE-only).
// - Sales never sees an unreleased DRAFT revision: the view shows the latest non-DRAFT revision.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconArrowLeft, IconClipboardText, IconEye, IconFileUnknown, IconPaperclip, IconSend } from '@tabler/icons-react';
import {
  Button, ButtonLink, EmptyState, ErrorState, GapNote, Ic, InlineAlert, PageContent, PageHeader, StateCard, cx, errorBody, FormErrors,
} from '../../../ui/desktop';
import { uploadPath } from '../../../ui/desktop/AuthedImage';
import { http, apiStatus } from '../../../api/http';
import { useMe } from '../../../auth/AuthProvider';
import { enumLabel, formatDate, formatDayTime } from '../../../lib/format';
import { isUuid } from '../../purchase/quotes/api';
import {
  daysSince, deriveStage, pickRevisions, useSalesQuoteData, useSendQuote, validityPassed,
  type ResponseEvent, type ResponseRecorded, type SalesQuote, type SalesRevision, type SalesStage,
} from './api';
import {
  BannerBadge, Card, DetailLines, DetailRow, LockChip, LockNote, LockedBanner, MetaItem, OutcomeBadge, PaneLines, Totals,
} from './parts';
import { RecordResponseDrawer } from './RecordResponseDrawer';
import { QuotePreview } from './QuotePreview';

// ------------------------------------------------------------------ model
type Flash = { kind: 'sent'; quoteNo: string; customer: string } | { kind: 'recorded'; type: ResponseEvent['response_type'] };

function useModel(quoteId: string | undefined) {
  const me = useMe();
  const d = useSalesQuoteData(quoteId);
  const quote = d.quote;
  const revs = quote ? pickRevisions(quote) : undefined;
  const shown = revs?.shown;
  const derived = shown ? deriveStage(shown, d.responses) : undefined;
  const isSales = me.role === 'SALES';
  const isLatest = !!shown && shown.id === revs?.overallLatest.id;
  const customerName = d.customer?.customer_name ?? (d.contextPending ? '…' : '—');
  const equipment = [d.unit?.observed_make, d.unit?.observed_model].filter(Boolean).join(' · ') || (d.contextPending ? '…' : '—');
  return {
    me, d, quote, shown, derived, isLatest, customerName, equipment,
    overallLatest: revs?.overallLatest,
    // Hidden, not disabled (rule 4). The server also requires the caller to be the assigned Sales person.
    canSend: isSales && isLatest && shown?.quote_status === 'RELEASED_TO_SALES' && shown.assigned_sales_id === me.id,
    releasedToOther: shown?.quote_status === 'RELEASED_TO_SALES' && shown.assigned_sales_id !== me.id,
    // Backend gap (G-S6): POST /jobs/:id/quote-responses only checks that the revision belongs to the job/company.
    // It does NOT check that the revision is the quote's LATEST one or that it is SENT, so a response could be
    // recorded against a DRAFT, RELEASED_TO_SALES or SUPERSEDED revision. The UI is the only guard: recording is
    // offered on the latest revision, only while it is SENT and still awaiting / in discussion.
    canRecord: isSales && isLatest && shown?.quote_status === 'SENT' && (derived?.stage === 'AWAITING' || derived?.stage === 'IN_DISCUSSION'),
  };
}
type Model = ReturnType<typeof useModel>;

// ------------------------------------------------------------------ shared blocks
function FlashAlert({ flash }: { flash: Flash | null }) {
  if (!flash) return null;
  if (flash.kind === 'sent') {
    return (
      <InlineAlert tone="success" title={`${flash.quoteNo} marked as sent to ${flash.customer}`}>
        It moved to Sent — record the customer’s response there. Nothing was emailed: send the quote to the customer yourself.
      </InlineAlert>
    );
  }
  return (
    <InlineAlert tone="success" title={`Response recorded · ${enumLabel(flash.type)}`}>
      {flash.type === 'ACCEPTED'
        ? 'Purchase will see it on the job and record the customer authority (PO / Job Order / Email).'
        : 'Purchase will see it on the job.'}
    </InlineAlert>
  );
}

function sentText(rev: SalesRevision) {
  if (rev.quote_status === 'SUPERSEDED') return 'Superseded by a newer revision from Purchase · read-only.';
  const who = rev.sent_by_name ? ` by ${rev.sent_by_name}` : '';
  return `${rev.sent_at ? `Sent ${formatDayTime(rev.sent_at)}${who}` : 'Sent'} · read-only. Changes need a new revision from Purchase.`;
}

function EvidenceLink({ uri }: { uri: string }) {
  const path = uploadPath(uri);
  const [failed, setFailed] = useState(false);
  if (!path) return <span className="break-all">{uri}</span>;
  const open = () => {
    const w = window.open('', '_blank');
    http.get<Blob>(path, { responseType: 'blob' })
      .then((r) => { const url = URL.createObjectURL(r.data); if (w) w.location.href = url; else window.open(url, '_blank'); })
      .catch(() => { w?.close(); setFailed(true); });
  };
  return (
    <button type="button" onClick={open} className="inline-flex items-center gap-[6px] text-brand-text underline-offset-2 hover:underline">
      <Ic icon={IconPaperclip} size={14} />{failed ? 'Couldn’t open — retry' : 'Open evidence'}
    </button>
  );
}

const FOOTNOTE: Partial<Record<SalesStage, string>> = {
  ACCEPTED: 'Next: Purchase records the customer authority',
  REJECTED: 'Purchase can create a revision to re-quote',
  EXPIRED: 'Purchase can create a revision if the customer comes back',
};

/** Response card body (177:138955): head + details box + footnote; history; Record response at the bottom. */
function ResponseBlock({ m, onRecord }: { m: Model; onRecord: () => void }) {
  const rev = m.shown!;
  const { stage, latest } = m.derived!;
  const waiting = stage === 'AWAITING' ? daysSince(rev.sent_at) : null;
  const history = m.d.responses;
  const showHistory = history.length > (latest ? 1 : 0);
  const open = stage === 'AWAITING' || stage === 'IN_DISCUSSION';
  return (
    <>
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h3 className="min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg">Customer response</h3>
        {rev.quote_status === 'SENT' && <OutcomeBadge stage={stage} latest={latest} />}
      </div>
      {m.d.responsesQ.isPending ? (
        <div role="status" aria-label="Loading responses" className="h-[12px] w-[200px] animate-pulse rounded-[6px] bg-disabled" />
      ) : m.d.responsesQ.isError ? (
        <ErrorState title="Couldn't load responses" body={errorBody(m.d.responsesQ.error)} onRetry={() => m.d.responsesQ.refetch()} retrying={m.d.responsesQ.isFetching} />
      ) : (
        <>
          {waiting != null && <p className="text-[14px] leading-[20px] text-fg-2">Waiting {waiting} {waiting === 1 ? 'day' : 'days'}</p>}
          {!latest && rev.quote_status !== 'SENT' && <p className="text-[14px] leading-[20px] text-fg-2">No response recorded for this revision.</p>}
          {latest && (
            <div className="flex w-full flex-col gap-[10px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[14px]">
              <DetailRow label="Channel">{latest.response_channel ? enumLabel(latest.response_channel) : '—'}</DetailRow>
              <DetailRow label="Contact">{latest.customer_contact || '—'}</DetailRow>
              <DetailRow label="Notes">{latest.response_notes ? `“${latest.response_notes}”` : '—'}</DetailRow>
              <DetailRow label="Recorded">{formatDayTime(latest.responded_at)}</DetailRow>
              {latest.evidence_uri && <DetailRow label="Evidence"><EvidenceLink uri={latest.evidence_uri} /></DetailRow>}
            </div>
          )}
          {FOOTNOTE[stage] && <LockNote>{FOOTNOTE[stage]}</LockNote>}
          {open && validityPassed(rev.valid_until) && (
            <p className="text-[12px] leading-[16px] text-warn-fg">
              Valid until {formatDate(rev.valid_until)} has passed. Nothing expires automatically — record EXPIRED if the customer didn’t reply.
            </p>
          )}
          {showHistory && (
            <div className="flex w-full flex-col gap-[6px]">
              <p className="text-[14px] font-semibold leading-[20px] text-fg">Response history</p>
              {history.map((r) => (
                <div key={r.id} className="flex w-full items-start gap-[10px] border-b border-line py-[6px] text-[12px] leading-[16px]">
                  <span className="w-[28px] shrink-0 font-mono text-fg-2">r{r.revision_no}</span>
                  <span className="min-w-px flex-1 font-medium text-fg">
                    {enumLabel(r.response_type)}{r.response_channel ? ` · ${enumLabel(r.response_channel)}` : ''}{r.customer_contact ? ` · ${r.customer_contact}` : ''}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-fg-2">{formatDayTime(r.responded_at)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="min-h-px w-px flex-1" />
      {m.canRecord && (
        <Button kind="primary" block icon={<Ic icon={IconClipboardText} size={18} />} onClick={onRecord}>Record response</Button>
      )}
    </>
  );
}

/** "Customer quote" card of the To send frames (177:137385); also used full-width on the page while RELEASED. */
function SendCard({ m, onSent, className }: { m: Model; onSent: (f: Flash) => void; className?: string }) {
  const quote = m.quote!;
  const rev = m.shown!;
  const [preview, setPreview] = useState(false);
  const send = useSendQuote(quote.id, quote.job_id);
  const released = rev.quote_status === 'RELEASED_TO_SALES';
  return (
    <Card className={cx('gap-[14px]', className)}>
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className="min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg">{quote.quote_number} · {m.customerName}</h2>
        <LockChip>Price set by Purchase · read-only</LockChip>
      </div>
      <div className="flex w-full items-start gap-[36px] overflow-clip">
        <MetaItem label="Job" value={m.d.job?.job_number ?? '…'} mono />
        <MetaItem label="Equipment" value={m.equipment} />
        <MetaItem label="Valid until" value={rev.valid_until ? formatDate(rev.valid_until) : '—'} />
        <MetaItem label="Revision" value={rev.revision_no} />
      </div>
      {!released && <LockedBanner badge={<BannerBadge rev={rev} stage={m.derived!.stage} latest={m.derived!.latest} />}>{sentText(rev)}</LockedBanner>}
      {m.releasedToOther && (
        <InlineAlert tone="neutral" title="Released to another Sales colleague">Only the Sales person Purchase released it to can send it.</InlineAlert>
      )}
      <PaneLines lines={rev.lines} />
      <Totals quote={quote} rev={rev} variant="pane" />
      {quote.quote_type === 'ASSEMBLED' && <p className="text-[12px] leading-[16px] text-fg-2">Assembled quotation — every component line is shown to the customer (full breakup).</p>}
      <div className="min-h-px w-px flex-1" />
      {m.canSend && (
        <GapNote code="G3">Send has no recipients: POST /quotes/:id/send takes no body, so no To / CC is stored and no email or PDF is sent. Send the quote to the customer yourself; this button records that it was sent.</GapNote>
      )}
      <FormErrors error={send.error} title="The quote wasn't marked as sent" />
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <p className="min-w-px flex-1 text-[12px] leading-[16px] text-fg-muted">Customer sees descriptions, quantities and prices only.</p>
        <Button kind="secondary" icon={<Ic icon={IconEye} size={18} />} onClick={() => setPreview(true)}>Preview</Button>
        {m.canSend && (
          <Button
            kind="primary"
            busy={send.isPending}
            icon={<Ic icon={IconSend} size={18} />}
            onClick={() => send.mutate(undefined, { onSuccess: () => onSent({ kind: 'sent', quoteNo: quote.quote_number, customer: m.customerName }) })}
          >
            Send to customer
          </Button>
        )}
      </div>
      <QuotePreview open={preview} onClose={() => setPreview(false)} quote={quote} rev={rev} companyId={m.me.company_id} customerName={m.customerName} equipment={m.equipment} />
    </Card>
  );
}

function RevisingAlert({ m }: { m: Model }) {
  if (m.isLatest || !m.overallLatest) return null;
  return (
    <InlineAlert tone="progress" title={`Purchase is preparing revision ${m.overallLatest.revision_no}`}>
      It appears here once Purchase releases it to Sales. Until then revision {m.shown!.revision_no} is shown, read-only.
    </InlineAlert>
  );
}

// ------------------------------------------------------------------ the four states
function Loading({ page }: { page?: boolean }) {
  return (
    <Card className={cx('w-full gap-[14px]', page ? 'min-h-[656px]' : 'h-full')}>
      <div role="status" aria-label="Loading quote" className="flex w-full flex-col gap-[14px]">
        <div className="h-[20px] w-[280px] animate-pulse rounded-[6px] bg-disabled" />
        <div className="h-[36px] w-full animate-pulse rounded-[18px] bg-disabled" />
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[40px] w-full animate-pulse rounded-[6px] bg-subtle" />)}
      </div>
    </Card>
  );
}

function Failed({ m, back }: { m: Model; back?: boolean }) {
  const q = m.d.quoteQ;
  const notFound = [403, 404].includes(apiStatus(q.error) ?? 0);
  return (
    <StateCard>
      {notFound ? (
        <EmptyState
          icon={IconFileUnknown}
          title="Quote not found"
          body="This quote doesn't exist in your company, or the link is wrong."
          action={back ? <ButtonLink to="/s/sent" kind="secondary">Back to sent quotes</ButtonLink> : undefined}
        />
      ) : (
        <ErrorState title="Couldn't load this quote" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
      )}
    </StateCard>
  );
}

function NotReleased() {
  return (
    <StateCard>
      <EmptyState icon={IconFileUnknown} title="Not released to Sales yet" body="Purchase is still pricing this quote. It appears here once it is released to Sales." />
    </StateCard>
  );
}

// ------------------------------------------------------------------ pane
/** Right-hand pane of the "To send" rail frames (177:137360 …). */
export function SalesQuotePane({ quoteId, onChanged }: { quoteId: string; onChanged?: () => void }) {
  const m = useModel(quoteId);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [lastId, setLastId] = useState(quoteId);
  if (lastId !== quoteId) { setLastId(quoteId); setFlash(null); setRecordOpen(false); }

  if (m.d.quoteQ.isPending) return <Loading />;
  if (m.d.quoteQ.isError || !m.quote) return <Failed m={m} />;
  if (!m.shown) return <NotReleased />;
  const sentState = m.shown.quote_status !== 'RELEASED_TO_SALES';
  return (
    <div className="flex h-full w-full min-w-0 flex-col gap-[20px]">
      <FlashAlert flash={flash} />
      {m.d.contextError && <InlineAlert tone="blocked" title="Some quote details didn't load">Job, customer or equipment couldn't be read. Prices and lines below are complete.</InlineAlert>}
      <RevisingAlert m={m} />
      <SendCard m={m} className="min-h-px w-full flex-1" onSent={(f) => { setFlash(f); onChanged?.(); }} />
      {sentState && (
        <Card className="w-full gap-[14px]">
          <ResponseBlock m={m} onRecord={() => setRecordOpen(true)} />
        </Card>
      )}
      <Recorder m={m} open={recordOpen} onClose={() => setRecordOpen(false)} onRecorded={(r) => { setRecordOpen(false); setFlash({ kind: 'recorded', type: r.response.response_type }); onChanged?.(); }} />
    </div>
  );
}

function Recorder({ m, open, onClose, onRecorded }: { m: Model; open: boolean; onClose: () => void; onRecorded: (r: ResponseRecorded) => void }) {
  if (!m.canRecord || !m.quote || !m.shown) return null;
  return (
    <RecordResponseDrawer
      open={open}
      onClose={onClose}
      onRecorded={onRecorded}
      jobId={m.quote.job_id}
      quoteId={m.quote.id}
      revision={m.shown}
      subtitle={`${m.quote.quote_number} · ${m.customerName} · revision ${m.shown.revision_no}`}
    />
  );
}

// ------------------------------------------------------------------ page
function headerMeta(m: Model) {
  return [m.customerName, m.d.unit?.observed_make, m.d.unit?.observed_model, m.d.unit?.serial_number, m.d.job?.job_number]
    .filter((x) => x && x !== '—').join(' · ');
}

function PageBody({ m, quote, onFlash, onRecord }: { m: Model; quote: SalesQuote; onFlash: (f: Flash) => void; onRecord: () => void }) {
  const rev = m.shown!;
  if (rev.quote_status === 'RELEASED_TO_SALES') return <SendCard m={m} className="min-h-[656px] w-full" onSent={onFlash} />;
  return (
    <>
      <LockedBanner badge={<BannerBadge rev={rev} stage={m.derived!.stage} latest={m.derived!.latest} />}>{sentText(rev)}</LockedBanner>
      <div className="flex min-h-[742px] w-full items-stretch gap-[20px]">
        <Card className="min-w-px flex-1 gap-[14px]">
          <h2 className="whitespace-nowrap text-[18px] font-semibold leading-[24px] text-fg">{quote.quote_number} · revision {rev.revision_no}</h2>
          <DetailLines lines={rev.lines} />
          <Totals quote={quote} rev={rev} variant="detail" />
          {quote.quote_type === 'ASSEMBLED' && <p className="text-[12px] leading-[16px] text-fg-2">Assembled quotation — every component line is shown to the customer (full breakup).</p>}
        </Card>
        <Card className="w-[460px] shrink-0 gap-[14px]">
          <ResponseBlock m={m} onRecord={onRecord} />
        </Card>
      </div>
    </>
  );
}

/** Full page at /s/quotes/:quoteId. */
export function SalesQuotePage() {
  const { quoteId = '' } = useParams();
  const valid = isUuid(quoteId);
  const m = useModel(valid ? quoteId : undefined);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const back = <ButtonLink to="/s/sent" kind="ghost" icon={<Ic icon={IconArrowLeft} size={18} />}>Sent quotes</ButtonLink>;

  let body;
  if (!valid) {
    body = <StateCard><EmptyState icon={IconFileUnknown} title="Quote not found" body="The link is wrong." action={<ButtonLink to="/s/sent" kind="secondary">Back to sent quotes</ButtonLink>} /></StateCard>;
  } else if (m.d.quoteQ.isPending) body = <Loading page />;
  else if (m.d.quoteQ.isError || !m.quote) body = <Failed m={m} back />;
  else if (!m.shown) body = <NotReleased />;
  else {
    body = (
      <>
        <FlashAlert flash={flash} />
        {m.d.contextError && <InlineAlert tone="blocked" title="Some quote details didn't load">Job, customer or equipment couldn't be read. Prices and lines below are complete.</InlineAlert>}
        <RevisingAlert m={m} />
        <PageBody m={m} quote={m.quote} onFlash={setFlash} onRecord={() => setRecordOpen(true)} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={m.quote?.quote_number ?? 'Quote'} meta={m.quote ? headerMeta(m) : undefined} action={back} />
      <PageContent>{body}</PageContent>
      <Recorder m={m} open={recordOpen} onClose={() => setRecordOpen(false)} onRecorded={(r) => { setRecordOpen(false); setFlash({ kind: 'recorded', type: r.response.response_type }); }} />
    </>
  );
}
