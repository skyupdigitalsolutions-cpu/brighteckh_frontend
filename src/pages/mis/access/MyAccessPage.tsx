// My access (no Figma frame — kit build). Data: GET /mis/my-access, /mis/catalogue (titles), /mis/companies (codes),
// /mis/authorities (who approves restricted grants). Read-only: the caller can't change their own access (no
// self-binding / self-grant / self-approval) — requests go to a SYSTEM_ADMIN, which this page says plainly.
import { IconKey, IconUserShield } from '@tabler/icons-react';
import { formatDateTime } from '../../../lib/format';
import {
  EmptyState, ErrorState, PageContent, PageHeader, SkeletonRows, StateCard, TD, TH, THead, TR, TableCard, errorBody,
} from '../../../ui/desktop';
import { useAuthorities, useCatalogue, useCompanies, useMyAccess } from '../api';
import { KV, MisCard, StatusBadge } from '../ui';

const GAP = 12;

export function MyAccessPage() {
  const acc = useMyAccess();
  const cat = useCatalogue();
  const cos = useCompanies();
  const auth = useAuthorities();
  const header = <PageHeader title="My access" meta="Your MIS role bindings and report grants · changed only by a SYSTEM_ADMIN, never by you" />;

  if (acc.isError) return <>{header}<PageContent><StateCard><ErrorState title="Couldn't load your access" body={errorBody(acc.error)} onRetry={() => acc.refetch()} /></StateCard></PageContent></>;

  const roleTitle = (c: string) => cat.data?.roles.find((r) => r.role_code === c)?.title ?? c;
  const reportTitle = (c: string) => cat.data?.reports.find((r) => r.report_code === c)?.title ?? c;
  const code = (id: string) => cos.data?.find((c) => c.id === id)?.entity_code ?? '…';

  return (
    <>
      {header}
      <PageContent>
        <div className="flex w-full items-start gap-[20px]">
          <MisCard title="Role bindings" className="min-w-px flex-1">
            {acc.isPending ? <SkeletonRows rows={2} widths={[200, 90]} /> : acc.data.bindings.length === 0 ? (
              <EmptyState icon={IconUserShield} title="No MIS role binding" body="Ask a SYSTEM_ADMIN to bind your MIS role. Reports stay blocked until the binding is ACTIVE." />
            ) : acc.data.bindings.map((b) => (
              <div key={b.id} className="flex w-full items-center gap-[12px] border-b border-line pb-[10px] last:border-0 last:pb-0">
                <div className="flex min-w-px flex-1 flex-col">
                  <span className="text-[14px] font-medium leading-[20px] text-fg">{roleTitle(b.role_code)}</span>
                  <span className="text-[12px] leading-[16px] text-fg-2">
                    <span className="font-mono">{b.role_code}</span>
                    {b.activated_at ? ` · active since ${formatDateTime(b.activated_at)}` : b.revoked_at ? ` · revoked ${formatDateTime(b.revoked_at)}` : ' · awaiting activation by a SYSTEM_ADMIN'}
                  </span>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </MisCard>

          <MisCard title="Who approves restricted grants" className="w-[480px] shrink-0">
            {auth.isPending ? <SkeletonRows rows={2} widths={[160, 120]} /> : auth.isError ? <p className="text-[14px] text-fg-2">{errorBody(auth.error)}</p> : auth.data.map((a) => (
              <KV
                key={a.authority_kind}
                label={a.authority_kind === 'FINANCIAL_GRANT' ? 'Financial (margin, receivables, audit)' : 'Cross-company'}
                value={a.approver_role_code
                  ? <span className="font-mono text-[13px]">{a.approver_role_code}</span>
                  : <span className="text-st-blocked-fg">Not configured · blocked</span>}
              />
            ))}
            <p className="text-[12px] leading-[16px] text-fg-2">
              Unconfigured = CLIENT-UNCONFIRMED: grants needing that approval cannot become ACTIVE. A SYSTEM_ADMIN can never approve financial access.
            </p>
          </MisCard>
        </div>

        <TableCard>
          <THead gap={GAP}>
            <TH grow>Report</TH><TH w={90}>Action</TH><TH w={90}>Company</TH><TH w={220}>Approvals</TH><TH w={170}>Since</TH><TH w={110}>Status</TH>
          </THead>
          {acc.isPending ? <SkeletonRows rows={5} widths={[300, 60, 50, 180, 130, 80]} /> : acc.data.grants.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-[24px]">
              <EmptyState icon={IconKey} title="No report grants" body="Each report needs a named grant per action (VIEW and EXPORT are separate). A SYSTEM_ADMIN creates them; some need a financial or cross-company approval." />
            </div>
          ) : acc.data.grants.map((g) => (
            <TR key={g.id} gap={GAP} className="hover:bg-transparent">
              <TD grow>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{reportTitle(g.report_code)}</span>
                  <span className="font-mono text-[12px] leading-[16px] text-fg-2">{g.report_code}</span>
                </div>
              </TD>
              <TD w={90} kind="id">{g.action}</TD>
              <TD w={90} kind="id">{code(g.target_company_id)}</TD>
              <TD w={220} kind="small">{g.required_approvals.join(' + ') || '—'}</TD>
              <TD w={170} kind="text">{g.activated_at ? formatDateTime(g.activated_at) : g.status === 'INACTIVE' ? 'Awaiting approval' : '—'}</TD>
              <TD w={110}><StatusBadge status={g.status} /></TD>
            </TR>
          ))}
        </TableCard>
      </PageContent>
    </>
  );
}
