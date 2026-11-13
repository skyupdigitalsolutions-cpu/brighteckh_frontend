// BR-04 customer quote — builder (manual pricing) + locked views, inside the job workspace Quote tab.
// Figma (page 177:102060):
//   D·P7 · Job · Quote builder (manual pricing) 177:103803 — draft revision, price inputs, Cost & margin + Totals
//   J5 · Quote · line added 177:116923 — new row (brand-tinted, focused price input)
//   J5 · Quote · discount above 10% (approval) 177:117093 — Totals gap 10, warning + Reason* + Approved by*
//   J5 · Quote · draft saved 177:117251 — success alert above the columns
//   J5 · Quote · released to Sales (locked) 177:117408 — progress alert, lock chips, "Create revision"
//   Q1 · SENT 177:125120 / ACCEPTED 177:125280 / REJECTED 177:125440 / revision 2 draft 177:125600
// Layout values: columns gap 16; lines card glass-strong p-20 gap-14 radius 24; header row bg-subtle radius 18
// px-14 py-10 gap-10; cells Type 140 · Description flex · Qty 40 → · UoM 44 · Net unit price 128 → · Line total 104 →;
// rows px-14 py-12 border-b; price input w-120 px-10 py-6 radius 10 bg-subtle 1px border-strong mono 14/20 SemiBold;
// locked chip = same box without border + 14px lock, gap 6. Right column w-380 gap 16; cards p-20 gap-14 radius 24;
// head 18/24 SemiBold; rows 14/20 (label secondary, value mono primary); divider 1px border-default;
// discount gate warning-bg radius 14 px-12 py-10 gap 8, 16px alert, 12/16 warning-fg.
//
// API reality (deviations recorded in the report):
// - Amounts are numeric RUPEES (decimal strings). revision_no starts at 0 (Figma "revision 1"); shown as the API value.
// - Every save is a NEW revision: create = POST /jobs/{id}/quotes (rev 0); later saves = POST /quotes/{id}/revise
//   (needs revision_reason → extra "Revision reason *" field, not in Figma).
// - There is no discount input: discount_percent is a DB column comparing this revision to the original authorised
//   price. The Discount chip is therefore read-only (API value of the saved revision).
// - Quote total: composition (freight / inspection fee) is a pending client decision (CLAUDE.md §5) and the API
//   returns no total, so the row shows "—" with a GapNote. Tax total and freight are typed (API inputs).
// - Material margin: no margin rule exists (BR-10's is UNVERIFIED) → "—" + GapNote. Material cost (landed) is the
//   DB-generated comparable_landed_cost of the chosen reference offer line.
// - Release to Sales needs assigned_sales_id → LookupPicker over active SALES employees (GET /lookups/employees).
//   GET /quotes/{id} does not return assigned_sales_id, so the released banner cannot name the Sales person
//   (Figma "Anita (Sales)").
// - The 10 % discount gate is enforced by the DB only; this screen never computes it — it shows the API error and
//   collects the approver (LookupPicker over all active employees: the API validates no role) + reason, then resends.
// - SENT banner: revisions have no sent_at / sender / recipient. The only send record is the BR04_QUOTE_SENT audit
//   row, which job progress (GET /jobs/{id}/progress, QUOTE stage `at`) exposes as the job's FIRST send — shown as such.
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconAlertTriangle, IconFilePlus, IconLock, IconPlus, IconSend, IconShieldCheck, IconX } from '@tabler/icons-react';
import type { Job, Quote, RepairQuoteLineBody } from '../api';
import { employeeSource, useCreateQuote, useJobProgress, useReleaseToSales, useReviseQuote } from '../api';
import {
  Badge, Button, ButtonLink, DateField, Drawer, FormErrors, GapNote, InlineAlert, LookupPicker, SelectField, StatusPill,
  TextInput, cx, Ic, useToast,
} from '../../../ui/desktop';
import { apiErrorText } from '../../../api/http';
import { enumLabel, formatDate, formatDateTime, formatINR, formatQty } from '../../../lib/format';
import {
  LINE_TYPES, QUOTE_TYPES, useJobOfferLines,
  type LineType, type QuoteResponse, type QuoteType, type RevisionWithLines,
} from './api';
import { formatPaiseBig, isDecimal, lineTotalPaise, paiseToDec, toPaise } from './money';

