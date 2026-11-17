// SYSTEM_ADMIN · Report grants (no Figma frame — kit build). Data: GET /mis/report-grants (names + approvals),
// /mis/report-grants/pending-my-approval (STANDARD approvals the admin can give, shown on top), /mis/authorities,
// /mis/employees, /mis/catalogue, /mis/companies. Writes: POST /mis/report-grants (starts INACTIVE; the DB derives
// required approvals), /:id/approve, /:id/revoke.
// Separation of duties surfaced, not worked around: no self-grant (you are not in the picker); FINANCIAL (margin /
// receivables / audit) needs the configured authoriser of the data-owner company and NEVER a SYSTEM_ADMIN;
// CROSS_COMPANY needs the data owner's authoriser. When that authoriser isn't configured (CLIENT-UNCONFIRMED) the
// grant is shown as blocked with the reason.
import { useMemo, useState, type ReactNode } from 'react';
import { IconKey, IconPlus } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { formatDateTime } from '../../../lib/format';
import {
  Button, ChoiceChips, Drawer, EmptyState, ErrorState, FormErrors, Ic, InlineAlert, PageContent, PageHeader, SelectField,
  SkeletonRows, StateCard, TD, TH, THead, TR, TableCard, TextAreaField, errorBody, useToast,
} from '../../../ui/desktop';
import {
  FINANCIAL_CLASSES, useAuthorities, useCatalogue, useCompanies, useCreateGrant, useEmployees, useGrants, usePendingMyApproval,
  useRevokeGrant, type Authority, type GrantAction, type GrantListRow, type ReportCode,
} from '../api';
import { PendingApprovals } from '../approvals/ApprovalsPage';
import { StatusBadge } from '../ui';
import { ConfirmInline } from './ConfirmInline';

const GAP = 12;

export function GrantsPage() {
  const q = useGrants();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Report grants"
        meta="Named grants per report, action (VIEW / EXPORT) and data-owner company · every grant starts INACTIVE"
        action={<Button icon={<Ic icon={IconPlus} size={18} />} onClick={() => setOpen(true)}>New grant</Button>}
      />
      <PageContent>
        <PendingApprovals compact />
        {q.isError ? <StateCard><ErrorState title="Couldn't load grants" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} /></StateCard> : (
          <TableCard fill>
            <THead gap={GAP}>
              <TH grow>Employee</TH><TH w={230}>Report</TH><TH w={80}>Action</TH><TH w={80}>Owner</TH><TH w={300}>Approvals</TH><TH w={110}>Status</TH><TH w={110} />
            </THead>
            {q.isPending ? <SkeletonRows rows={8} widths={[220, 180, 50, 40, 240, 80, 80]} /> : q.data.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState icon={IconKey} title="No report grants yet" body="A grant names one employee, one report, one action and one data-owner company. The employee also needs an ACTIVE role binding that permits that data class." />
              </div>
            ) : q.data.map((g) => <GrantRow key={g.id} g={g} />)}
          </TableCard>
        )}
      </PageContent>
      <CreateGrantDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Why an INACTIVE grant isn't active yet, per missing approval. */
function approvalState(g: GrantListRow, ownCompany: string, auth: Authority[] | undefined, mine: Set<string>): ReactNode[] {
  const recorded = new Set((g.approvals ?? []).map((a) => a.approval_kind));
  return g.required_approvals.map((k) => {
    if (recorded.has(k as never)) return <Line key={k} ok>{k} ✓</Line>;
    if (g.status !== 'INACTIVE') return <Line key={k}>{k} · not recorded</Line>;
    if (k === 'STANDARD') return <Line key={k}>{mine.has(g.id) ? 'STANDARD · you can approve (above)' : 'STANDARD · a SYSTEM_ADMIN of the grantee company (not the grantee)'}</Line>;
    const kind = k === 'FINANCIAL' ? 'FINANCIAL_GRANT' : 'CROSS_COMPANY_GRANT';
    if (g.target_company_id !== ownCompany) return <Line key={k}>{k} · the {g.target_company_code} authoriser</Line>;
    const a = auth?.find((x) => x.authority_kind === kind);
    if (!a?.approver_role_code) return <Line key={k} blocked>{k} · blocked: no authoriser configured (CLIENT-UNCONFIRMED)</Line>;
    return <Line key={k}>{k} · awaiting {a.approver_role_code}{k === 'FINANCIAL' ? ' (never a SYSTEM_ADMIN)' : ''}</Line>;
  });
}
function Line({ children, ok, blocked }: { children: ReactNode; ok?: boolean; blocked?: boolean }) {
  return <span className={`block text-[12px] leading-[16px] ${ok ? 'text-st-success-fg' : blocked ? 'text-st-blocked-fg' : 'text-fg-2'}`}>{children}</span>;
}

