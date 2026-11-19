// SE0 · Create enquiry drawer — Figma 237:42677 → Drawer 237:42773 (620 wide, p-28, gap 16; body gap 14).
// Title "New enquiry", subtitle "Number SE-BLR-###### is assigned when you save". Customer * (helper "Approved
// customers only") · Channel * chips (ENQUIRY_CHANNELS) · Enquiry details * · source evidence (dashed box) · Lines
// (15/20 SemiBold) table "Item (catalogue)" flex · Qty 80 → · Condition 150 · "Add line" ghost + muted hint.
// Footer: Cancel (secondary) + Save enquiry (primary, check icon).
// API: POST /sales-enquiries { customer_id, enquiry_channel, enquiry_details, source_evidence_uri?, lines[] }, line =
// { product_description, item_id?, requested_qty, uom, desired_condition? }. Evidence = POST /uploads file_uri.
// Deviations: kit Drawer/field boxes (h-44, kit header/footer padding) as every other drawer in the app; the line
// editor (not drawn) is an inline form under the table: catalogue item (optional, Item Master APPROVED/ACTIVE) or
// free description, qty, UoM, condition; each line has a remove (x) control.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCheck, IconPlus, IconX } from '@tabler/icons-react';
import { formatQty } from '../../../lib/format';
import { Button, Drawer, FieldRow, FormErrors, Ic, LookupPicker, TextInput, NumberInput } from '../../../ui/desktop';
import {
  ENQUIRY_CHANNELS, PRODUCT_CONDITIONS, supplyApi, useSupplyMutation, type CreateEnquiryBody, type EnquiryChannel,
} from '../api';
import { Chips, ConditionBadge, EvidenceInput, MiniHead, MiniRow, SectionLabel, type Col } from './local';
import { approvedCustomerSource, cellText, itemSource, useEvidence } from './data';

type Condition = (typeof PRODUCT_CONDITIONS)[number];
type DraftLine = { key: number; item_id?: string; label: string; description: string; qty: string; uom: string; condition: Condition | null };
const COLS: Col[] = [{ grow: true }, { w: 80, right: true }, { w: 150 }, { w: 20 }];

export function CreateEnquiryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [customer, setCustomer] = useState<string | null>(null);
  const [channel, setChannel] = useState<EnquiryChannel | null>(null);
  const [details, setDetails] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [adding, setAdding] = useState(false);
  const [tried, setTried] = useState(false);
  const evidence = useEvidence();
  const m = useSupplyMutation((b: CreateEnquiryBody) => supplyApi.createEnquiry(b));

  function reset() {
    setCustomer(null); setChannel(null); setDetails(''); setLines([]); setAdding(false); setTried(false); evidence.clear(); m.reset();
  }
  function close() { reset(); onClose(); }

  function submit() {
    setTried(true);
    if (!customer || !channel || !details.trim() || lines.length === 0 || evidence.busy || evidence.failed) return;
    m.mutate({
      customer_id: customer,
      enquiry_channel: channel,
      enquiry_details: details.trim(),
      ...(evidence.uri ? { source_evidence_uri: evidence.uri } : {}),
      lines: lines.map((l) => ({
        product_description: l.description,
        ...(l.item_id ? { item_id: l.item_id } : {}),
        requested_qty: Number(l.qty),
        uom: l.uom,
        ...(l.condition ? { desired_condition: l.condition } : {}),
      })),
    }, { onSuccess: (e) => { reset(); onClose(); nav(`/s/enquiries/${e.id}`); } });
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      width={620}
      bodyGap={16}
      title="New enquiry"
      subtitle="Number SE-BLR-###### is assigned when you save"
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} disabled={evidence.busy} icon={<Ic icon={IconCheck} size={18} />}>Save enquiry</Button>
        </>
      )}
    >
      <LookupPicker
        label="Customer *"
        helper="Approved customers only"
        placeholder="Search customer name or code"
        value={customer}
        onChange={(id) => setCustomer(id)}
        source={approvedCustomerSource}
        error={tried && !customer ? 'Choose the customer.' : null}
      />
      <Chips label="Channel *" options={ENQUIRY_CHANNELS} value={channel} onChange={setChannel} error={tried && !channel ? 'Choose how the enquiry came in.' : null} />
      <TextInput
        label="Enquiry details *"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="What the customer asked for"
        error={tried && !details.trim() ? 'Required' : null}
      />
      <EvidenceInput evidence={evidence} prompt="Attach the customer email / screenshot (optional)" />

      <SectionLabel>Lines</SectionLabel>
      <div className="flex w-full flex-col">
        <MiniHead cols={COLS} labels={['Item (catalogue)', 'Qty', 'Condition', '']} />
        {lines.map((l) => (
          <MiniRow
            key={l.key}
            cols={COLS}
            cells={[
              <span className={cellText.strong}>{l.label}</span>,
              <span className={cellText.num}>{formatQty(l.qty, l.uom)}</span>,
              l.condition ? <ConditionBadge value={l.condition} /> : <span className="text-[14px] text-fg-muted">—</span>,
              <button type="button" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="flex h-[20px] w-[20px] items-center justify-center text-fg-2 hover:text-fg">
                <Ic icon={IconX} size={16} />
              </button>,
            ]}
          />
        ))}
      </div>
      {adding ? (
        <LineForm onAdd={(l) => { setLines((ls) => [...ls, { ...l, key: Date.now() }]); setAdding(false); }} onCancel={() => setAdding(false)} />
      ) : (
        <div className="flex w-full items-start">
          <Button kind="ghost" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setAdding(true)}>Add line</Button>
        </div>
      )}
      {tried && lines.length === 0 && <p className="text-[12px] leading-[16px] text-st-blocked-fg">Add at least one line.</p>}
      <p className="text-[12px] leading-[16px] text-fg-muted">Catalogue items only — assemblies can't be sold here. Use free description when the item isn't in the catalogue.</p>
      {tried && evidence.failed && <p className="text-[12px] leading-[16px] text-st-blocked-fg">Retry or remove the evidence before saving.</p>}
      <FormErrors error={m.error} title="The enquiry wasn't saved" />
    </Drawer>
  );
}

