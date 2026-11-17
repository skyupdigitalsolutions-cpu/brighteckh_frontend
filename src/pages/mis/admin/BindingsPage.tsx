// SYSTEM_ADMIN · Role bindings (no Figma frame — kit build). Data: GET /mis/role-bindings, /mis/employees,
// /mis/catalogue. Writes: POST /mis/role-bindings (starts INACTIVE), /:id/activate, /:id/revoke.
// DB rules mirrored (the DB still enforces them): only R_* roles that map to the employee's existing role_code are
// offered (no second role system); no self-binding (you are not in the picker); no self-activation (your own binding
// shows who must act instead of an Activate button).
import { useMemo, useState } from 'react';
import { IconPlus, IconUserShield } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { formatDateTime } from '../../../lib/format';
import {
  Button, Drawer, EmptyState, ErrorState, FormErrors, Ic, InlineAlert, PageContent, PageHeader, SelectField, SkeletonRows,
  StateCard, TD, TH, THead, TR, TableCard, TextAreaField, errorBody, useToast,
} from '../../../ui/desktop';
import {
  useActivateBinding, useBindings, useCatalogue, useCreateBinding, useEmployees, useRevokeBinding,
  type BindingListRow, type BrRoleCode,
} from '../api';
import { StatusBadge } from '../ui';
import { ConfirmInline } from './ConfirmInline';

const GAP = 12;

export function BindingsPage() {
  const q = useBindings();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Role bindings"
        meta="Which MIS role each employee holds · every binding starts INACTIVE and needs an explicit activation"
        action={<Button icon={<Ic icon={IconPlus} size={18} />} onClick={() => setOpen(true)}>New binding</Button>}
      />
      <PageContent>
        {q.isError ? <StateCard><ErrorState title="Couldn't load role bindings" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} /></StateCard> : (
          <TableCard fill>
            <THead gap={GAP}>
              <TH grow>Employee</TH><TH w={200}>MIS role</TH><TH w={230}>Created</TH><TH w={230}>Activated / revoked</TH><TH w={110}>Status</TH><TH w={200} />
            </THead>
            {q.isPending ? <SkeletonRows rows={6} widths={[240, 140, 180, 180, 80, 120]} /> : q.data.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState icon={IconUserShield} title="No role bindings yet" body="Bind an employee to the MIS role matching their job role. Nobody can run a report without an ACTIVE binding." />
              </div>
            ) : q.data.map((b) => <BindingRow key={b.id} b={b} />)}
          </TableCard>
        )}
      </PageContent>
      <CreateBindingDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function BindingRow({ b }: { b: BindingListRow }) {
  const me = useMe();
  const toast = useToast();
  const activate = useActivateBinding();
  const revoke = useRevokeBinding();
  const [ask, setAsk] = useState<'activate' | 'revoke' | null>(null);
  const self = b.employee_id === me.id;
  const run = (kind: 'activate' | 'revoke') => (kind === 'activate' ? activate : revoke).mutate(b.id, {
    onSuccess: () => { setAsk(null); toast({ tone: 'success', title: kind === 'activate' ? 'Binding activated' : 'Binding revoked', body: `${b.employee_name} · ${b.role_code}` }); },
  });
  return (
    <div className="flex w-full flex-col border-b border-line">
      <TR gap={GAP} className="border-b-0 hover:bg-transparent">
        <TD grow>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{b.employee_name}{!b.employee_is_active && ' (inactive)'}</span>
            <span className="text-[12px] leading-[16px] text-fg-2"><span className="font-mono">{b.employee_code}</span> · {b.employee_role_code}</span>
          </div>
        </TD>
        <TD w={200} kind="id">{b.role_code}</TD>
        <TD w={230} kind="small">{b.created_by_name} · {formatDateTime(b.created_at)}</TD>
        <TD w={230} kind="small">
          {b.revoked_at ? `${b.revoked_by_name ?? '—'} · ${formatDateTime(b.revoked_at)}` : b.activated_at ? `${b.activated_by_name ?? '—'} · ${formatDateTime(b.activated_at)}` : '—'}
        </TD>
        <TD w={110}><StatusBadge status={b.status} /></TD>
        <TD w={200} className="justify-end gap-[8px]">
          {b.status === 'INACTIVE' && !self && <Button onClick={() => setAsk('activate')}>Activate</Button>}
          {b.status !== 'REVOKED' && <Button kind="secondary" onClick={() => setAsk('revoke')}>Revoke</Button>}
        </TD>
      </TR>
      {self && b.status === 'INACTIVE' && (
        <p className="px-[16px] pb-[12px] text-[12px] leading-[16px] text-fg-2">This is your own binding: another SYSTEM_ADMIN must activate it (no self-activation).</p>
      )}
      {ask && (
        <div className="px-[16px] pb-[12px]">
          <ConfirmInline
            text={ask === 'activate'
              ? `Activate ${b.role_code} for ${b.employee_name}? Their existing grants for this role's data classes start working immediately.`
              : `Revoke ${b.role_code} for ${b.employee_name}? Their reports stop on the very next call.`}
            confirmLabel={ask === 'activate' ? 'Confirm activation' : 'Confirm revoke'}
            danger={ask === 'revoke'}
            busy={activate.isPending || revoke.isPending}
            onConfirm={() => run(ask)}
            onCancel={() => setAsk(null)}
          />
        </div>
      )}
      {(activate.error || revoke.error) && <div className="px-[16px] pb-[12px]"><FormErrors error={activate.error ?? revoke.error} title="The server refused this" /></div>}
    </div>
  );
}

function CreateBindingDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const emps = useEmployees();
  const cat = useCatalogue();
  const create = useCreateBinding();
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState('');
  const [note, setNote] = useState('');
  // You can't bind yourself; only employees whose job role maps to an R_* role can be bound.
  const options = useMemo(() => (emps.data ?? []).filter((e) => e.id !== me.id && e.bindable_role_codes.length > 0), [emps.data, me.id]);
  const emp = options.find((e) => e.id === employeeId);
  const roles = emp?.bindable_role_codes ?? [];
  const close = () => { setEmployeeId(''); setRole(''); setNote(''); create.reset(); onClose(); };
  const submit = () => create.mutate(
    { employee_id: employeeId, role_code: role as BrRoleCode, ...(note.trim() ? { note: note.trim() } : {}) },
    { onSuccess: () => { toast({ tone: 'success', title: 'Binding created · INACTIVE', body: 'Activate it from the list when ready.' }); close(); } },
  );
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={create.isPending}
      title="New role binding"
      subtitle="Starts INACTIVE · activate it separately"
      onSubmit={submit}
      footer={<>
        <Button kind="secondary" onClick={close} disabled={create.isPending}>Cancel</Button>
        <Button type="submit" disabled={!employeeId || !role} busy={create.isPending}>Create binding</Button>
      </>}
    >
      {emps.isError ? <FormErrors error={emps.error} title="Couldn't load employees" /> : (
        <SelectField label="Employee" value={employeeId} placeholder={emps.isPending ? 'Loading…' : 'Choose an employee'} onChange={(e) => { setEmployeeId(e.target.value); setRole(''); }}>
          {options.map((e) => <option key={e.id} value={e.id}>{e.full_name} · {e.employee_code} · {e.role_code}</option>)}
        </SelectField>
      )}
      <SelectField label="MIS role" value={role} disabled={!emp} placeholder={emp ? 'Choose a role' : 'Choose an employee first'} onChange={(e) => setRole(e.target.value)}
        helper={emp ? `Only roles that map to ${emp.role_code} are allowed — BR-10 never creates a second role system.` : undefined}>
        {roles.map((r) => {
          const rc = cat.data?.roles.find((x) => x.role_code === r);
          return <option key={r} value={r}>{r}{rc ? ` · ${rc.title}${rc.is_provisional ? ' (provisional)' : ''}` : ''}</option>;
        })}
      </SelectField>
      <TextAreaField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
      <InlineAlert tone="neutral" title="You won't appear in the list">No self-binding: another SYSTEM_ADMIN binds and activates your own MIS role.</InlineAlert>
      <FormErrors error={create.error} title="The binding wasn't created" />
    </Drawer>
  );
}
