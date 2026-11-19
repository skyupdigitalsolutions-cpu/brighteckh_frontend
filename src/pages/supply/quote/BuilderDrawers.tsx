// PQ1 drawers (PURCHASE only).
// AddLineDrawer — 238:45746 (600 wide): "Add quote line", subtitle "SQ-… · revision n (DRAFT)". Item (catalogue) * ·
//   Manufacturer / Part number · Specification · Condition * chips · Qty * / UoM / Warranty · Unit price (₹) * / List
//   price (₹) · Alternative label; footer Cancel + Add line (plus). API: POST /sales-quote-revisions/:id/lines
//   (QuoteLineDto; money as integer paise). Deviations: UoM is read-only (the item's base_uom — QuoteLineDto has no
//   uom); the "Supplier cost (landed, last PO) · Margin at this price · Stock" box is omitted (no cost source; stock is
//   shown on the line once added, from ledger_allocatable_qty).
// NewRevisionDrawer — 238:46887 (560): "New revision", subtitle "SQ-… · from revision n"; neutral "What happens";
//   Reason * ("Required — saved in revision history"); footer Keep as is + Create revision n+1 (file-plus).
//   API: POST /sales-quotes/:id/revisions {revision_reason, validity_until, terms?}. Deviation: + Valid until * and the
//   four terms (CreateRevisionDto requires validity_until), prefilled from the current revision.
// CancelRevisionDrawer — 238:47221 (560): "Cancel revision", blocked "This can't be undone"; footer Keep as is +
//   Cancel revision (danger). API: POST /sales-quote-revisions/:id/cancel (no body). Deviation: the drawn Reason field
//   is replaced by a GapNote (the cancel call takes no reason).
import { useState } from 'react';
import { IconFilePlus, IconPlus, IconX } from '@tabler/icons-react';
import {
  Button, DateField, Drawer, FieldRow, FormErrors, GapNote, Ic, InlineAlert, LookupPicker, NumberInput, ReadOnlyField, TextInput,
} from '../../../ui/desktop';
import {
  PRODUCT_CONDITIONS, supplyApi, useSupplyMutation, type CreateRevisionBody, type QuoteLineBody, type QuoteRevision,
} from '../api';
import { Chips } from './local';
import { istYmd, itemSource, rupeesToPaise, type ItemRow } from './data';

type Condition = (typeof PRODUCT_CONDITIONS)[number];
const QTY_RE = /^\d+(\.\d{1,4})?$/;

