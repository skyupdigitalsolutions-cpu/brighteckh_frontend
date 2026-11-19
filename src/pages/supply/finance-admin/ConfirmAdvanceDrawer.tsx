// FA1 · Confirm advance — Figma drawer (example receipt) 247:55043 → Drawer 247:55094; BLOCKED (no receipts) 247:54884.
// 600-wide side drawer (SideDrawer, local.tsx). Title "Confirm advance", subtitle "SO-… · FIXED AMOUNT · ₹25,000.00".
// Body gap 14: label "Customer payment receipts" (Body strong); receipt table header (bg-subtle, radius 18, px-14 py-10,
// gap 10: Receipt 150 · Received flex · Amount 130 →); receipt rows px-14 py-9, radius 14, 1px bottom border, selected =
// brand-subtle; success Inline alert "Amount matches" for the chosen receipt. Footer: Cancel (secondary) + Confirm advance
// (primary, check), both flex-1.
// BLOCKED: blocked Inline alert "No customer payment receipt to match" + reason, then (bottom) Gated action: lock reason +
// disabled "Confirm advance"; no footer.
//
// Data: GET /payments?customer_id= (FINANCE) → receipts of the order's customer. Server rule (br11_guard_payment_condition):
// a receipt can back advances only up to its amount, so a receipt qualifies when available_for_advance_paise ≥ the order's
// advance_required_amount_paise (the server still decides). POST /sales-orders/:id/payment-terms/confirm-advance
// { br08_receipt_id, finance_confirmation_reference }.
// Deviations: receipts carry no receipt number (frame "RCPT-BLR-000118") → Receipt column shows payment_reference and a
// GapNote says so; "Received" = payment_mode · received_on (a date, no time). + "Finance confirmation reference" field
// (required by the API, not drawn). Non-qualifying receipts are listed but not selectable, with the available amount.
// The G11 note ("receipt list shown with example data / who records receipts is not decided") is resolved by GET /payments
// and is not shown; the BLOCKED copy states the real reason instead.
import { useState } from 'react';
import { IconCheck, IconRefresh } from '@tabler/icons-react';
import { enumLabel, formatDate, formatPaise } from '../../../lib/format';
import { Button, FormErrors, GapNote, GatedAction, Ic, InlineAlert, TextInput, cx, errorBody, useToast } from '../../../ui/desktop';
import { supplyApi, useReceipts, useSupplyMutation, type OrderRow, type ReceiptRow } from '../api';
import { advanceText } from './text';
import { FinSkeleton, ReasonStrip, SideDrawer } from './local';

const RECEIPT_PAGE = 100;
const COLS = { receipt: 150, amount: 130 };

/** Does this receipt still have enough un-backed amount for the advance? (UI hint; the server decides.) */
function qualifies(r: ReceiptRow, required: bigint | null) {
  const avail = BigInt(r.available_for_advance_paise);
  return required == null ? avail > 0n : avail >= required;
}

