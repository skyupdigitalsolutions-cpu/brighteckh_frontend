// Figma "P1 · Create JIN (drawer)" 177:108243 → kit Drawer (177:108447, 520 wide).
// Body 177:108454: Customer* (picker slot) · Received at* + Declared quantity · Channel* chips · Customer DC no. +
// DC date · Priority chips · Notes. Footer: Cancel (secondary) + "Save & add equipment" (primary).
// POST /inward-receipts (CreateInwardReceiptDto). The JIN number is allocated by the DB — never sent.
// Customer = kit LookupPicker over GET /lookups/customers (customerSource: PENDING_APPROVAL + APPROVED).
// COURIER adds Courier name / AWB (DTO fields; the frame draws them only in the JIN header). URGENT / CRITICAL add
// the optional priority_reason (DTO field). Whether either is required is the DB's call — its message is shown.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, ChoiceChips, DateField, Drawer, FieldRow, FormErrors, LookupPicker, NumberInput, TextInput,
} from '../../../../ui/desktop';
import { customerSource, useCreateReceipt, type CreateReceiptBody } from '../../api';

type Channel = CreateReceiptBody['receipt_channel'];
type Priority = NonNullable<CreateReceiptBody['priority']>;

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'WALK_IN', label: 'WALK IN' },
  { value: 'COURIER', label: 'COURIER' },
];
const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'NORMAL', label: 'NORMAL' },
  { value: 'URGENT', label: 'URGENT' },
  { value: 'CRITICAL', label: 'CRITICAL' },
];

const pad = (n: number) => String(n).padStart(2, '0');
function nowLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Form = {
  customer: string; receivedAt: string; declared: string; channel: Channel | null; dcNo: string; dcDate: string;
  priority: Priority; priorityReason: string; courierName: string; awb: string; notes: string;
};
const blank = (): Form => ({
  customer: '', receivedAt: nowLocal(), declared: '', channel: null, dcNo: '', dcDate: '',
  priority: 'NORMAL', priorityReason: '', courierName: '', awb: '', notes: '',
});

export function CreateJinDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState<Form>(blank);
  const [touched, setTouched] = useState(false);
  const create = useCreateReceipt();
  const navigate = useNavigate();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const errs = {
    customer: !f.customer ? 'Choose the customer' : null,
    receivedAt: !f.receivedAt ? 'Enter when the equipment was received' : null,
    channel: !f.channel ? 'Choose how it arrived' : null,
    declared: f.declared.trim() && !/^\d+$/.test(f.declared.trim()) ? 'Whole number' : null,
  };
  const show = (e: string | null) => (touched ? e : null);

  const close = () => { create.reset(); setF(blank()); setTouched(false); onClose(); };

  const submit = () => {
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    const b: CreateReceiptBody = {
      customer_id: f.customer,
      receipt_at: new Date(f.receivedAt).toISOString(),
      receipt_channel: f.channel!,
      priority: f.priority,
    };
    if (f.declared.trim()) b.declared_quantity = Number(f.declared.trim());
    if (f.dcNo.trim()) b.customer_dc_number = f.dcNo.trim();
    if (f.dcDate) b.dc_date = f.dcDate;
    if (f.priority !== 'NORMAL' && f.priorityReason.trim()) b.priority_reason = f.priorityReason.trim();
    if (f.channel === 'COURIER') {
      if (f.courierName.trim()) b.courier_name = f.courierName.trim();
      if (f.awb.trim()) b.courier_awb = f.awb.trim();
    }
    if (f.notes.trim()) b.notes = f.notes.trim();
    create.mutate(b, {
      onSuccess: (r) => {
        setF(blank()); setTouched(false); onClose();
        navigate(`/p/inward/${r.id}`, { state: { created: r.jin_number } });
      },
    });
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      busy={create.isPending}
      title="Create inward receipt"
      subtitle="A JIN number is assigned when you save."
      onSubmit={submit}
      footer={
        <>
          <Button kind="secondary" onClick={close} disabled={create.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={create.isPending}>Save &amp; add equipment</Button>
        </>
      }
    >
      <LookupPicker
        label="Customer *"
        autoFocus
        placeholder="Select customer"
        value={f.customer || null}
        onChange={(id) => set('customer', id ?? '')}
        source={customerSource}
        error={show(errs.customer)}
        helper="Search by name or customer code"
      />
      <FieldRow>
        <DateField label="Received at *" withTime value={f.receivedAt} onChange={(e) => set('receivedAt', e.target.value)} error={show(errs.receivedAt)} />
        <NumberInput label="Declared quantity" inputMode="numeric" value={f.declared} onChange={(e) => set('declared', e.target.value)} error={show(errs.declared)} />
      </FieldRow>
      <ChoiceChips label="Channel *" value={f.channel} options={CHANNELS} onChange={(v) => set('channel', v)} error={show(errs.channel)} />
      {f.channel === 'COURIER' && (
        <FieldRow>
          <TextInput label="Courier" value={f.courierName} onChange={(e) => set('courierName', e.target.value)} />
          <TextInput label="AWB" mono value={f.awb} onChange={(e) => set('awb', e.target.value)} />
        </FieldRow>
      )}
      <FieldRow>
        <TextInput label="Customer DC no." mono value={f.dcNo} onChange={(e) => set('dcNo', e.target.value)} />
        <DateField label="DC date" value={f.dcDate} onChange={(e) => set('dcDate', e.target.value)} />
      </FieldRow>
      <ChoiceChips label="Priority" value={f.priority} options={PRIORITIES} onChange={(v) => set('priority', v)} />
      {f.priority !== 'NORMAL' && (
        <TextInput label="Priority reason" placeholder="Why this is urgent" value={f.priorityReason} onChange={(e) => set('priorityReason', e.target.value)} />
      )}
      <TextInput label="Notes" placeholder="Optional" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      <FormErrors error={create.error} />
    </Drawer>
  );
}
