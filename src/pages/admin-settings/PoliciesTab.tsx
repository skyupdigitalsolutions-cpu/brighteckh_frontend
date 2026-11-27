// AST2 · Policies — main 294:62228 · saved 294:62599 · validation error 294:62976 · empty (no exceptions) 294:63355 ·
// loading 294:63717 · error 294:64090 · Add credit exception drawer 294:64345.
// Three cards: Sales & invoicing · Returns & warranty · Credit & receivables.
//
// Data: company_config.policy (026) + sales_config.policy (BR-11). Save = PUT /admin/settings/companies/:id/policies
// with { company?: changed company fields, sales?: changed BR-11 fields }.
// Deviations / gaps:
// - "Applies to all companies": the API keeps policies per company → company switcher shown.
// - Advance policy: the API has NONE | PER_ORDER only (Figma NONE · FIXED · PERCENTAGE · FULL). PER_ORDER = Purchase
//   records the advance terms on each order.
// - "Return freight paid by BRIGHTECH" = API value COMPANY.
// - Rule-bearing items NOT in the backend stay BLOCKED with a GapNote until the product owner decides them:
//   invoices per order (ONE PER DISPATCH / COMBINED), customer without GSTIN (cash bill / tax invoice), default customer
//   credit + per-customer exceptions (+ the Add credit exception drawer, not built), receivables ageing buckets.
// - Quote follow-up and RMA turnaround live on the Calendar tab (SLA targets), as drawn.
import { useMemo, useState } from 'react';
import { Badge, FormErrors, GapNote } from '../../ui/desktop';
import { formatQty } from '../../lib/format';
import { settingsApi, useSettingsSave, type CompanySettings, type PoliciesBody } from './api';
import { ChipRow, FixAlert, InlineNumber, NumBox, Note, SCard, SChip, SavedAlert, SettingsToolbar } from './local';
import { useSettingsCtx } from './SettingsLayout';
import { TabFrame } from './TabFrame';

type Trigger = 'ADVANCE' | 'DISPATCH' | 'DELIVERY' | 'MILESTONE';
type Freight = 'CUSTOMER' | 'COMPANY';
type Advance = 'NONE' | 'PER_ORDER';

export function PoliciesTab() {
  const [justSaved, setJustSaved] = useState<string | null>(null);
  return (
    <TabFrame tab="POLICIES" titles={['Sales & invoicing', 'Returns & warranty', 'Credit & receivables']} errorTitle="Couldn't load the policies">
      {(d) => (
        <PoliciesForm
          key={`${d.company.id}|${d.last_saved.POLICIES?.at ?? ''}|${d.sales_config.policy?.updated_at ?? ''}|${d.company_config.policy?.updated_at ?? ''}`}
          data={d}
          justSaved={justSaved === d.company.id}
          onSaved={() => setJustSaved(d.company.id)}
        />
      )}
    </TabFrame>
  );
}

const num = (v: string | number | null | undefined) => (v == null ? '' : formatQty(String(v)).replace(/,/g, ''));

function initial(d: CompanySettings) {
  const c = d.company_config.policy;
  const s = d.sales_config.policy;
  return {
    max_discount_percent: num(c?.max_discount_percent),
    customer_return_window_days: num(c?.customer_return_window_days),
    supplier_return_window_min_days: num(c?.supplier_return_window_min_days),
    supplier_return_window_max_days: num(c?.supplier_return_window_max_days),
    return_freight_payer: (c?.return_freight_payer ?? null) as Freight | null,
    invoice_trigger: (s?.invoice_trigger ?? null) as Trigger | null,
    requires_full_payment_for_closure: (s?.requires_full_payment_for_closure ?? null) as boolean | null,
    advance_policy: (s?.advance_policy ?? null) as Advance | null,
  };
}
type Form = ReturnType<typeof initial>;
const COMPANY_KEYS = ['max_discount_percent', 'customer_return_window_days', 'supplier_return_window_min_days',
  'supplier_return_window_max_days', 'return_freight_payer'] as const;
const SALES_KEYS = ['invoice_trigger', 'requires_full_payment_for_closure', 'advance_policy'] as const;