export function ConfirmAdvanceDrawer({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const toast = useToast();
  const so = order.sales_order_number ?? order.quote_number;
  const required = order.advance_required_amount_paise != null ? BigInt(order.advance_required_amount_paise) : null;
  const rq = useReceipts({ customer_id: order.customer_id, page: 1, page_size: RECEIPT_PAGE });
  const [picked, setPicked] = useState<string | null>(null);
  const [ref, setRef] = useState('');
  const m = useSupplyMutation((b: { receiptId: string; ref: string }) =>
    supplyApi.confirmAdvance(order.id, { br08_receipt_id: b.receiptId, finance_confirmation_reference: b.ref }));

  const receipts = rq.data?.rows ?? [];
  const anyQualifies = receipts.some((r) => qualifies(r, required));
  const chosen = receipts.find((r) => r.id === picked) ?? null;
  const blocked = rq.isSuccess && !anyQualifies;
  const subtitle = `${so} · ${advanceText(order)} · ${formatPaise(order.advance_required_amount_paise)}`;

  function submit() {
    if (!chosen || !ref.trim()) return;
    m.mutate({ receiptId: chosen.id, ref: ref.trim() }, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Advance confirmed', body: `${so} · ${formatPaise(order.advance_required_amount_paise)} against ${chosen.payment_reference ?? 'the selected receipt'}` });
        onClose();
      },
    });
  }

  const reason = !chosen ? 'Select a payment receipt first' : !ref.trim() ? 'Enter the Finance confirmation reference' : null;

  return (
    <SideDrawer
      open
      onClose={onClose}
      busy={m.isPending}
      title="Confirm advance"
      subtitle={subtitle}
      footer={rq.isSuccess && !blocked ? (
        <>
          {reason && <ReasonStrip>{reason}</ReasonStrip>}
          <div className="flex w-full items-start gap-[12px] [&>*]:min-w-px [&>*]:flex-1">
            <Button kind="secondary" onClick={onClose} disabled={m.isPending}>Cancel</Button>
            <Button busy={m.isPending} disabled={!!reason} icon={<Ic icon={IconCheck} size={18} />} onClick={submit}>Confirm advance</Button>
          </div>
        </>
      ) : undefined}
    >
      {rq.isPending ? (
        <>
          <p className="w-full text-[14px] font-medium leading-[20px] text-fg">Customer payment receipts</p>
          <FinSkeleton rows={3} />
        </>
      ) : rq.isError ? (
        <>
          <InlineAlert tone="blocked" title="Couldn't load payment receipts">{errorBody(rq.error)}</InlineAlert>
          <div className="flex w-full items-start justify-center pt-[10px]">
            <Button kind="secondary" busy={rq.isFetching} icon={<Ic icon={IconRefresh} size={18} />} onClick={() => rq.refetch()}>Try again</Button>
          </div>
        </>
      ) : blocked ? (
        <>
          <InlineAlert tone="blocked" title="No customer payment receipt to match">
            {receipts.length === 0
              ? `No payment receipts are recorded for ${order.customer_name}. Record the customer's payment first, then confirm this advance.`
              : `None of ${order.customer_name}'s receipts has ${formatPaise(order.advance_required_amount_paise)} still available — a receipt can back advances only up to its amount. Record the customer's payment first.`}
          </InlineAlert>
          {receipts.length > 0 && <ReceiptTable receipts={receipts} required={required} picked={null} onPick={() => {}} />}
          <div className="min-h-px flex-1" aria-hidden />
          <GatedAction ready={false} reason="No receipt covers this advance" readyNote="" primaryLabel="Confirm advance" onPrimary={() => {}} />
        </>
      ) : (
        <>
          <p className="w-full text-[14px] font-medium leading-[20px] text-fg">Customer payment receipts</p>
          <ReceiptTable receipts={receipts} required={required} picked={picked} onPick={(id) => { setPicked(id); m.reset(); }} />
          {(rq.data?.total ?? 0) > receipts.length && (
            <p className="text-[12px] leading-[16px] text-fg-2">Showing the latest {receipts.length} of {rq.data?.total} receipts.</p>
          )}
          {chosen && (
            BigInt(chosen.available_for_advance_paise) === required ? (
              <InlineAlert tone="success" title="Amount matches">
                {`${formatPaise(chosen.available_for_advance_paise)} received = advance ${formatPaise(order.advance_required_amount_paise)}`}
              </InlineAlert>
            ) : (
              <InlineAlert tone="success" title="Receipt covers the advance">
                {`${formatPaise(chosen.available_for_advance_paise)} available on this receipt ≥ advance ${formatPaise(order.advance_required_amount_paise)}`}
              </InlineAlert>
            )
          )}
          <TextInput
            label="Finance confirmation reference *"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="e.g. bank statement line / UTR"
            helper="The bank statement line or transfer reference you checked the payment against."
          />
          <GapNote code="G-FA1">Receipts have no receipt number in the API: they are shown by payment reference, mode and date.</GapNote>
          <FormErrors error={m.error} title="The advance wasn't confirmed" />
        </>
      )}
    </SideDrawer>
  );
}

function ReceiptTable({ receipts, required, picked, onPick }: {
  receipts: ReceiptRow[]; required: bigint | null; picked: string | null; onPick: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Customer payment receipts" className="flex w-full flex-col gap-[14px]">
      <div role="row" className="flex w-full shrink-0 items-start gap-[10px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
        {(['Receipt', 'Received', 'Amount'] as const).map((h) => (
          <div
            key={h}
            role="columnheader"
            className={cx('flex items-center overflow-clip', h === 'Received' ? 'min-w-px flex-1' : 'shrink-0', h === 'Amount' && 'justify-end')}
            style={h === 'Received' ? undefined : { width: h === 'Receipt' ? COLS.receipt : COLS.amount }}
          >
            <span className="truncate whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{h}</span>
          </div>
        ))}
      </div>
      {receipts.map((r) => {
        const ok = qualifies(r, required);
        const on = r.id === picked;
        const partlyBacked = BigInt(r.advance_backed_paise) > 0n;
        return (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={!ok}
            onClick={() => onPick(r.id)}
            className={cx(
              'flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border-b border-line px-[14px] py-[9px] text-left',
              on ? 'bg-brand-subtle' : ok ? 'hover:bg-subtle' : 'cursor-not-allowed opacity-60',
            )}
          >
            <span className="flex shrink-0 items-center overflow-clip" style={{ width: COLS.receipt }}>
              <span className="truncate whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-fg">{r.payment_reference ?? '—'}</span>
            </span>
            <span className="flex min-w-px flex-1 flex-col overflow-clip">
              <span className="truncate whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{`${enumLabel(r.payment_mode)} · ${formatDate(r.received_on)}`}</span>
              {!ok && <span className="truncate text-[12px] leading-[16px] text-st-blocked-fg">Only {formatPaise(r.available_for_advance_paise)} available — less than the advance</span>}
            </span>
            <span className="flex shrink-0 flex-col items-end overflow-clip" style={{ width: COLS.amount }}>
              <span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatPaise(r.amount_paise)}</span>
              {partlyBacked && ok && <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{formatPaise(r.available_for_advance_paise)} available</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
