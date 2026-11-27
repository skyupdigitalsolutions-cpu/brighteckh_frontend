// AST0 · Company & tax — BLR 293:59593 · CHN 293:59949 · saved 293:60305 · validation error 293:60667 ·
// CHN bank not configured 293:61031 · loading 293:61395 · error 293:61772.
// Three cards (gap 16): Legal & GST · Invoicing & tax · Bank (printed on invoices).
//
// Data: AdminCompanySettings.profile (BR-08 entity profile + legal_name + udyam_number, 027) and the GLOBAL GST rows.
// Save = PUT /admin/settings/companies/:id/profile (changed fields only) + PUT /admin/settings/gst-rates for a changed
// product rate (PRODUCT_SALE row) or service SAC (default row).
// Deviations (API over Figma):
// - Invoice prefix is the BR-08 doc_prefix: 1–12 capitals/digits, no hyphen (Figma's "INV-BLR" is not a valid prefix).
//   Real invoice number = <PREFIX>/<n>/<YY-YY>. Prefix, state and GSTIN freeze once BR-08 documents exist (server rule).
// - Financial year and the delivery-challan format are fixed by the system (br08_next_doc_number): shown locked with the
//   real format, not editable.
// - Product GST rate and service SAC are GLOBAL (one row for every company) — helper says so.
// - "Invoice copies printed" has no API: GapNote instead of the chips.
// - State is the 2-digit GST state code (no state list endpoint); the name shows beside it.
// - Account number: the API returns the full number; it is shown masked and only replaced when the admin types a new one.
import { useMemo, useState } from 'react';
import { formatQty } from '../../lib/format';
import { FormErrors, GapNote, InlineAlert } from '../../ui/desktop';
import { fiscalYearOf, settingsApi, useSettingsSave, type CompanySettings, type ProfileBody } from './api';
import { FixAlert, Note, Pair, SCard, SField, SavedAlert, SettingsToolbar } from './local';
import { useSettingsCtx } from './SettingsLayout';
import { TabFrame } from './TabFrame';

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UDYAM = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
const PREFIX = /^[A-Z0-9]{1,12}$/;

export function CompanyTaxTab() {
  const [justSaved, setJustSaved] = useState<string | null>(null);
  return (
    <TabFrame tab="COMPANY_TAX" titles={['Legal & GST', 'Invoicing & tax', 'Bank & copies']} errorTitle="Couldn't load company & tax settings">
      {(d) => (
        <CompanyTaxForm
          key={`${d.company.id}|${d.last_saved.COMPANY_TAX?.at ?? ''}|${gstKey(d)}`}
          data={d}
          justSaved={justSaved === d.company.id}
          onSaved={() => setJustSaved(d.company.id)}
        />
      )}
    </TabFrame>
  );
}

const gstKey = (d: CompanySettings) => d.gst_rates.map((r) => r.id).join(',');

function initial(d: CompanySettings) {
  const p = d.profile;
  const product = d.gst_rates.find((r) => r.quote_line_type === 'PRODUCT_SALE');
  const service = d.gst_rates.find((r) => r.quote_line_type == null);
  return {
    legal_name: p.legal_name ?? '', gstin: p.gstin ?? '', state_code: p.state_code ?? '', registered_address: p.registered_address ?? '',
    udyam_number: p.udyam_number ?? '', doc_prefix: p.doc_prefix ?? '',
    product_rate: product ? formatQty(product.igst_rate) : '', service_sac: service?.hsn_sac ?? '',
    bank_name: p.bank_name ?? '', bank_branch: p.bank_branch ?? '', bank_account_no: '', bank_ifsc: p.bank_ifsc ?? '',
  };
}
type Form = ReturnType<typeof initial>;