export function AddLineDrawer({ open, onClose, revision, subtitle, onAdded }: {
  open: boolean; onClose: () => void; revision: QuoteRevision; subtitle: string; onAdded: () => void;
}) {
  const [item, setItem] = useState<ItemRow | null>(null);
  const [manufacturer, setManufacturer] = useState('');
  const [partNo, setPartNo] = useState('');
  const [spec, setSpec] = useState('');
  const [condition, setCondition] = useState<Condition | null>(null);
  const [qty, setQty] = useState('');
  const [warranty, setWarranty] = useState(revision.warranty_terms_snapshot ?? '');
  const [price, setPrice] = useState('');
  const [list, setList] = useState('');
  const [alt, setAlt] = useState('');
  const [tried, setTried] = useState(false);
  const m = useSupplyMutation((b: QuoteLineBody) => supplyApi.addQuoteLine(revision.id, b));

  const reset = () => {
    setItem(null); setManufacturer(''); setPartNo(''); setSpec(''); setCondition(null); setQty('');
    setWarranty(revision.warranty_terms_snapshot ?? ''); setPrice(''); setList(''); setAlt(''); setTried(false); m.reset();
  };
  const close = () => { reset(); onClose(); };
  const pricePaise = rupeesToPaise(price);
  const listPaise = list.trim() ? rupeesToPaise(list) : null;
  const qtyOk = QTY_RE.test(qty.trim()) && Number(qty) > 0;
  const listErr = list.trim() && (listPaise == null ? 'Enter an amount like 8,100.00' : pricePaise != null && listPaise < pricePaise ? 'List price can’t be below the unit price' : null);

  const submit = () => {
    setTried(true);
    if (!item || !condition || !qtyOk || pricePaise == null || listErr) return;
    m.mutate({
      item_id: item.id,
      product_condition: condition,
      qty: Number(qty.trim()),
      unit_price_paise: pricePaise,
      ...(listPaise != null ? { list_unit_price_paise: listPaise } : {}),
      ...(manufacturer.trim() ? { manufacturer: manufacturer.trim() } : {}),
      ...(partNo.trim() ? { part_number: partNo.trim() } : {}),
      ...(spec.trim() ? { specification: spec.trim() } : {}),
      ...(warranty.trim() ? { warranty: warranty.trim() } : {}),
      ...(alt.trim() ? { alternative_label: alt.trim() } : {}),
    }, { onSuccess: () => { reset(); onAdded(); } });
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={600}
      bodyGap={16}
      title="Add quote line"
      subtitle={subtitle}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} icon={<Ic icon={IconPlus} size={18} />}>Add line</Button>
        </>
      )}
    >
      <LookupPicker
        label="Item (catalogue) *"
        helper="Catalogue items only — assemblies are not sellable"
        placeholder="Search item code or name"
        value={item?.id ?? null}
        onChange={(_id, row) => setItem(row ?? null)}
        source={itemSource}
        error={tried && !item ? 'Choose the item.' : null}
      />
      <FieldRow gap={12}>
        <TextInput label="Manufacturer" value={manufacturer} maxLength={140} onChange={(e) => setManufacturer(e.target.value)} />
        <TextInput label="Part number" value={partNo} maxLength={140} onChange={(e) => setPartNo(e.target.value)} />
      </FieldRow>
      <TextInput label="Specification" value={spec} onChange={(e) => setSpec(e.target.value)} />
      <Chips label="Condition *" options={PRODUCT_CONDITIONS} value={condition} onChange={setCondition} error={tried && !condition ? 'Choose the condition.' : null} />
      <FieldRow gap={12}>
        <NumberInput label="Qty *" value={qty} onChange={(e) => setQty(e.target.value)} error={tried && !qtyOk ? 'Above 0' : null} />
        <ReadOnlyField label="UoM" value={item?.base_uom ?? '—'} helper="From the Item Master" />
        <TextInput label="Warranty" value={warranty} onChange={(e) => setWarranty(e.target.value)} />
      </FieldRow>
      <FieldRow gap={12}>
        <TextInput
          label="Unit price (₹) *"
          mono="number"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={tried && pricePaise == null ? 'Enter an amount like 7,400.00' : null}
        />
        <TextInput label="List price (₹)" mono="number" inputMode="decimal" value={list} onChange={(e) => setList(e.target.value)} error={tried && listErr ? listErr : null} />
      </FieldRow>
      <TextInput label="Alternative label" value={alt} maxLength={80} onChange={(e) => setAlt(e.target.value)} placeholder="Optional" />
      <FormErrors error={m.error} title="The line wasn't added" />
    </Drawer>
  );
}