function LineForm({ onAdd, onCancel }: { onAdd: (l: Omit<DraftLine, 'key'>) => void; onCancel: () => void }) {
  const [itemId, setItemId] = useState<string | null>(null);
  const [code, setCode] = useState<string | undefined>();
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('');
  const [uom, setUom] = useState('NOS');
  const [condition, setCondition] = useState<Condition | null>(null);
  const [tried, setTried] = useState(false);
  const qtyOk = /^\d+(\.\d{1,4})?$/.test(qty.trim()) && Number(qty) > 0;

  function add() {
    setTried(true);
    if (!description.trim() || !qtyOk || !uom.trim()) return;
    onAdd({
      item_id: itemId ?? undefined,
      label: code ? `${code} · ${description.trim()}` : description.trim(),
      description: description.trim(),
      qty: qty.trim(),
      uom: uom.trim().toUpperCase(),
      condition,
    });
  }

  return (
    <div className="flex w-full flex-col gap-[14px] rounded-[16px] bg-subtle p-[16px]">
      <LookupPicker
        label="Catalogue item"
        helper="Optional · Item Master items only"
        placeholder="Search item code or name"
        value={itemId}
        clearable
        onChange={(id, row) => {
          setItemId(id);
          setCode(row?.item_code);
          if (row) { setDescription(row.standard_name); setUom(row.base_uom); }
        }}
        source={itemSource}
      />
      <TextInput label="Description *" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} error={tried && !description.trim() ? 'Required' : null} />
      <FieldRow gap={12}>
        <NumberInput label="Qty *" value={qty} onChange={(e) => setQty(e.target.value)} error={tried && !qtyOk ? 'Enter a quantity above 0' : null} />
        <TextInput label="UoM *" value={uom} maxLength={16} onChange={(e) => setUom(e.target.value)} error={tried && !uom.trim() ? 'Required' : null} />
      </FieldRow>
      <Chips label="Condition" options={PRODUCT_CONDITIONS} value={condition} onChange={setCondition} />
      <div className="flex w-full justify-end gap-[8px]">
        <Button kind="ghost" onClick={onCancel}>Cancel</Button>
        <Button kind="secondary" icon={<Ic icon={IconPlus} size={18} />} onClick={add}>Add line</Button>
      </div>
    </div>
  );
}
