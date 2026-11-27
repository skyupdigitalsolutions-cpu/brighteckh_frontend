// AST1 · Authorisers — main 294:60622 · saved 294:60972 · validation error 294:61328 · loading 294:61690 · error 294:61973.
// One card "Who approves what": header row (bg-subtle, radius 14) Action · Approver role, then one row per action
// (px-10 py-8, 1px bottom border) with a role select (h-36, radius 12, mono value), then the refund-limit row.
//
// Data → API (one role per authority, all per company):
//   Customer refund / credit note  → BR-09 REFUND_REPLACEMENT_REVIEW   Warranty claim → BR-09 CLAIM_DECISION
//   Goodwill / free repair         → BR-09 GOODWILL_APPROVAL           Advance replacement → BR-09 REPLACEMENT_APPROVAL
//   Supplier refund / AP           → company supplier_refund_authority_role (stored only)
//   Customer return (RMA)          → company customer_return_authority_role (stored only)
//   Supplier return                → company supplier_return_authority_role (027, stored only)
//   Management KPI sign-off        → company kpi_signoff_authority_role (stored only)
//   Finance-report access          → BR-10 FINANCIAL_GRANT approver
// Save = PUT /admin/settings/companies/:id/authorisers with the changed rows only.
// Deviations:
// - The frame says "Applies to all companies"; the API stores authorisers per company, so the company switcher is shown.
// - "Client default" column + "CLIENT-CONFIRMED DEFAULTS" badge: no API source for client defaults → GapNote.
// - Composite approvers ("MD & Accounts") don't exist: each authority is ONE role.
// - "Refunds above a limit need higher approval": no backend rule → shown BLOCKED with a GapNote.
import { useMemo, useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import { Badge, FormErrors, GapNote, Ic, cx } from '../../ui/desktop';
import { ROLE_CODES, settingsApi, useSettingsSave, type AuthorisersBody, type CompanySettings } from './api';
import { ROLE_OPTION_LABEL, SCard, SavedAlert, SettingsToolbar } from './local';
import { useSettingsCtx } from './SettingsLayout';
import { TabFrame } from './TabFrame';

type Src =
  | { kind: 'support'; code: 'CLAIM_DECISION' | 'GOODWILL_APPROVAL' | 'REFUND_REPLACEMENT_REVIEW' | 'REPLACEMENT_APPROVAL' }
  | { kind: 'mis'; code: 'FINANCIAL_GRANT' }
  | { kind: 'role'; code: 'customer_return_authority_role' | 'supplier_refund_authority_role' | 'kpi_signoff_authority_role' | 'supplier_return_authority_role' };

const ROWS: { key: string; label: string; src: Src; stored?: boolean }[] = [
  { key: 'cust_refund', label: 'Customer refund / credit note', src: { kind: 'support', code: 'REFUND_REPLACEMENT_REVIEW' } },
  { key: 'supp_refund', label: 'Supplier refund / accounts payable', src: { kind: 'role', code: 'supplier_refund_authority_role' }, stored: true },
  { key: 'warranty', label: 'Warranty claim', src: { kind: 'support', code: 'CLAIM_DECISION' } },
  { key: 'goodwill', label: 'Goodwill / free repair', src: { kind: 'support', code: 'GOODWILL_APPROVAL' } },
  { key: 'rma', label: 'Customer return (RMA)', src: { kind: 'role', code: 'customer_return_authority_role' }, stored: true },
  { key: 'supp_return', label: 'Supplier return', src: { kind: 'role', code: 'supplier_return_authority_role' }, stored: true },
  { key: 'adv_repl', label: 'Advance replacement', src: { kind: 'support', code: 'REPLACEMENT_APPROVAL' } },
  { key: 'kpi', label: 'Management KPI sign-off', src: { kind: 'role', code: 'kpi_signoff_authority_role' }, stored: true },
  { key: 'fin_report', label: 'Finance-report access', src: { kind: 'mis', code: 'FINANCIAL_GRANT' } },
];

type SupportRole = NonNullable<AuthorisersBody['support']>[number]['approver_role_code'];
type MisRole = NonNullable<AuthorisersBody['mis']>[number]['approver_role_code'];

function current(d: CompanySettings, src: Src): string {
  if (src.kind === 'support') return d.support_config.authorities.find((a) => a.decision_kind === src.code)?.approver_role_code ?? '';
  if (src.kind === 'mis') return d.mis_authorities.find((a) => a.authority_kind === src.code)?.approver_role_code ?? '';
  const pol = d.company_config.policy as Record<string, unknown> | null;
  return (pol?.[src.code] as string | null | undefined) ?? '';
}

export function AuthorisersTab() {
  const [justSaved, setJustSaved] = useState<string | null>(null);
  return (
    <TabFrame tab="AUTHORISERS" titles={['Who approves what']} errorTitle="Couldn't load the authorisers">
      {(d) => (
        <AuthorisersForm
          key={`${d.company.id}|${d.last_saved.AUTHORISERS?.at ?? ''}`}
          data={d}
          justSaved={justSaved === d.company.id}
          onSaved={() => setJustSaved(d.company.id)}
        />
      )}
    </TabFrame>
  );
}

function AuthorisersForm({ data, justSaved, onSaved }: { data: CompanySettings; justSaved: boolean; onSaved: () => void }) {
  const { companies, setCompanyId } = useSettingsCtx();
  const start = useMemo(() => Object.fromEntries(ROWS.map((r) => [r.key, current(data, r.src)])), [data]);
  const [v, setV] = useState<Record<string, string>>(start);
  const changed = ROWS.filter((r) => v[r.key] !== start[r.key]);
  const dirty = changed.length > 0;

  const m = useSettingsSave(async () => {
    const body: AuthorisersBody = {};
    const roles: Record<string, string | null> = {};
    for (const r of changed) {
      const role = (v[r.key] || null) as SupportRole;
      if (r.src.kind === 'support') (body.support ??= []).push({ decision_kind: r.src.code, approver_role_code: role });
      else if (r.src.kind === 'mis') (body.mis ??= []).push({ authority_kind: r.src.code, approver_role_code: role as MisRole });
      else roles[r.src.code] = v[r.key] || null;
    }
    if (Object.keys(roles).length) body.roles = roles as AuthorisersBody['roles'];
    await settingsApi.authorisers(data.company.id, body);
  });

  return (
    <>
      <SettingsToolbar
        companies={companies}
        companyId={data.company.id}
        onCompany={setCompanyId}
        saved={data.last_saved.AUTHORISERS}
        savedJustNow={justSaved}
        dirty={dirty}
        canSave={dirty}
        busy={m.isPending}
        onDiscard={() => { setV(start); m.reset(); }}
        onSave={() => m.mutate(undefined, { onSuccess: onSaved })}
      />
      <FormErrors error={m.error} title="Authorisers weren't saved" />
      {justSaved && !dirty && !m.error && (
        <SavedAlert title={`Authorisers saved · ${data.company.entity_code}`}>New approvals route to these roles from now. Decisions already taken are unchanged.</SavedAlert>
      )}
      <SCard title="Who approves what" className="min-h-[480px]">
        <div role="table" className="flex w-full flex-col">
          <div role="row" className="flex w-full items-center gap-[10px] rounded-[14px] bg-subtle px-[10px] py-[8px] text-[12px] font-medium leading-[16px] text-fg-2">
            <span role="columnheader" className="min-w-px flex-1">Action</span>
            <span role="columnheader" className="w-[300px] shrink-0">Approver role</span>
          </div>
          {ROWS.map((r) => {
            const val = v[r.key];
            const unset = !val;
            return (
              <div role="row" key={r.key} className="flex w-full items-center gap-[10px] border-b border-line px-[10px] py-[8px]">
                <div role="cell" className="flex min-w-px flex-1 items-center gap-[8px]">
                  <span className="text-[14px] font-medium leading-[20px] text-fg">{r.label}</span>
                  {unset && <Badge tone="blocked" label="NOT SET" />}
                  {r.stored && <span className="text-[12px] leading-[16px] text-fg-muted">Recorded · no workflow reads it yet</span>}
                </div>
                <div role="cell" className="w-[300px] shrink-0">
                  <RoleSelect label={r.label} value={val} onChange={(x) => setV((s) => ({ ...s, [r.key]: x }))} />
                </div>
              </div>
            );
          })}
          <div className="mt-[8px] flex w-full items-center gap-[12px] rounded-[14px] bg-subtle px-[10px] py-[10px]">
            <div className="flex min-w-px flex-1 flex-col gap-[2px]">
              <p className="text-[14px] font-medium leading-[20px] text-fg">Refunds above a limit need higher approval</p>
              <p className="text-[12px] leading-[16px] text-fg-2">Client: no fixed amount — Accounts approves all refunds.</p>
            </div>
            <Badge tone="blocked" label="BLOCKED" />
          </div>
        </div>
        <GapNote code="NO API">Refund limit: the backend has no refund-limit rule, so this can't be switched on here.</GapNote>
        <GapNote code="NO API">Client defaults aren't stored in the backend, so the frame's "Client default" column is omitted. Each authority is one role — combined approvers (e.g. "MD & Accounts") aren't supported.</GapNote>
        <GapNote code="PER COMPANY">The design says these apply to all companies; the backend keeps them per company. Use the company switcher above.</GapNote>
      </SCard>
    </>
  );
}

function RoleSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className={cx('relative flex h-[36px] w-full items-center rounded-[12px] border border-line-strong bg-surface focus-within:ring-inside-brand')}>
      <select
        aria-label={`${label} approver`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx('h-full w-full appearance-none bg-transparent pl-[12px] pr-[36px] font-mono text-[14px] leading-[20px] focus:outline-none', value ? 'text-fg' : 'text-fg-muted')}
      >
        <option value="">Not set</option>
        {ROLE_CODES.map((c) => <option key={c} value={c}>{ROLE_OPTION_LABEL[c]}</option>)}
      </select>
      <Ic icon={IconChevronDown} size={18} className="pointer-events-none absolute right-[10px] text-fg-2" />
    </div>
  );
}