const isInt = (v: string) => /^[0-9]+$/.test(v) && Number(v) >= 1;

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.max_discount_percent !== '') {
    const n = Number(f.max_discount_percent);
    if (!Number.isFinite(n) || n < 0 || n > 100 || !/^\d+(\.\d{1,2})?$/.test(f.max_discount_percent)) e.max_discount_percent = 'Max discount is a percentage from 0 to 100 (2 decimals).';
  }
  for (const k of ['customer_return_window_days', 'supplier_return_window_min_days', 'supplier_return_window_max_days'] as const) {
    if (f[k] !== '' && !isInt(f[k])) e[k] = 'Enter whole days (1 or more).';
  }
  if (!e.supplier_return_window_min_days && !e.supplier_return_window_max_days && f.supplier_return_window_min_days && f.supplier_return_window_max_days
    && Number(f.supplier_return_window_min_days) > Number(f.supplier_return_window_max_days)) {
    e.supplier_return_window_max_days = 'Supplier return window: max days must be at least the min days.';
  }
  return e;
}

function PoliciesForm({ data, justSaved, onSaved }: { data: CompanySettings; justSaved: boolean; onSaved: () => void }) {
  const { companies, setCompanyId } = useSettingsCtx();
  const start = useMemo(() => initial(data), [data]);
  const [f, setF] = useState(start);
  const [tried, setTried] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggle = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: s[k] === v ? null : v }));

  const changed = (Object.keys(f) as (keyof Form)[]).filter((k) => f[k] !== start[k]);
  const dirty = changed.length > 0;
  const errors = validate(f);
  const shown = (k: keyof Form) => ((tried || changed.includes(k)) ? errors[k] ?? null : null);
  const visible = (Object.keys(errors) as (keyof Form)[]).filter((k) => tried || changed.includes(k)).map((k) => errors[k]!);

  const m = useSettingsSave(async () => {
    const body: PoliciesBody = {};
    const company: Record<string, unknown> = {};
    for (const k of COMPANY_KEYS) {
      if (!changed.includes(k)) continue;
      const v = f[k];
      company[k] = v === '' || v == null ? null : k === 'return_freight_payer' ? v : Number(v);
    }
    const sales: Record<string, unknown> = {};
    for (const k of SALES_KEYS) if (changed.includes(k)) sales[k] = f[k];
    if (Object.keys(company).length) body.company = company as PoliciesBody['company'];
    if (Object.keys(sales).length) body.sales = sales as PoliciesBody['sales'];
    await settingsApi.policies(data.company.id, body);
  });

  function save() {
    setTried(true);
    if (Object.keys(errors).length) return;
    m.mutate(undefined, { onSuccess: onSaved });
  }

  return (
    <>
      <SettingsToolbar
        companies={companies}
        companyId={data.company.id}
        onCompany={setCompanyId}
        saved={data.last_saved.POLICIES}
        savedJustNow={justSaved}
        dirty={dirty}
        canSave={dirty && visible.length === 0}
        busy={m.isPending}
        onDiscard={() => { setF(start); setTried(false); m.reset(); }}
        onSave={save}
      />
      <FixAlert errors={visible} />
      <FormErrors error={m.error} title="Policies weren't saved" />
      {justSaved && !dirty && !m.error && (
        <SavedAlert title={`Policies saved · ${data.company.entity_code}`}>New quotes, orders and invoices follow these values from now. Existing documents are unchanged.</SavedAlert>
      )}
      <div className="flex min-h-[674px] w-full items-stretch gap-[16px]">
        <SCard title="Sales & invoicing">
          <InlineNumber
            label="Max discount before approval" sub="Higher discounts need approver + reason" unit="%"
            value={f.max_discount_percent} onChange={(v) => set('max_discount_percent', v)} error={shown('max_discount_percent')}
            placeholder={`${formatQty(data.company_config.effective_max_discount_percent)} (default)`} width={72}
          />
          <ChipRow label="Product invoice trigger" sub="MILESTONE is not supported">
            {(['ADVANCE', 'DISPATCH', 'DELIVERY'] as const).map((t) => (
              <SChip key={t} label={t} on={f.invoice_trigger === t} onClick={() => toggle('invoice_trigger', t)} />
            ))}
          </ChipRow>
          <ChipRow label={<>Invoices per order <Badge tone="blocked" label="BLOCKED" /></>}>
            <SChip label="ONE PER DISPATCH" on={false} disabled onClick={() => {}} />
            <SChip label="COMBINED" on={false} disabled onClick={() => {}} />
          </ChipRow>
          <ChipRow label="Payment required before order closes">
            <SChip label="YES" on={f.requires_full_payment_for_closure === true} onClick={() => toggle('requires_full_payment_for_closure', true)} />
            <SChip label="NO" on={f.requires_full_payment_for_closure === false} onClick={() => toggle('requires_full_payment_for_closure', false)} />
          </ChipRow>
          <ChipRow label="Advance policy (company default)" sub="PER ORDER = Purchase records the advance terms on each order">
            <SChip label="NONE" on={f.advance_policy === 'NONE'} onClick={() => toggle('advance_policy', 'NONE')} />
            <SChip label="PER ORDER" on={f.advance_policy === 'PER_ORDER'} onClick={() => toggle('advance_policy', 'PER_ORDER')} />
          </ChipRow>
          <ChipRow label={<>Customer without GSTIN <Badge tone="blocked" label="BLOCKED" /></>}>
            <SChip label="CASH BILL (NON-GST)" on={false} disabled onClick={() => {}} />
            <SChip label="TAX INVOICE" on={false} disabled onClick={() => {}} />
          </ChipRow>
          <GapNote code="DECISION">Invoices per order and the non-GST cash bill aren't in the backend yet — pending a product-owner decision.</GapNote>
        </SCard>

        <SCard title="Returns & warranty">
          <InlineNumber
            label="Customer return window" unit="days" value={f.customer_return_window_days}
            onChange={(v) => set('customer_return_window_days', v)} error={shown('customer_return_window_days')} placeholder="Not set"
          />
          <div className="flex w-full flex-col gap-[4px] border-b border-line pb-[12px]">
            <div className="flex w-full items-center gap-[12px]">
              <div className="flex min-w-px flex-1 flex-col gap-[2px]">
                <p className="text-[14px] font-medium leading-[20px] text-fg">Supplier return window</p>
                <p className="text-[12px] leading-[16px] text-fg-2">Min – max days</p>
              </div>
              <NumBox label="Supplier return window min days" value={f.supplier_return_window_min_days} onChange={(v) => set('supplier_return_window_min_days', v)} unit="d" error={!!shown('supplier_return_window_min_days')} placeholder="–" width={40} />
              <span className="text-fg-muted">–</span>
              <NumBox label="Supplier return window max days" value={f.supplier_return_window_max_days} onChange={(v) => set('supplier_return_window_max_days', v)} unit="d" error={!!shown('supplier_return_window_max_days')} placeholder="–" width={40} />
            </div>
            {(shown('supplier_return_window_min_days') || shown('supplier_return_window_max_days')) && (
              <p className="text-[12px] leading-[16px] text-st-blocked-fg">{shown('supplier_return_window_min_days') || shown('supplier_return_window_max_days')}</p>
            )}
          </div>
          <ChipRow label="Return freight paid by">
            <SChip label="CUSTOMER" on={f.return_freight_payer === 'CUSTOMER'} onClick={() => toggle('return_freight_payer', 'CUSTOMER')} />
            <SChip label="BRIGHTECH" on={f.return_freight_payer === 'COMPANY'} onClick={() => toggle('return_freight_payer', 'COMPANY')} />
          </ChipRow>
          <Note>Warranty period varies by product — set on each item in Stock › Items (warranty term). Not edited here.</Note>
          <Note>Return windows and freight are recorded for reference — no return workflow reads them yet.</Note>
        </SCard>

        <SCard title="Credit & receivables" right={<Badge tone="blocked" label="BLOCKED" />}>
          <div className="flex w-full items-center gap-[12px] border-b border-line pb-[12px]">
            <p className="min-w-px flex-1 text-[14px] font-medium leading-[20px] text-fg">Default customer credit</p>
            <span className="text-[12px] leading-[16px] text-fg-muted">Set per customer (credit days)</span>
          </div>
          <p className="w-full text-[14px] font-medium leading-[20px] text-fg">Per-customer exceptions</p>
          <p className="w-full text-[14px] font-medium leading-[20px] text-fg">Receivables ageing buckets (days)</p>
          <GapNote code="DECISION">
            Company default credit, per-customer credit exceptions (and the Add exception drawer) and receivables ageing
            buckets aren't in the backend yet — pending a product-owner decision. Today each customer's own credit days apply.
          </GapNote>
        </SCard>
      </div>
    </>
  );
}