// ------------------------------------------------------------------ types
type DraftLine = {
  key: string;
  isNew: boolean;
  line_type: LineType;
  line_description: string;
  quantity: string;
  uom: string;
  price: string; // rupees, decimal string
};
export type Flash = { kind: 'saved' | 'revised' | 'released'; quoteId: string; revNo: number; prevNo?: number; at: string };

let seq = 0;
const newKey = () => `n${++seq}`;
const blankLine = (): DraftLine => ({ key: newKey(), isNew: true, line_type: 'MATERIAL', line_description: '', quantity: '1', uom: 'NOS', price: '' });
const trimDec = (v: string | null | undefined) => {
  if (v == null) return '';
  const m = /^(\d+)(?:\.(\d*?))?0*$/.exec(v);
  return m ? m[1] + (m[2] ? '.' + m[2] : '') : v;
};
const LOCKABLE_FOR_REVISION = new Set(['RELEASED_TO_SALES', 'SENT', 'REJECTED', 'EXPIRED']);

// ------------------------------------------------------------------ small pieces
function CardShell({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('glass-strong flex w-full flex-col items-start overflow-clip rounded-[24px] p-[20px]', className)}>{children}</section>;
}
function SumRow({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: 'success' }) {
  return (
    <div className="flex w-full items-start gap-[8px] overflow-clip text-[14px] leading-[20px]">
      <p className={cx('min-w-px flex-1 text-fg-2', strong && 'font-medium')}>{label}</p>
      <p className={cx('shrink-0 whitespace-nowrap font-mono', strong ? 'font-semibold' : 'font-normal', tone === 'success' ? 'text-st-success-fg' : 'text-fg')}>{value}</p>
    </div>
  );
}
function LockChip({ children, width = 120 }: { children: ReactNode; width?: number }) {
  return (
    <div className="flex shrink-0 items-start justify-end gap-[6px] overflow-clip rounded-[10px] bg-subtle px-[10px] py-[6px]" style={{ width }}>
      <span className="flex h-[20px] items-center"><Ic icon={IconLock} size={14} className="text-fg-2" /></span>
      <span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{children}</span>
    </div>
  );
}
/** Figma "Price input": shows ₹-formatted value at rest, the raw decimal while focused. */
function PriceInput({ value, onChange, invalid, label, autoFocus }: { value: string; onChange: (v: string) => void; invalid?: boolean; label: string; autoFocus?: boolean }) {
  const [focused, setFocused] = useState(!!autoFocus);
  const shown = focused ? value : (value === '' ? formatINR('0') : isDecimal(value) ? formatINR(value) : value);
  return (
    <div className={cx('flex w-[120px] shrink-0 items-start justify-end overflow-clip rounded-[10px] border border-line-strong bg-subtle px-[10px] py-[6px] focus-within:ring-inside-brand', invalid && 'ring-inside-danger')}>
      <input
        aria-label={label}
        inputMode="decimal"
        autoFocus={autoFocus}
        value={shown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/[₹,\s]/g, ''))}
        className="w-full min-w-0 bg-transparent text-right font-mono text-[14px] font-semibold leading-[20px] text-fg focus:outline-none"
      />
    </div>
  );
}
function BadgeSelect<V extends string>({ value, options, onChange, label }: { value: V; options: V[]; onChange: (v: V) => void; label: string }) {
  return (
    <span className="relative inline-flex shrink-0 items-center gap-[6px] rounded-t-sm border border-st-neutral-bd bg-st-neutral-bg px-[8px] py-[3px] text-st-neutral-fg">
      <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-current" aria-hidden />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
        className="cursor-pointer appearance-none bg-transparent text-[11px] font-semibold leading-[14px] tracking-[0.44px] focus:outline-none"
      >
        {options.map((o) => <option key={o} value={o}>{enumLabel(o)}</option>)}
      </select>
    </span>
  );
}