export function NewRevisionDrawer({ open, onClose, quoteId, from, quoteNumber, onCreated }: {
  open: boolean; onClose: () => void; quoteId: string; from: QuoteRevision; quoteNumber: string; onCreated: (n: number) => void;
}) {
  const init = () => ({
    reason: '', validity: istYmd(from.validity_until), payment: from.payment_terms_snapshot ?? '', delivery: from.delivery_terms_snapshot ?? '',
    warranty: from.warranty_terms_snapshot ?? '', tax: from.tax_terms_snapshot ?? '',
  });
  const [f, setF] = useState(init);
  const [tried, setTried] = useState(false);
  const m = useSupplyMutation((b: CreateRevisionBody) => supplyApi.createRevision(quoteId, b));
  const next = from.revision_no + 1;
  const set = (k: keyof ReturnType<typeof init>) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const close = () => { setF(init()); setTried(false); m.reset(); onClose(); };
  const submit = () => {
    setTried(true);
    if (!f.reason.trim() || !f.validity) return;
    m.mutate({
      revision_reason: f.reason.trim(),
      validity_until: f.validity,
      currency_code: 'INR',
      ...(f.payment.trim() ? { payment_terms: f.payment.trim() } : {}),
      ...(f.delivery.trim() ? { delivery_terms: f.delivery.trim() } : {}),
      ...(f.warranty.trim() ? { warranty_terms: f.warranty.trim() } : {}),
      ...(f.tax.trim() ? { tax_terms: f.tax.trim() } : {}),
    }, {
      onSuccess: (qd) => {
        const n = Math.max(...qd.revisions.map((r) => r.revision_no));
        setF(init()); setTried(false); m.reset(); onCreated(n);
      },
    });
  };
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={560}
      bodyGap={16}
      title="New revision"
      subtitle={`${quoteNumber} · from revision ${from.revision_no}`}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Keep as is</Button>
          <Button kind="primary" type="submit" busy={m.isPending} icon={<Ic icon={IconFilePlus} size={18} />}>Create revision {next}</Button>
        </>
      )}
    >
      <InlineAlert tone="neutral" title="What happens">
        Creates revision {next} as a DRAFT with the terms below. Revision {from.revision_no} stays {from.revision_status} until revision {next} is issued.
      </InlineAlert>
      <TextInput
        label="Reason *"
        value={f.reason}
        autoFocus
        onChange={set('reason')}
        helper="Required — saved in revision history"
        error={tried && !f.reason.trim() ? 'Enter why the quote is revised.' : null}
      />
      <DateField label="Valid until *" value={f.validity} onChange={set('validity')} error={tried && !f.validity ? 'Required' : null} />
      <FieldRow gap={12}>
        <TextInput label="Payment terms" value={f.payment} onChange={set('payment')} />
        <TextInput label="Delivery terms" value={f.delivery} onChange={set('delivery')} />
      </FieldRow>
      <FieldRow gap={12}>
        <TextInput label="Warranty" value={f.warranty} onChange={set('warranty')} />
        <TextInput label="Tax terms" value={f.tax} onChange={set('tax')} />
      </FieldRow>
      <FormErrors error={m.error} title="The revision wasn't created" />
    </Drawer>
  );
}

export function CancelRevisionDrawer({ open, onClose, revision, quoteNumber, onCancelled }: {
  open: boolean; onClose: () => void; revision: QuoteRevision; quoteNumber: string; onCancelled: () => void;
}) {
  const m = useSupplyMutation((id: string) => supplyApi.cancelRevision(id));
  const draft = revision.revision_status === 'DRAFT';
  const close = () => { m.reset(); onClose(); };
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={560}
      bodyGap={16}
      title={draft ? 'Cancel quote' : 'Cancel revision'}
      subtitle={`${quoteNumber} · revision ${revision.revision_no} (${revision.revision_status})`}
      onSubmit={() => m.mutate(revision.id, { onSuccess: () => { m.reset(); onCancelled(); } })}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Keep as is</Button>
          <Button kind="danger" type="submit" busy={m.isPending} icon={<Ic icon={IconX} size={18} />}>{draft ? 'Cancel quote' : 'Cancel revision'}</Button>
        </>
      )}
    >
      <InlineAlert tone="blocked" title="This can't be undone">
        {draft
          ? `Revision ${revision.revision_no} is cancelled and the quote shows as CANCELLED until a new revision is issued.`
          : 'Sales can no longer send or record responses on this revision.'}
      </InlineAlert>
      <GapNote code="GAP">The cancel call takes no reason, so none is saved in the revision history.</GapNote>
      <FormErrors error={m.error} title="The revision wasn't cancelled" />
    </Drawer>
  );
}
