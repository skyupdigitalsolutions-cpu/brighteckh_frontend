// SQS1 drawers (Sales only).
// SendQuoteDrawer — 239:46898 → Drawer 239:46958 (560 wide): "Send quote", subtitle "SQ-… · revision n · Customer";
//   Channel * chips (EMAIL · WHATSAPP · PDF PRINT · OTHER) · Recipient * · neutral alert "What gets logged";
//   footer Cancel + "Send & log" (send icon). API: POST /sales-quote-revisions/:id/dispatch {channel, recipient,
//   document_evidence_uri?}. Deviations: "Note to customer" has no API field → replaced by the optional quote-document
//   upload the API does take; the alert says the stage moves to WITH CUSTOMER (the server derives it from the send),
//   not "stays ISSUED" as the frame text reads.
// RecordResponseDrawer — 239:47722 / 47955: "Record customer response", Response * chips (RESPONSE_KINDS), Notes,
//   neutral alert "After ACCEPTED or PART ACCEPTED". API: POST /sales-quote-revisions/:id/responses {response_kind,
//   notes?, response_evidence_uri?}. Deviations: "Customer contact" and the PART ACCEPTED "Accepted quantity per line"
//   table have no API field (GapNote) — accepted quantities are entered when the sales order is drafted; + optional
//   response evidence upload (API field).
// DraftOrderDrawer — not drawn as a drawer (SQS1 48205 / 48544 draw only the "Draft sales order" button); it reuses
//   the 47955 "Accepted quantity per line" table (Item flex · Quoted 70 → · Accepted * 90). API: POST /sales-orders
//   {quote_revision_id, customer_order_reference?, lines[{quote_line_id, accepted_qty}]} → /s/orders/:id.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCheck, IconSend, IconShoppingCart } from '@tabler/icons-react';
import { formatQty } from '../../../lib/format';
import { Button, Drawer, FormErrors, GapNote, Ic, InlineAlert, TextInput, cx } from '../../../ui/desktop';
import {
  DISPATCH_CHANNELS, RESPONSE_KINDS, supplyApi, useSupplyMutation, type DispatchChannel, type QuoteDispatchBody, type QuoteResponseBody,
  type QuoteRevision, type ResponseKind, type CreateOrderBody, type QuoteStage,
} from '../api';
import { Chips, EvidenceInput, MiniHead, SectionLabel, type Col } from './local';
import { cellText, itemLabel, useEvidence, useItems } from './data';

export type Sent = { channel: DispatchChannel; recipient: string; at: string };

export function SendQuoteDrawer({ open, onClose, revision, subtitle, onSent }: {
  open: boolean; onClose: () => void; revision: QuoteRevision; subtitle: string; onSent: (s: Sent) => void;
}) {
  const [channel, setChannel] = useState<DispatchChannel | null>(null);
  const [recipient, setRecipient] = useState('');
  const [tried, setTried] = useState(false);
  const evidence = useEvidence();
  const m = useSupplyMutation((b: QuoteDispatchBody) => supplyApi.sendQuote(revision.id, b));
  const reset = () => { setChannel(null); setRecipient(''); setTried(false); evidence.clear(); m.reset(); };
  const close = () => { reset(); onClose(); };
  const submit = () => {
    setTried(true);
    if (!channel || !recipient.trim() || evidence.busy || evidence.failed) return;
    m.mutate(
      { channel, recipient: recipient.trim(), ...(evidence.uri ? { document_evidence_uri: evidence.uri } : {}) },
      { onSuccess: (ev) => { reset(); onSent({ channel: ev.channel, recipient: ev.recipient_snapshot, at: ev.sent_at }); } },
    );
  };
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={560}
      bodyGap={16}
      title="Send quote"
      subtitle={subtitle}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} disabled={evidence.busy} icon={<Ic icon={IconSend} size={18} />}>Send &amp; log</Button>
        </>
      )}
    >
      <Chips label="Channel *" options={DISPATCH_CHANNELS} value={channel} onChange={setChannel} error={tried && !channel ? 'Choose how you sent it.' : null} />
      <TextInput
        label="Recipient *"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder="Email, phone number or name"
        error={tried && !recipient.trim() ? 'Required' : null}
      />
      <EvidenceInput evidence={evidence} prompt="Attach the quote document you sent (optional)" />
      <InlineAlert tone="neutral" title="What gets logged">
        Channel, recipient, time and revision are added to the sent log. The quote moves to WITH CUSTOMER until a response is recorded.
      </InlineAlert>
      {tried && evidence.failed && <p className="text-[12px] leading-[16px] text-st-blocked-fg">Retry or remove the document before sending.</p>}
      <FormErrors error={m.error} title="The send wasn't logged" />
    </Drawer>
  );
}