// ------------------------------------------------------------------ banner per state
function StateBanner({ quote, latest, flash, responses }: { quote: Quote; latest: RevisionWithLines; flash?: Flash; responses: QuoteResponse[] }) {
  const status = latest.quote_status;
  const progressQ = useJobProgress(status === 'SENT' ? quote.job_id : undefined);
  const sentStage = progressQ.data?.stages.find((s) => s.key === 'QUOTE');
  const firstSent = sentStage?.status === 'done' ? sentStage.at : null;
  const mine = responses.filter((r) => r.quote_revision_id === latest.id);
  const last = mine[0];
  if (status === 'DRAFT' && flash && flash.quoteId === quote.id && flash.revNo === latest.revision_no) {
    if (flash.kind === 'revised') {
      const prev = quote.revisions.find((r) => r.revision_no === flash.prevNo);
      return (
        <InlineAlert tone="progress" title={`Revision ${latest.revision_no} created`}>
          Copied from revision {flash.prevNo}{prev?.quote_status === 'SUPERSEDED' ? ', which is now SUPERSEDED' : ''}. Adjust prices and release to Sales again.
        </InlineAlert>
      );
    }
    if (flash.kind === 'saved') {
      return (
        <InlineAlert tone="success" title="Draft saved">
          {quote.quote_number} revision {latest.revision_no} · {formatDateTime(latest.created_at)}. Release to Sales when prices are final.
        </InlineAlert>
      );
    }
  }
  if (status === 'RELEASED_TO_SALES') {
    // Figma names the Sales person ("Anita (Sales)"); GET /quotes/{id} does not return assigned_sales_id.
    return <InlineAlert tone="progress" title="Released to Sales">Sales will check and send it to the customer. Prices are now locked.</InlineAlert>;
  }
  if (status === 'SENT') {
    return (
      <>
        <InlineAlert tone="progress" title="Sent to customer · awaiting response">
          Sales sent revision {latest.revision_no}. Locked — changes need a revision.
          {firstSent && <> First sent to the customer on this job: {formatDateTime(firstSent)}.</>}
          {last && last.response_type !== 'AWAITING_RESPONSE' && <> Latest customer response: {enumLabel(last.response_type)} · {formatDateTime(last.responded_at)}.</>}
        </InlineAlert>
        <GapNote code="G-D-5">Sent metadata: there is no sender, recipient or send time per revision beyond the BR04_QUOTE_SENT audit row. The time shown is the job's first send (job progress).</GapNote>
      </>
    );
  }
  if (status === 'ACCEPTED') {
    const acc = mine.find((r) => r.response_type === 'ACCEPTED');
    return (
      <InlineAlert tone="success" title={acc ? `Customer accepted · ${formatDateTime(acc.responded_at)}${acc.response_channel ? ` via ${acc.response_channel}` : ''}` : 'Customer accepted'}>
        Next: record the customer authority (PO, Job Order or Email) so the job can be authorised.
      </InlineAlert>
    );
  }
  if (status === 'REJECTED') {
    const rej = mine.find((r) => r.response_type === 'REJECTED');
    return (
      <InlineAlert tone="blocked" title={`Customer rejected revision ${latest.revision_no}`}>
        {rej?.response_notes ? <>Reason: “{rej.response_notes}”. </> : null}Create a revision to re-quote.
      </InlineAlert>
    );
  }
  if (status === 'EXPIRED') {
    return <InlineAlert tone="blocked" title={`Revision ${latest.revision_no} expired`}>Create a revision to re-quote.</InlineAlert>;
  }
  return null;
}

