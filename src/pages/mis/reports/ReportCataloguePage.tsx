// Report catalogue (no Figma frame — kit build). Data: GET /mis/catalogue + GET /mis/my-access.
// One row per runnable report: class, KPI status (DRAFT shown as-is: definitions not validated), and the caller's
// VIEW / EXPORT grant state for their own company. A row opens the viewer only with an ACTIVE VIEW grant (otherwise the
// server would 403); without one the row says why. PII_CUSTOMER is an entitlement, not a report: shown separately.
// Gates mirrored from the server (it still decides on every call):
//   no ACTIVE binding           -> every report blocked (blocked alert)
//   matrix denies class/action  -> "Not available to your role" (a grant can't even be created)
//   grant INACTIVE              -> awaiting approval; ACTIVE -> granted
import { IconChartBar, IconLock } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import {
  EmptyState, ErrorState, InlineAlert, PageContent, PageHeader, SkeletonRows, StateCard, TD, TH, THead, TR, TableCard, errorBody,
} from '../../../ui/desktop';
import {
  DATA_CLASS_LABEL, grantFor, hasActiveBinding, useCatalogue, useMyAccess, type Catalogue, type MyAccess, type ReportCatalogueRow,
} from '../api';
import { AccessState, KV, KpiBadge, MisCard, PiiChip } from '../ui';
import { useMisBase } from '../base';

const GAP = 12;
const COLS = { cls: 180, kpi: 140, view: 170, exp: 170 };

/** Does an ACTIVE binding of the caller permit `action` on this report's class (permission matrix)? */
function matrixAllows(cat: Catalogue, access: MyAccess, r: ReportCatalogueRow, action: 'VIEW' | 'EXPORT') {
  const roles = new Set(access.bindings.filter((b) => b.status === 'ACTIVE').map((b) => b.role_code));
  return cat.permission_matrix.some((m) => roles.has(m.role_code) && m.data_class === r.data_class
    && m.grant_type !== 'DENIED' && m.allowed_actions.includes(action));
}

export function ReportCataloguePage() {
  const me = useMe();
  const cat = useCatalogue();
  const acc = useMyAccess();
  const base = useMisBase();

  const header = <PageHeader title="Reports" meta="Management MIS · read-only · every run is company-scoped, masked and audited" />;
  if (cat.isError || acc.isError) {
    const e = cat.error ?? acc.error;
    return <>{header}<PageContent><StateCard><ErrorState title="Couldn't load reports" body={errorBody(e)} onRetry={() => { cat.refetch(); acc.refetch(); }} /></StateCard></PageContent></>;
  }
  const loading = cat.isPending || acc.isPending;
  const reports = (cat.data?.reports ?? []).filter((r) => r.data_class !== 'PII_CUSTOMER');
  const pii = cat.data?.reports.find((r) => r.data_class === 'PII_CUSTOMER');
  const bound = hasActiveBinding(acc.data);
  const pendingBinding = (acc.data?.bindings ?? []).some((b) => b.status === 'INACTIVE');

  return (
    <>
      {header}
      <PageContent>
        {!loading && !bound && (
          <InlineAlert tone="blocked" icon={IconLock} title={pendingBinding ? 'Your BR-10 role binding is awaiting activation' : 'No active BR-10 role binding'}>
            Reports stay blocked until a SYSTEM_ADMIN {pendingBinding ? 'activates' : 'binds and activates'} your MIS role
            (Management: R_MGMT_COMPANY or R_MGMT_GROUP). A grant alone is not enough.
          </InlineAlert>
        )}
        <TableCard>
          <THead gap={GAP}>
            <TH grow>Report</TH>
            <TH w={COLS.cls}>Data class</TH>
            <TH w={COLS.kpi}>KPI status</TH>
            <TH w={COLS.view}>View</TH>
            <TH w={COLS.exp}>Export</TH>
          </THead>
          {loading ? <SkeletonRows rows={8} widths={[320, 140, 100, 120, 120]} /> : reports.length === 0 ? (
            <div className="flex flex-1 items-center justify-center"><EmptyState icon={IconChartBar} title="No reports in the catalogue" /></div>
          ) : reports.map((r) => {
            const view = grantFor(acc.data, r.report_code, 'VIEW', me.company_id);
            const exp = grantFor(acc.data, r.report_code, 'EXPORT', me.company_id);
            const allowedView = bound && matrixAllows(cat.data!, acc.data!, r, 'VIEW');
            const allowedExp = bound && matrixAllows(cat.data!, acc.data!, r, 'EXPORT');
            const open = view?.status === 'ACTIVE' && bound;
            const cell = (allowed: boolean, g: typeof view) => (!bound ? <Muted>Blocked · no binding</Muted>
              : !allowed ? <Muted>Not available to your role</Muted>
                : <AccessState status={g?.status === 'ACTIVE' || g?.status === 'INACTIVE' ? g.status : null} />);
            return (
              <TR key={r.report_code} gap={GAP} to={open ? `${base}/reports/${r.report_code}` : undefined} className={open ? undefined : 'hover:bg-transparent'}>
                <TD grow>
                  <div className="flex min-w-0 flex-col gap-[2px]">
                    <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{r.title}</span>
                    <span className="truncate text-[12px] leading-[16px] text-fg-2"><span className="font-mono">{r.report_code}</span> · {r.description}</span>
                  </div>
                </TD>
                <TD w={COLS.cls} kind="text">{DATA_CLASS_LABEL[r.data_class]}</TD>
                <TD w={COLS.kpi}><KpiBadge status={r.kpi_status} /></TD>
                <TD w={COLS.view}>{cell(allowedView, view)}</TD>
                <TD w={COLS.exp}>{cell(allowedExp, exp)}</TD>
              </TR>
            );
          })}
        </TableCard>

        {pii && !loading && (
          <MisCard title="Customer PII" right={<PiiChip unmasked={grantFor(acc.data, pii.report_code, 'VIEW', me.company_id)?.status === 'ACTIVE'} />}>
            <p className="text-[14px] leading-[20px] text-fg-2">
              Customer name and GSTIN are masked in every report unless you hold an ACTIVE PII_CUSTOMER grant for each company in
              scope. VIEW unmasks the screen; EXPORT unmasks files. Masking is applied by the server — each report shows the state it ran with.
            </p>
            <KV label="On screen (PII_CUSTOMER · VIEW)" value={<AccessState status={liveStatus(grantFor(acc.data, pii.report_code, 'VIEW', me.company_id))} />} />
            <KV label="In exports (PII_CUSTOMER · EXPORT)" value={<AccessState status={liveStatus(grantFor(acc.data, pii.report_code, 'EXPORT', me.company_id))} />} />
          </MisCard>
        )}
      </PageContent>
    </>
  );
}

const liveStatus = (g: { status: string } | null) => (g?.status === 'ACTIVE' || g?.status === 'INACTIVE' ? g.status : null);
const Muted = ({ children }: { children: string }) => <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-muted">{children}</span>;