function validate(f: Form, hasAccount: boolean): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.legal_name.trim()) e.legal_name = 'Legal name is required.';
  if (!GSTIN.test(f.gstin)) e.gstin = 'GSTIN must be 15 characters (state code + PAN + entity + Z + check)';
  else if (f.state_code && f.gstin.slice(0, 2) !== f.state_code) e.gstin = 'GSTIN must start with the state code.';
  if (!/^[0-9]{2}$/.test(f.state_code)) e.state_code = 'State is the 2-digit GST state code (e.g. 29).';
  if (!f.registered_address.trim()) e.registered_address = 'Registered address is required.';
  if (f.udyam_number && !UDYAM.test(f.udyam_number)) e.udyam_number = 'Udyam number looks like UDYAM-KR-03-0012345.';
  if (!PREFIX.test(f.doc_prefix)) e.doc_prefix = 'Prefix is 1–12 capital letters or digits (no spaces or hyphens).';
  const rate = Number(f.product_rate);
  if (f.product_rate === '' || !Number.isFinite(rate) || rate < 0 || rate > 100) e.product_rate = 'Enter the GST rate as a percentage.';
  else if (Math.round(rate * 100) % 2 !== 0) e.product_rate = 'Rate must split evenly into CGST + SGST.';
  if (!/^[0-9]{4,8}$/.test(f.service_sac)) e.service_sac = 'SAC is 4–8 digits.';
  const anyBank = f.bank_name || f.bank_branch || f.bank_ifsc || f.bank_account_no || hasAccount;
  if (anyBank) {
    if (!f.bank_name.trim()) e.bank_name = 'Bank name is required.';
    if (!f.bank_branch.trim()) e.bank_branch = 'Branch is required.';
    if (!hasAccount && !f.bank_account_no.trim()) e.bank_account_no = 'Account number is required.';
    if (!IFSC.test(f.bank_ifsc)) e.bank_ifsc = 'IFSC is 11 characters: 4 letters, 0, then 6 letters or digits.';
  }
  return e;
}

const mask = (n: string | null | undefined) => (n ? `XXXX XXXX ${n.slice(-4)}` : '');