// ------------------------------------------------------------------ main
export function QuoteBuilder({ job, quote, responses, canWork, canSeeCost, startRevise, flash, onFlash, onCreated, onCancelCreate }: {
  job: Job;
  /** undefined = create a new quote for this job. */
  quote?: Quote;
  responses: QuoteResponse[];
  canWork: boolean;
  canSeeCost: boolean;
  startRevise?: boolean;
  flash?: Flash;
  onFlash: (f: Flash) => void;
  onCreated?: (quoteId: string) => void;
  onCancelCreate?: () => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const latest = quote ? quote.revisions[quote.revisions.length - 1] : undefined;
  const status = latest?.quote_status;
  const isCreate = !quote;

  const [reviseMode, setReviseMode] = useState(!!startRevise && !!status && LOCKABLE_FOR_REVISION.has(status) && canWork);
  const editable = canWork && (isCreate || status === 'DRAFT' || reviseMode);

  // ---- form state (initialised from the latest revision; the whole component is re-keyed per revision)
  const initial = useMemo(() => ({
    quoteType: (quote?.quote_type ?? 'ITEM') as QuoteType,
    lines: latest
      ? latest.lines.map<DraftLine>((l) => ({
        key: l.id, isNew: false, line_type: l.line_type, line_description: l.line_description,
        quantity: trimDec(l.quantity), uom: l.uom, price: trimDec(l.net_unit_price_pre_tax),
      }))
      : [blankLine()],
    freight: latest ? trimDec(latest.freight_charge) : '',
    tax: latest ? trimDec(latest.tax_total) : '',
    validUntil: latest?.valid_until ? latest.valid_until.slice(0, 10) : '',
    refOffer: latest?.reference_offer_line_id ?? '',
    procOffer: latest?.procurement_offer_line_id ?? '',
  }), [quote, latest]);
  const [form, setForm] = useState(initial);
  const [reason, setReason] = useState('');
  const [showApproval, setShowApproval] = useState(false);
  const [approver, setApprover] = useState<string | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const dirty = isCreate || JSON.stringify(form) !== JSON.stringify(initial);

  const createM = useCreateQuote(job.id);
  const reviseM = useReviseQuote(quote?.id ?? '', job.id);
  const releaseM = useReleaseToSales(quote?.id ?? '', job.id);
  const saveM = isCreate ? createM : reviseM;
  const offers = useJobOfferLines(job.id, canSeeCost);

  const setLine = (key: string, patch: Partial<DraftLine>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  // ---- derived money (display only; the server recomputes revised_pre_tax from the lines)
  const view = editable ? form.lines : (latest?.lines ?? []).map<DraftLine>((l) => ({
    key: l.id, isNew: false, line_type: l.line_type, line_description: l.line_description, quantity: l.quantity, uom: l.uom, price: l.net_unit_price_pre_tax,
  }));
  const lineTotals = view.map((l) => lineTotalPaise(l.quantity, toPaise(l.price)));
  const revisedPaise = lineTotals.every((t) => t != null) ? lineTotals.reduce<bigint>((s, t) => s + (t ?? 0n), 0n) : null;
  const materialPaise = view.reduce<bigint | null>((s, l, i) => (l.line_type === 'MATERIAL' ? (s == null || lineTotals[i] == null ? null : s + lineTotals[i]!) : s), 0n);
  const originalPaise = latest ? toPaise(latest.original_authorised_pre_tax) : revisedPaise;
  const savedRevised = latest ? toPaise(latest.revised_pre_tax) : null;
  const showSavedDiscount = !!latest && (!editable || !dirty) && latest.discount_percent != null;
  const refOfferId = editable ? form.refOffer : latest?.reference_offer_line_id ?? '';
  const procOfferId = editable ? form.procOffer : latest?.procurement_offer_line_id ?? '';
  const refOffer = offers.options.find((o) => o.line.id === refOfferId);
  const procOffer = offers.options.find((o) => o.line.id === procOfferId);

  // ---- validation (input shape only; business rules are the server's)
  const lineErr = (l: DraftLine) => ({
    desc: !l.line_description.trim(),
    qty: !isDecimal(l.quantity) || toPaise(l.quantity) === 0n,
    uom: !l.uom.trim(),
    price: !isDecimal(l.price),
  });
  const linesValid = form.lines.length > 0 && form.lines.every((l) => !Object.values(lineErr(l)).some(Boolean));
  const optDecOk = (v: string) => v === '' || isDecimal(v);
  const reasonMissing = !isCreate && !reason.trim();
  const approvalInvalid = showApproval && (!approver || !approvalReason.trim());

  function body() {
    const lines: RepairQuoteLineBody[] = form.lines.map((l) => ({
      line_type: l.line_type,
      line_description: l.line_description.trim(),
      quantity: Number(l.quantity),
      uom: l.uom.trim().toUpperCase(),
      net_unit_price_pre_tax: Number(l.price),
    }));
    return {
      lines,
      ...(form.tax !== '' ? { tax_total: Number(form.tax) } : {}),
      ...(form.freight !== '' ? { freight_charge: Number(form.freight) } : {}),
      ...(form.validUntil ? { valid_until: form.validUntil } : {}),
      ...(form.refOffer ? { reference_offer_line_id: form.refOffer } : {}),
      ...(form.procOffer ? { procurement_offer_line_id: form.procOffer } : {}),
    };
  }

  function save() {
    setAttempted(true);
    if (!linesValid || !optDecOk(form.tax) || !optDecOk(form.freight) || reasonMissing || approvalInvalid) return;
    if (isCreate) {
      createM.mutate({ quote_type: form.quoteType, ...body() }, {
        onSuccess: (q) => {
          onFlash({ kind: 'saved', quoteId: q.id, revNo: q.revision.revision_no, at: q.revision.created_at });
          onCreated?.(q.id);
        },
      });
      return;
    }
    const wasRevise = reviseMode;
    reviseM.mutate({
      revision_reason: reason.trim(),
      ...body(),
      ...(showApproval && approver ? { higher_discount_approved_by_id: approver, higher_discount_reason: approvalReason.trim() } : {}),
    }, {
      onSuccess: (q) => onFlash({ kind: wasRevise ? 'revised' : 'saved', quoteId: q.id, revNo: q.revision.revision_no, prevNo: latest?.revision_no, at: q.revision.created_at }),
      onError: (e) => {
        // The DB's discount gate answer (see Br04Service.reviseQuote). Show the approval fields; never decide it here.
        if (/10\s?%|higher.discount/i.test(apiErrorText(e))) setShowApproval(true);
      },
    });
  }

  // ------------------------------------------------------------------ render
  const headTitle = quote ? `${quote.quote_number} · revision ${reviseMode ? `${latest!.revision_no + 1} (new)` : latest!.revision_no}` : 'New quote';
  const discountGateText = 'Above 10 % needs an approver and a reason.';
  const saveError = saveM.error;
  const approvalNeededByApi = showApproval && saveError && /10\s?%|higher.discount/i.test(apiErrorText(saveError));

  const banner = quote && latest ? <StateBanner quote={quote} latest={latest} flash={reviseMode ? undefined : flash} responses={responses} /> : null;

  return (
    <>
      {banner}
      <div className={cx('flex w-full items-stretch gap-[16px]', banner ? 'min-h-[650px]' : 'min-h-[738px]')}>
        {/* ---------------- Quote lines */}
        <CardShell className="min-w-px flex-1 gap-[14px]">
          <div className="flex w-full items-center gap-[10px] overflow-clip">
            <h2 className="min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg">{headTitle}</h2>
            {latest && !reviseMode ? <StatusPill domain="quote" value={latest.quote_status} /> : <Badge tone="neutral" label="DRAFT" />}
            {isCreate && editable
              ? <BadgeSelect label="Quote type" value={form.quoteType} options={QUOTE_TYPES} onChange={(v) => setForm((f) => ({ ...f, quoteType: v }))} />
              : <Badge tone="neutral" label={enumLabel(quote!.quote_type)} />}
          </div>

          <div role="row" className="flex w-full items-start gap-[10px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
            {[['Type', 140, false], ['Description', 0, false], ['Qty', 40, true], ['UoM', 44, false], ['Net unit price', 128, true], ['Line total', 104, true]].map(([t, w, r]) => (
              <div key={t as string} role="columnheader" className={cx('flex items-center overflow-clip', w ? 'shrink-0' : 'min-w-px flex-1', r ? 'justify-end' : false)} style={w ? { width: w as number } : undefined}>
                <span className="whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{t}</span>
              </div>
            ))}
          </div>

          <div className="flex w-full flex-col" role="rowgroup">
            {view.map((l, i) => {
              const err = attempted && editable ? lineErr(l) : { desc: false, qty: false, uom: false, price: false };
              const newRow = editable && l.isNew;
              return (
                <div key={l.key} role="row" className={cx('flex w-full items-center gap-[10px] overflow-clip border-b border-line px-[14px] py-[12px]', newRow && 'bg-[rgba(218,74,60,0.08)]')}>
                  <div className="flex w-[140px] shrink-0 items-center overflow-clip">
                    {newRow
                      ? <BadgeSelect label={`Line ${i + 1} type`} value={l.line_type} options={LINE_TYPES} onChange={(v) => setLine(l.key, { line_type: v })} />
                      : <Badge tone="neutral" label={enumLabel(l.line_type)} />}
                  </div>
                  <div className="flex min-w-px flex-1 items-center gap-[8px] overflow-clip">
                    {newRow ? (
                      <>
                        <input
                          aria-label={`Line ${i + 1} description`}
                          value={l.line_description}
                          placeholder="Describe the line…"
                          onChange={(e) => setLine(l.key, { line_description: e.target.value })}
                          className={cx('min-w-0 flex-1 rounded-[6px] bg-transparent text-[14px] font-medium leading-[20px] text-fg placeholder:text-fg-muted focus:outline-none', err.desc && 'ring-inside-danger')}
                        />
                        <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((x) => x.key !== l.key) }))} className="flex h-[20px] w-[20px] shrink-0 items-center justify-center text-fg-2 hover:text-fg">
                          <Ic icon={IconX} size={16} />
                        </button>
                      </>
                    ) : <p className="truncate whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{l.line_description}</p>}
                  </div>
                  <div className="flex w-[40px] shrink-0 items-center justify-end overflow-clip">
                    {newRow
                      ? <input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} className={cx('w-full rounded-[6px] bg-transparent text-right font-mono text-[14px] leading-[20px] text-fg focus:outline-none', err.qty && 'ring-inside-danger')} />
                      : <p className="whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg">{formatQty(l.quantity)}</p>}
                  </div>
                  <div className="flex w-[44px] shrink-0 items-center overflow-clip">
                    {newRow
                      ? <input aria-label={`Line ${i + 1} unit`} value={l.uom} onChange={(e) => setLine(l.key, { uom: e.target.value })} className={cx('w-full rounded-[6px] bg-transparent text-[14px] leading-[20px] text-fg-2 focus:outline-none', err.uom && 'ring-inside-danger')} />
                      : <p className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{l.uom}</p>}
                  </div>
                  <div className="flex w-[128px] shrink-0 items-center justify-end overflow-clip">
                    {editable
                      ? <PriceInput label={`Line ${i + 1} net unit price`} value={l.price} invalid={err.price} autoFocus={newRow && i === view.length - 1 && i > 0} onChange={(v) => setLine(l.key, { price: v })} />
                      : <LockChip>{formatINR(l.price)}</LockChip>}
                  </div>
                  <div className="flex w-[104px] shrink-0 items-center justify-end overflow-clip">
                    <p className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatPaiseBig(lineTotals[i])}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {editable && (
            <div className="flex items-start overflow-clip">
              <Button kind="ghost" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, blankLine()] }))}>Add line</Button>
            </div>
          )}
          {editable && attempted && !linesValid && (
            <InlineAlert tone="blocked" title="Some lines are incomplete">
              {form.lines.length === 0 ? 'Add at least one line.' : 'Every line needs a description, a quantity above 0, a unit and a unit price you type.'}
            </InlineAlert>
          )}
          {quote?.quote_type === 'ASSEMBLED' && (
            <p className="text-[12px] leading-[16px] text-fg-2">Assembled quotation — every component line above is shown to the customer (full breakup).</p>
          )}
        </CardShell>

        {/* ---------------- Right column */}
        <div className="flex w-[380px] shrink-0 flex-col gap-[16px] overflow-clip">
          {canSeeCost && (
            <CardShell className="gap-[14px]">
              <div className="flex w-full items-center gap-[10px] overflow-clip">
                <h3 className="min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg">Cost &amp; margin</h3>
                <div className="flex shrink-0 items-center gap-[6px] overflow-clip rounded-[14px] bg-subtle py-[6px] pl-[10px] pr-[12px]">
                  <Ic icon={IconLock} size={14} className="text-fg-2" />
                  <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">Purchase only</span>
                </div>
              </div>
              {editable ? (
                <>
                  <SelectField label="Pricing reference offer" value={form.refOffer} onChange={(e) => setForm((f) => ({ ...f, refOffer: e.target.value }))} helper={offers.isError ? "Couldn't load this job's RFQ offers." : offers.isPending ? 'Loading offers…' : offers.options.length === 0 ? 'No supplier offers on this job yet.' : undefined}>
                    <option value="">None</option>
                    {offers.options.map((o) => <option key={o.line.id} value={o.line.id}>{o.label}</option>)}
                  </SelectField>
                  <SelectField label="Procurement offer" value={form.procOffer} onChange={(e) => setForm((f) => ({ ...f, procOffer: e.target.value }))}>
                    <option value="">None</option>
                    {offers.options.map((o) => <option key={o.line.id} value={o.line.id}>{o.label}</option>)}
                  </SelectField>
                </>
              ) : (
                <>
                  <SumRow label="Pricing reference" value={refOffer ? refOffer.label.split(' · ').slice(0, 2).join(' · ') : refOfferId ? '…' : '—'} />
                  <SumRow label="Procurement offer" value={procOffer ? procOffer.label.split(' · ').slice(0, 2).join(' · ') : procOfferId ? '…' : '—'} />
                </>
              )}
              <SumRow label="Material cost (landed)" value={refOffer?.line.comparable_landed_cost ? formatINR(refOffer.line.comparable_landed_cost) : '—'} />
              <SumRow label="Material price" value={formatPaiseBig(materialPaise)} />
              <SumRow label="Material margin" value="—" strong tone="success" />
              <div className="flex h-[8px] w-full items-start overflow-clip rounded-[4px] bg-subtle" aria-hidden />
              <GapNote code="G-D-3">No margin rule is defined (BR-10's margin is UNVERIFIED), so no margin is computed. Landed cost is the reference offer line's DB value.</GapNote>
            </CardShell>
          )}

          <CardShell className={cx('min-h-px flex-1', showApproval ? 'gap-[10px]' : 'gap-[14px]')}>
            <h3 className="w-full text-[18px] font-semibold leading-[24px] text-fg">Totals</h3>
            <SumRow label="Original authorised (pre-tax)" value={formatPaiseBig(originalPaise)} />
            <div className="flex w-full items-center gap-[8px] overflow-clip">
              <p className="min-w-px flex-1 text-[14px] leading-[20px] text-fg-2">Discount</p>
              <LockChip width={70}>{showSavedDiscount ? `${trimDec(latest!.discount_percent)} %` : '—'}</LockChip>
              <p className="shrink-0 whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg">
                {showSavedDiscount && originalPaise != null && savedRevised != null ? `−${formatINR(paiseToDec(originalPaise - savedRevised)).replace('-', '')}` : '—'}
              </p>
            </div>
            <SumRow label="Revised (pre-tax)" value={formatPaiseBig(revisedPaise)} />
            {editable ? (
              <>
                <MoneyRow label="Freight" value={form.freight} invalid={attempted && !optDecOk(form.freight)} onChange={(v) => setForm((f) => ({ ...f, freight: v }))} />
                <MoneyRow label="Tax total" value={form.tax} invalid={attempted && !optDecOk(form.tax)} onChange={(v) => setForm((f) => ({ ...f, tax: v }))} />
              </>
            ) : (
              <>
                <SumRow label="Freight" value={formatINR(latest?.freight_charge)} />
                <SumRow label="Tax total" value={formatINR(latest?.tax_total)} />
              </>
            )}
            <div className="h-px w-full shrink-0 bg-line" />
            <SumRow label="Quote total" value="—" strong />
            <GapNote code="G-D-2">Quote total composition (freight / inspection fee) is an open client decision; the API stores pre-tax, tax and freight separately and returns no total.</GapNote>

            {approvalNeededByApi || (showApproval && editable) ? (
              <div className="flex w-full items-start gap-[8px] overflow-clip rounded-[14px] bg-warn-bg px-[12px] py-[10px] text-warn-fg">
                <Ic icon={IconAlertTriangle} size={16} />
                <p className="min-w-px flex-1 text-[12px] leading-[16px]">
                  {approvalNeededByApi ? `${apiErrorText(saveError)}. ` : ''}Add an approver and a reason, then save again.
                </p>
              </div>
            ) : (
              <div className="flex w-full items-center gap-[8px] overflow-clip rounded-[14px] bg-warn-bg px-[12px] py-[10px] text-warn-fg">
                <Ic icon={IconAlertTriangle} size={16} />
                <p className="text-[12px] leading-[16px]">{discountGateText}</p>
              </div>
            )}
            {editable && !isCreate && (
              <GapNote code="G-D-4">The 10 % threshold and the approver's role are unresolved client decisions (CLAUDE.md §6). The server enforces the threshold and accepts any active employee as approver; this screen only shows its answer.</GapNote>
            )}

            {editable && !isCreate && showApproval && (
              <>
                <TextInput label="Reason *" value={approvalReason} onChange={(e) => setApprovalReason(e.target.value)} error={attempted && !approvalReason.trim() ? 'Give the reason for the higher discount.' : null} />
                <LookupPicker
                  label="Approved by *"
                  placeholder="Search employee name or code"
                  value={approver}
                  onChange={(id) => setApprover(id)}
                  source={employeeSource()}
                  clearable
                  error={attempted && !approver ? 'Choose the approver.' : null}
                />
              </>
            )}
            {editable && !isCreate && !showApproval && (
              <button type="button" onClick={() => setShowApproval(true)} className="text-[12px] font-medium leading-[16px] text-brand-text underline-offset-2 hover:underline">
                Add higher-discount approval
              </button>
            )}

            {editable ? (
              <DateField label="Valid until" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
            ) : (
              <SumRow label="Valid until" value={latest?.valid_until ? formatDate(latest.valid_until) : '—'} />
            )}
            {editable && !isCreate && (
              <TextInput label="Revision reason *" value={reason} onChange={(e) => setReason(e.target.value)} helper="Every save creates a new revision." error={attempted && reasonMissing ? 'Say why this revision is needed.' : null} />
            )}

            <div className="min-h-px w-px flex-1" />
            {saveError && !approvalNeededByApi && <FormErrors error={saveError} title="The quote wasn't saved" />}

            {/* ---- actions per state (role-gated: only PURCHASE gets any) */}
            {canWork && editable && (
              <div className="flex w-full flex-col gap-[8px]">
                <div className="flex w-full items-start gap-[10px] [&>*]:min-w-px [&>*]:flex-1">
                  <Button kind="secondary" busy={saveM.isPending} onClick={save}>Save draft</Button>
                  {isCreate || reviseMode
                    ? <Button kind="primary" icon={<Ic icon={IconSend} size={18} />} disabled>Release to Sales</Button>
                    : <Button kind="primary" icon={<Ic icon={IconSend} size={18} />} disabled={dirty} onClick={() => setReleaseOpen(true)}>Release to Sales</Button>}
                </div>
                {(isCreate || reviseMode || dirty) && (
                  <p className="flex items-center gap-[6px] text-[12px] leading-[16px] text-fg-2">
                    <Ic icon={IconLock} size={14} />Save the draft first — Release sends the last saved revision.
                  </p>
                )}
                {isCreate && onCancelCreate && <Button kind="ghost" onClick={onCancelCreate}>Cancel</Button>}
                {reviseMode && <Button kind="ghost" onClick={() => { setReviseMode(false); setForm(initial); }}>Discard revision</Button>}
              </div>
            )}
            {canWork && !editable && status && LOCKABLE_FOR_REVISION.has(status) && (
              <Button kind="secondary" block icon={<Ic icon={IconFilePlus} size={18} />} onClick={() => { setForm(initial); setReviseMode(true); }}>Create revision</Button>
            )}
            {canWork && status === 'ACCEPTED' && (
              <ButtonLink to={`/p/jobs/${job.id}/authorisation`} className="w-full" icon={<Ic icon={IconShieldCheck} size={18} />}>Record customer authority</ButtonLink>
            )}
          </CardShell>
        </div>
      </div>

      {quote && (
        <ReleaseDrawer
          open={releaseOpen}
          onClose={() => { setReleaseOpen(false); releaseM.reset(); }}
          busy={releaseM.isPending}
          error={releaseM.error}
          subtitle={`${quote.quote_number} · revision ${latest?.revision_no}`}
          onSubmit={(salesId) => releaseM.mutate({ assigned_sales_id: salesId }, {
            onSuccess: () => {
              setReleaseOpen(false);
              toast({ tone: 'progress', title: 'Released to Sales', body: `${quote.quote_number} revision ${latest?.revision_no} is locked.` });
              navigate(`/p/jobs/${job.id}/quote?q=${quote.id}`, { replace: true });
            },
          })}
        />
      )}
    </>
  );
}

