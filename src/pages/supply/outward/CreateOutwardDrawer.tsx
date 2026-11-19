// POUT0 · create-outward drawer 246:50686 (kit Drawer 520). POST /sales-outwards → DRAFT outward.
// "Customer / order *" = the order picker (GET /sales-supply/orders, VERIFIED / PART_DELIVERED); the customer comes
// from the order (one customer per outward). "CONFIRMED reservations" = GET /sales-orders/:id reservations in state
// CONFIRMED; each selected row becomes one outward line that ships that WHOLE reservation (OutwardLineDto). A
// reservation already on another DRAFT outward is refused by the server (shown via FormErrors).
// Dispatch mode chips (exact enum) · Recipient * + Carrier (required for COURIER) · Destination address * · Tracking ref.
// OTHER needs dispatch_mode_note (CreateOutwardDto, 11C-03) — not drawn; added as a field when OTHER is picked.
// API over Figma: destination / recipient are typed (the customer lookup has no address fields).
import { useMemo, useState } from 'react';
import { IconCheck, IconTruckDelivery } from '@tabler/icons-react';
import { formatQty } from '../../../lib/format';
import {
  Button, Drawer, EmptyState, FieldRow, FormErrors, Ic, InlineAlert, SelectField, StatusPill, TextInput, cx, errorBody,
} from '../../../ui/desktop';
import {
  DISPATCH_MODES, supplyApi, useOrder, useOrders, useSupplyMutation, type CreateOutwardBody, type DispatchMode,
} from '../api';
import { lineInfoMap } from './data';
import { OptionChips } from './ui';

export function CreateOutwardDrawer({ open, initialOrderId, onClose, onCreated }: {
  open: boolean; initialOrderId?: string; onClose: () => void; onCreated: (id: string) => void;
}) {
  if (!open) return null;
  return <Inner key={initialOrderId ?? 'new'} initialOrderId={initialOrderId} onClose={onClose} onCreated={onCreated} />;
}