function CompanyTaxForm({ data, justSaved, onSaved }: { data: CompanySettings; justSaved: boolean; onSaved: () => void }) {
  const { companies, setCompanyId } = useSettingsCtx();
  const start = useMemo(() => initial(data), [data]);
  const [f, setF] = useState(start);
  const [tried, setTried] = useState(false);
  const p = data.profile;
  const code = data.company.entity_code;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const up = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value.toUpperCase() }));

  const changed = (Object.keys(f) as (keyof Form)[]).filter((k) => f[k] !== start[k]);
  const dirty = changed.length > 0;
  const errors = validate(f, !!p.bank_account_no);
  const shown = (k: keyof Form) => ((tried || changed.includes(k)) ? errors[k] ?? null : null);
  const visibleErrors = (Object.keys(errors) as (keyof Form)[]).filter((k) => tried || changed.includes(k)).map((k) => errors[k]!);
  const bankMissing = !p.bank_name && !p.bank_account_no && !p.bank_ifsc;

  const m = useSettingsSave(async () => {
    const profileKeys = ['legal_name', 'gstin', 'state_code', 'registered_address', 'udyam_number', 'doc_prefix',
      'bank_name', 'bank_branch', 'bank_account_no', 'bank_ifsc'] as const;
    const body: Record<string, string | null> = {};
    for (const k of profileKeys) {
      if (!changed.includes(k)) continue;
      const v = f[k].trim();
      body[k] = k === 'udyam_number' && !v ? null : v;
    }
    if (Object.keys(body).length) await settingsApi.profile(data.company.id, body as ProfileBody);
    if (changed.includes('product_rate')) await settingsApi.gstRate({ quote_line_type: 'PRODUCT_SALE', igst_rate: Number(f.product_rate) });
    if (changed.includes('service_sac')) {
      const svc = data.gst_rates.find((r) => r.quote_line_type == null);
      await settingsApi.gstRate({ quote_line_type: null, hsn_sac: f.service_sac, igst_rate: Number(svc?.igst_rate ?? 18) });
    }
  });

  function save() {
    setTried(true);
    if (Object.keys(errors).length) return;
    m.mutate(undefined, { onSuccess: onSaved });
  }

  const fy = fiscalYearOf(new Date());
  const prefixShown = f.doc_prefix || '<PREFIX>';
  return (
    <>
      <SettingsToolbar
        companies={companies}
        companyId={data.company.id}
        onCompany={setCompanyId}
        saved={data.last_saved.COMPANY_TAX}
        savedJustNow={justSaved}
        dirty={dirty}
        canSave={dirty && visibleErrors.length === 0}
        busy={m.isPending}
        onDiscard={() => { setF(start); setTried(false); m.reset(); }}
        onSave={save}
      />
      <FixAlert errors={visibleErrors} />
      <FormErrors error={m.error} title="Company & tax wasn't saved" />
      {justSaved && !dirty && !m.error && (
        <SavedAlert title={`Company & tax saved · ${code}`}>Changes apply to new invoices and challans from now. Issued documents are unchanged.</SavedAlert>
      )}
      <div className="flex min-h-[674px] w-full items-stretch gap-[16px]">
        <SCard title="Legal & GST">
          <SField label="Legal name *" value={f.legal_name} onChange={set('legal_name')} error={shown('legal_name')} maxLength={200} />
          <SField
            label="GSTIN *" value={f.gstin} onChange={up('gstin')} error={shown('gstin')} maxLength={15}
            helper="15 characters · state code must match the state"
          />
          <SField
            label="State *" value={f.state_code} onChange={set('state_code')} error={shown('state_code')} maxLength={2} inputMode="numeric"
            trailing={f.state_code === p.state_code ? p.state_name ?? undefined : undefined}
          />
          <SField label="Registered address *" value={f.registered_address} onChange={set('registered_address')} error={shown('registered_address')} />
          <SField label="Udyam number" value={f.udyam_number} onChange={up('udyam_number')} error={shown('udyam_number')} maxLength={19} placeholder="Not set" />
          <Note>Invoice prefix, state and GSTIN can't change once this company has issued BR-08 documents.</Note>
        </SCard>

        <SCard title="Invoicing & tax">
          <Pair>
            <SField label="Invoice number prefix *" value={f.doc_prefix} onChange={up('doc_prefix')} error={shown('doc_prefix')} maxLength={12} />
            <SField label="Financial year *" value={fy} locked />
          </Pair>
          <SField
            label="Delivery-challan (job work) format *" value={`{seq}/${prefixShown}/NA/${fy}`} locked
            helper={`{seq} = running number, resets each FY · invoices: ${prefixShown}/{seq}/${fy.slice(2, 4)}-${fy.slice(5, 7)}`}
          />
          <Pair>
            <SField label="Product GST rate *" value={f.product_rate} onChange={set('product_rate')} error={shown('product_rate')} inputMode="decimal" trailing="%" />
            <SField label="Service SAC *" value={f.service_sac} onChange={set('service_sac')} error={shown('service_sac')} maxLength={8} inputMode="numeric" />
          </Pair>
          <Note>GST rate and SAC apply to every company. Product / goods HSN varies per item — set on each item in Stock › Items, not here.</Note>
          <div className="flex w-full flex-col gap-[6px]">
            <p className="text-[14px] font-medium leading-[20px] text-fg">Invoice copies printed</p>
            <GapNote code="NO API">Invoice copies (original / duplicate / triplicate) aren't a setting in the backend yet.</GapNote>
          </div>
        </SCard>

        <SCard title="Bank (printed on invoices)">
          {bankMissing && (
            <InlineAlert tone="blocked" title="Bank details not yet configured">
              {`Invoices for ${code} can't print bank details until these are saved.`}
            </InlineAlert>
          )}
          <SField label="Bank name *" value={f.bank_name} onChange={set('bank_name')} error={shown('bank_name')} placeholder="Not set" maxLength={120} />
          <SField label="Branch *" value={f.bank_branch} onChange={set('bank_branch')} error={shown('bank_branch')} placeholder="Not set" maxLength={120} />
          <SField
            label="Account number *" value={f.bank_account_no} onChange={set('bank_account_no')} error={shown('bank_account_no')}
            placeholder={mask(p.bank_account_no) || 'Not set'} maxLength={40} inputMode="numeric"
            helper={p.bank_account_no ? 'Shown masked · full number stored. Type to replace it.' : undefined}
          />
          <SField
            label="IFSC *" value={f.bank_ifsc} onChange={up('bank_ifsc')} error={shown('bank_ifsc')} placeholder="Not set" maxLength={11}
            helper={f.bank_ifsc ? `${f.bank_ifsc.length} characters` : undefined}
          />
        </SCard>
      </div>
    </>
  );
}