function MoneyRow({ label, value, onChange, invalid }: { label: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="flex w-full items-center gap-[8px] overflow-clip">
      <p className="min-w-px flex-1 text-[14px] leading-[20px] text-fg-2">{label}</p>
      <PriceInput label={label} value={value} onChange={onChange} invalid={invalid} />
    </div>
  );
}

function ReleaseDrawer({ open, onClose, onSubmit, busy, error, subtitle }: {
  open: boolean; onClose: () => void; onSubmit: (salesId: string) => void; busy: boolean; error: unknown; subtitle: string;
}) {
  const [salesId, setSalesId] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const bad = !salesId;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      busy={busy}
      title="Release to Sales"
      subtitle={subtitle}
      onSubmit={() => { setTried(true); if (salesId) onSubmit(salesId); }}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button kind="primary" type="submit" busy={busy} icon={<Ic icon={IconSend} size={18} />}>Release to Sales</Button>
        </>
      )}
    >
      <p className="text-[14px] leading-[20px] text-fg-2">Prices lock once released. Sales checks the quote and sends it to the customer; any change after that needs a new revision.</p>
      <LookupPicker
        label="Sales person *"
        placeholder="Search Sales staff by name or code"
        value={salesId}
        onChange={(id) => setSalesId(id)}
        source={employeeSource('SALES')}
        clearable
        error={tried && bad ? 'Choose the Sales person.' : null}
      />
      <FormErrors error={error} title="The quote wasn't released" />
    </Drawer>
  );
}