export function RecordResponseDrawer({ open, onClose, revision, subtitle, onRecorded }: {
  open: boolean; onClose: () => void; revision: QuoteRevision; subtitle: string; onRecorded: (k: ResponseKind) => void;
}) {
  const [kind, setKind] = useState<ResponseKind | null>(null);
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  const evidence = useEvidence();
  const m = useSupplyMutation((b: QuoteResponseBody) => supplyApi.recordResponse(revision.id, b));
  const reset = () => { setKind(null); setNotes(''); setTried(false); evidence.clear(); m.reset(); };
  const close = () => { reset(); onClose(); };
  const submit = () => {
    setTried(true);
    if (!kind || evidence.busy || evidence.failed) return;
    m.mutate(
      { response_kind: kind, ...(notes.trim() ? { notes: notes.trim() } : {}), ...(evidence.uri ? { response_evidence_uri: evidence.uri } : {}) },
      { onSuccess: (r) => { reset(); onRecorded(r.response_kind); } },
    );
  };
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={600}
      bodyGap={16}
      title="Record customer response"
      subtitle={subtitle}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} disabled={evidence.busy} icon={<Ic icon={IconCheck} size={18} />}>Save response</Button>
        </>
      )}
    >
      <Chips label="Response *" options={RESPONSE_KINDS} value={kind} onChange={setKind} error={tried && !kind ? 'Choose the customer’s response.' : null} />
      {kind === 'PART_ACCEPTED' && (
        <GapNote code="GAP">A response stores no per-line accepted quantity. Note what was accepted here; you enter the accepted quantities when you draft the sales order.</GapNote>
      )}
      <TextInput label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who answered and what they said" />
      <GapNote code="GAP">The response has no customer-contact field — put the contact name in Notes.</GapNote>
      <EvidenceInput evidence={evidence} prompt="Attach email / screenshot as evidence (optional)" />
      {(kind === 'ACCEPTED' || kind === 'PART_ACCEPTED') && (
        <InlineAlert tone="neutral" title="After ACCEPTED or PART ACCEPTED">You can draft a sales order from the accepted lines.</InlineAlert>
      )}
      {tried && evidence.failed && <p className="text-[12px] leading-[16px] text-st-blocked-fg">Retry or remove the evidence before saving.</p>}
      <FormErrors error={m.error} title="The response wasn't saved" />
    </Drawer>
  );
}

const ORDER_COLS: Col[] = [{ grow: true }, { w: 70, right: true }, { w: 90, right: true }];
const QTY_RE = /^\d+(\.\d{1,4})?$/;