function GrantRow({ g }: { g: GrantListRow }) {
  const me = useMe();
  const auth = useAuthorities();
  const pending = usePendingMyApproval();
  const revoke = useRevokeGrant();
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const mine = new Set((pending.data ?? []).map((p) => p.id));
  return (
    <div className="flex w-full flex-col border-b border-line">
      <TR gap={GAP} className="border-b-0 hover:bg-transparent">
        <TD grow>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{g.employee_name}</span>
            <span className="text-[12px] leading-[16px] text-fg-2"><span className="font-mono">{g.employee_code}</span> · created {formatDateTime(g.created_at)}</span>
          </div>
        </TD>
        <TD w={230}>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-[13px] font-medium leading-[18px] text-fg">{g.report_code}</span>
            <span className="text-[12px] leading-[16px] text-fg-2">{g.data_class.replace(/_/g, ' ')}</span>
          </div>
        </TD>
        <TD w={80} kind="id">{g.action}</TD>
        <TD w={80} kind="id">{g.target_company_code}</TD>
        <TD w={300}><div className="flex flex-col gap-[2px]">{approvalState(g, me.company_id, auth.data, mine)}</div></TD>
        <TD w={110}><StatusBadge status={g.status} /></TD>
        <TD w={110} className="justify-end">
          {g.status !== 'REVOKED' && <Button kind="secondary" onClick={() => setAsk(true)}>Revoke</Button>}
        </TD>
      </TR>
      {ask && (
        <div className="px-[16px] pb-[12px]">
          <ConfirmInline
            danger
            text={`Revoke ${g.employee_name}'s ${g.action} on ${g.report_code} (${g.target_company_code})? Effective on their next call; a revoked grant stays revoked.`}
            confirmLabel="Confirm revoke"
            busy={revoke.isPending}
            onCancel={() => setAsk(false)}
            onConfirm={() => revoke.mutate(g.id, { onSuccess: () => { setAsk(false); toast({ tone: 'success', title: 'Grant revoked' }); } })}
          />
        </div>
      )}
      {revoke.error != null && <div className="px-[16px] pb-[12px]"><FormErrors error={revoke.error} title="The server refused this" /></div>}
    </div>
  );
}

function CreateGrantDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const emps = useEmployees();
  const cat = useCatalogue();
  const cos = useCompanies();
  const auth = useAuthorities();
  const create = useCreateGrant();
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [report, setReport] = useState('');
  const [action, setAction] = useState<GrantAction>('VIEW');
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const options = useMemo(() => (emps.data ?? []).filter((e) => e.id !== me.id), [emps.data, me.id]); // no self-grant
  const entry = cat.data?.reports.find((r) => r.report_code === report);
  const targetId = target || me.company_id;
  const cross = targetId !== me.company_id;
  const financial = !!entry && FINANCIAL_CLASSES.includes(entry.data_class);
  const needs = [financial && 'FINANCIAL', cross && 'CROSS_COMPANY'].filter(Boolean) as string[];
  const finAuth = auth.data?.find((a) => a.authority_kind === 'FINANCIAL_GRANT');

  const close = () => { setEmployeeId(''); setReport(''); setAction('VIEW'); setTarget(''); setNote(''); create.reset(); onClose(); };
  const submit = () => create.mutate({
    employee_id: employeeId, report_code: report as ReportCode, action,
    ...(cross ? { target_company_id: targetId } : {}), ...(note.trim() ? { note: note.trim() } : {}),
  }, {
    onSuccess: (g) => {
      toast({ tone: 'success', title: 'Grant created · INACTIVE', body: `Needs ${g.required_approvals.join(' + ')} before it works.` });
      close();
    },
  });

  return (
    <Drawer
      open={open}
      onClose={close}
      busy={create.isPending}
      title="New report grant"
      subtitle="Starts INACTIVE · the database derives the approvals it needs"
      onSubmit={submit}
      footer={<>
        <Button kind="secondary" onClick={close} disabled={create.isPending}>Cancel</Button>
        <Button type="submit" disabled={!employeeId || !report} busy={create.isPending}>Create grant</Button>
      </>}
    >
      <SelectField label="Employee" value={employeeId} placeholder={emps.isPending ? 'Loading…' : 'Choose an employee'} onChange={(e) => setEmployeeId(e.target.value)}>
        {options.map((e) => <option key={e.id} value={e.id}>{e.full_name} · {e.employee_code} · {e.role_code}</option>)}
      </SelectField>
      <SelectField label="Report" value={report} placeholder="Choose a report" onChange={(e) => setReport(e.target.value)}
        helper={entry ? `${entry.data_class.replace(/_/g, ' ')}${entry.data_class === 'PII_CUSTOMER' ? ' · unmasks customer name / GSTIN in other reports' : ''}` : undefined}>
        {(cat.data?.reports ?? []).map((r) => <option key={r.report_code} value={r.report_code}>{r.title} · {r.report_code}</option>)}
      </SelectField>
      <ChoiceChips<GrantAction> label="Action" value={action} onChange={setAction}
        options={[{ value: 'VIEW', label: 'VIEW' }, { value: 'EXPORT', label: 'EXPORT' }]}
        helper="VIEW and EXPORT are separate grants." />
      <SelectField label="Data-owner company" value={targetId} onChange={(e) => setTarget(e.target.value)}
        helper={cross ? 'Another company: needs a CROSS_COMPANY approval from that company\'s authoriser, and a role with GRANTED_COMPANIES scope.' : undefined}>
        {(cos.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.entity_code} · {c.name}{c.id === me.company_id ? ' (yours)' : ''}</option>)}
      </SelectField>
      <TextAreaField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />

      {entry && (
        <InlineAlert tone={financial && !finAuth?.approver_role_code ? 'blocked' : 'neutral'} title={`Will need: ${needs.length ? needs.join(' + ') : 'STANDARD'} approval`}>
          {needs.length === 0 && 'A SYSTEM_ADMIN of your company (not the grantee) records it.'}
          {financial && (finAuth?.approver_role_code
            ? `FINANCIAL: the configured authoriser (${finAuth.approver_role_code}) of the data-owner company — never a SYSTEM_ADMIN. `
            : 'FINANCIAL: no authoriser is configured (CLIENT-UNCONFIRMED), so this grant will stay INACTIVE. ')}
          {cross && 'CROSS_COMPANY: the data-owner company\'s configured authoriser.'}
        </InlineAlert>
      )}
      <p className="text-[12px] leading-[16px] text-fg-2">You are not in the employee list: no self-grant. The employee must already hold an ACTIVE binding whose role permits this class.</p>
      <FormErrors error={create.error} title="The grant wasn't created" />
    </Drawer>
  );
}