function Inner({ initialOrderId, onClose, onCreated }: { initialOrderId?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const orders = useOrders({ status: ['VERIFIED', 'PART_DELIVERED'], page_size: 100 });
  const [orderId, setOrderId] = useState(initialOrderId ?? '');
  const order = useOrder(orderId);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<DispatchMode | null>(null);
  const [modeNote, setModeNote] = useState('');
  const [recipient, setRecipient] = useState('');
  const [carrier, setCarrier] = useState('');
  const [address, setAddress] = useState('');
  const [tracking, setTracking] = useState('');
  const [tried, setTried] = useState(false);
  const create = useSupplyMutation((b: CreateOutwardBody) => supplyApi.createOutward(b));

  const confirmed = useMemo(() => (order.data?.reservations ?? []).filter((r) => r.state === 'CONFIRMED'), [order.data]);
  const info = useMemo(() => (order.data ? lineInfoMap([order.data]) : {}), [order.data]);
  const uomOf = (lineId: string) => order.data?.lines.find((l) => l.sales_order_line_id === lineId)?.uom ?? null;

  // Pre-select every CONFIRMED reservation once per chosen order (the usual case: ship what is reserved).
  const [seeded, setSeeded] = useState<string | null>(null);
  if (order.data && seeded !== order.data.id) {
    setSeeded(order.data.id);
    setPicked(new Set(confirmed.map((r) => r.id)));
  }

  const row = orders.data?.rows.find((r) => r.id === orderId);
  const errs = {
    order: !orderId ? 'Pick an order' : null,
    lines: orderId && picked.size === 0 ? 'Pick at least one CONFIRMED reservation' : null,
    mode: !mode ? 'Pick a dispatch mode' : null,
    modeNote: mode === 'OTHER' && !modeNote.trim() ? 'Required for OTHER' : null,
    recipient: !recipient.trim() ? 'Required' : null,
    carrier: mode === 'COURIER' && !carrier.trim() ? 'Required for COURIER' : null,
    address: !address.trim() ? 'Required' : null,
  };
  const valid = Object.values(errs).every((e) => !e);
  const show = (e: string | null) => (tried ? e : null);

  const submit = () => {
    setTried(true);
    if (!valid || !order.data || !mode) return;
    create.mutate({
      customer_id: order.data.customer_id,
      dispatch_mode: mode,
      dispatch_mode_note: mode === 'OTHER' ? modeNote.trim() : undefined,
      recipient_name: recipient.trim(),
      destination_address: address.trim(),
      carrier_name: carrier.trim() || undefined,
      tracking_reference: tracking.trim() || undefined,
      lines: [...picked].map((id) => ({ reservation_request_id: id })),
    }, { onSuccess: (o) => onCreated(o.id) });
  };

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Drawer
      open
      onClose={onClose}
      busy={create.isPending}
      title="New outward"
      subtitle="One customer · each line ships one whole CONFIRMED reservation"
      bodyGap={16}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button type="submit" busy={create.isPending} icon={<Ic icon={IconTruckDelivery} size={18} />}>Create draft outward</Button>
        </>
      )}
    >
      <SelectField
        label="Customer / order *"
        value={orderId}
        placeholder={orders.isPending ? 'Loading orders…' : 'Pick a verified order'}
        onChange={(e) => setOrderId(e.target.value)}
        error={show(errs.order) ?? (orders.isError ? errorBody(orders.error) : null)}
      >
        {orderId && !row && order.data && <option value={orderId}>{order.data.sales_order_number ?? 'Order'}</option>}
        {orders.data?.rows.map((r) => (
          <option key={r.id} value={r.id}>{r.customer_name} · {r.sales_order_number ?? 'unnumbered'}</option>
        ))}
      </SelectField>

      {orderId && (
        <div className="flex w-full flex-col gap-[8px]">
          <p className="text-[14px] font-medium leading-[20px] text-fg">CONFIRMED reservations</p>
          <div role="row" className="flex w-full items-start gap-[10px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
            <span className="w-[24px] shrink-0" />
            <span className="min-w-px flex-1 text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">Item</span>
            <span className="w-[70px] shrink-0 text-right text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">Reserved</span>
            <span className="w-[100px] shrink-0 text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">Reservation</span>
          </div>
          {order.isPending ? <p className="px-[14px] text-[14px] leading-[20px] text-fg-2">Loading reservations…</p>
            : order.isError ? <InlineAlert tone="blocked" title="Couldn't load the order">{errorBody(order.error)}</InlineAlert>
              : confirmed.length === 0 ? (
                <EmptyState icon={IconTruckDelivery} title="Nothing to ship yet" body="This order has no CONFIRMED reservation. Reserve stock on the order first." className="w-full py-[16px]" />
              ) : confirmed.map((r) => {
                const on = picked.has(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(r.id)}
                    className={cx(
                      'flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border px-[14px] py-[9px] text-left',
                      on ? 'border-brand-border bg-brand-subtle' : 'border-line hover:bg-surface',
                    )}
                  >
                    <span className="flex w-[24px] shrink-0 justify-center">{on && <Ic icon={IconCheck} size={16} className="text-fg" />}</span>
                    <span className="min-w-px flex-1 truncate text-[14px] font-medium leading-[20px] text-fg">{info[r.sales_order_line_id]?.description ?? 'Order line'}</span>
                    <span className="w-[70px] shrink-0 text-right font-mono text-[14px] leading-[20px] text-fg">{formatQty(r.requested_qty, uomOf(r.sales_order_line_id))}</span>
                    <span className="w-[100px] shrink-0"><StatusPill domain="supplyReservation" value={r.state} /></span>
                  </button>
                );
              })}
          {show(errs.lines) && <p className="text-[12px] leading-[16px] text-st-blocked-fg">{errs.lines}</p>}
        </div>
      )}

      <OptionChips label="Dispatch mode *" value={mode} options={DISPATCH_MODES} onChange={setMode} />
      {show(errs.mode) && <p className="-mt-[10px] text-[12px] leading-[16px] text-st-blocked-fg">{errs.mode}</p>}
      {mode === 'OTHER' && (
        <TextInput label="Mode details *" value={modeNote} onChange={(e) => setModeNote(e.target.value)} error={show(errs.modeNote)} placeholder="How it leaves the store" />
      )}
      <FieldRow>
        <TextInput label="Recipient *" value={recipient} onChange={(e) => setRecipient(e.target.value)} error={show(errs.recipient)} />
        <TextInput label={mode === 'COURIER' ? 'Carrier *' : 'Carrier'} value={carrier} onChange={(e) => setCarrier(e.target.value)} error={show(errs.carrier)} />
      </FieldRow>
      <TextInput label="Destination address *" value={address} onChange={(e) => setAddress(e.target.value)} error={show(errs.address)} />
      <TextInput label="Tracking reference" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Add after booking" />
      <FormErrors error={create.error} title="The outward wasn't created" />
    </Drawer>
  );
}