export function DraftOrderDrawer({ open, onClose, revision, subtitle, stage }: {
  open: boolean; onClose: () => void; revision: QuoteRevision; subtitle: string; stage: QuoteStage;
}) {
  const nav = useNavigate();
  const items = useItems(revision.lines.map((l) => l.item_id));
  const initial = () => Object.fromEntries(revision.lines.map((l) => [l.id, stage === 'ACCEPTED' ? formatQty(l.qty).replace(/,/g, '') : '']));
  const [qty, setQty] = useState<Record<string, string>>(initial);
  // True once the user types a quantity. Until then the quantities follow the quote: they are refilled when the drawer
  // opens and whenever the stage / revision changes (e.g. a response turns the quote ACCEPTED while this page is open,
  // which used to leave the mount-time blanks in place). User edits are never overwritten.
  const [edited, setEdited] = useState(false);
  const [ref, setRef] = useState('');
  const [tried, setTried] = useState(false);
  const m = useSupplyMutation((b: CreateOrderBody) => supplyApi.createOrder(b));
  const linesKey = revision.lines.map((l) => `${l.id}:${l.qty}`).join('|');
  useEffect(() => {
    if (!edited) setQty(initial());
    // `initial` is derived from exactly stage + revision lines (linesKey); listing it would refire every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stage, revision.id, linesKey, edited]);
  const reset = () => { setQty(initial()); setEdited(false); setRef(''); setTried(false); m.reset(); };
  const close = () => { reset(); onClose(); };
  const filled = revision.lines.filter((l) => (qty[l.id] ?? '').trim() !== '');
  const bad = filled.filter((l) => !QTY_RE.test(qty[l.id]!.trim()) || Number(qty[l.id]) <= 0);
  const submit = () => {
    setTried(true);
    if (filled.length === 0 || bad.length > 0) return;
    m.mutate({
      quote_revision_id: revision.id,
      ...(ref.trim() ? { customer_order_reference: ref.trim() } : {}),
      lines: filled.map((l) => ({ quote_line_id: l.id, accepted_qty: Number(qty[l.id]!.trim()) })),
    }, { onSuccess: (o) => { reset(); onClose(); nav(`/s/orders/${o.id}`); } });
  };
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={560}
      bodyGap={16}
      title="Draft sales order"
      subtitle={subtitle}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} icon={<Ic icon={IconShoppingCart} size={18} />}>Draft sales order</Button>
        </>
      )}
    >
      <TextInput label="Customer order reference" value={ref} maxLength={160} onChange={(e) => setRef(e.target.value)} placeholder="e.g. the customer's PO number" />
      <SectionLabel>Accepted quantity per line</SectionLabel>
      <div className="flex w-full flex-col">
        <MiniHead cols={ORDER_COLS} labels={['Item', 'Quoted', 'Accepted *']} />
        {revision.lines.map((l) => {
          const v = qty[l.id] ?? '';
          const err = tried && v.trim() !== '' && (!QTY_RE.test(v.trim()) || Number(v) <= 0);
          return (
            <div key={l.id} className="flex w-full items-center gap-[12px] overflow-clip border-b border-line px-[16px] py-[12px]">
              <span className={cx(cellText.strong, 'min-w-px flex-1')}>{itemLabel(items.map[l.item_id]?.item_code, l.description_snapshot)}</span>
              <span className={cx(cellText.num, 'w-[70px] shrink-0 text-right')}>{formatQty(l.qty, l.uom)}</span>
              <input
                aria-label={`Accepted quantity for line ${l.line_no}`}
                inputMode="decimal"
                value={v}
                onChange={(e) => { setEdited(true); setQty((s) => ({ ...s, [l.id]: e.target.value })); }}
                className={cx(
                  'h-[36px] w-[90px] shrink-0 rounded-t-field border bg-surface px-[12px] font-mono text-[14px] leading-[20px] text-fg focus:outline-none focus:ring-inside-brand',
                  err ? 'border-danger' : 'border-line-strong',
                )}
              />
            </div>
          );
        })}
      </div>
      <p className="text-[12px] leading-[16px] text-fg-2">Leave a line empty to leave it out. Accepted quantity can't exceed the quoted quantity.</p>
      {tried && filled.length === 0 && <p className="text-[12px] leading-[16px] text-st-blocked-fg">Enter an accepted quantity on at least one line.</p>}
      {tried && bad.length > 0 && <p className="text-[12px] leading-[16px] text-st-blocked-fg">Accepted quantities must be numbers above 0.</p>}
      <FormErrors error={m.error} title="The sales order wasn't drafted" />
    </Drawer>
  );
}
