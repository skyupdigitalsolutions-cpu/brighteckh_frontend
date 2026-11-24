// Job workspace layout — Figma "J1 · Job · Overview" 177:116069: page header 177:116071 + tab bar 177:116073.
// Header: title = job_number (API value, e.g. JOB-BLR-000094; Figma draws "J-00142"); meta = Figma "VFD control card ·
// ACS550 · Bharat Drives Pvt Ltd" = assembly name · observed model · customer name. Assembly = the unit's equipment
// group → GET /lookups/assemblies?ids=; customer = receipt.customer_id → GET /lookups/customers?ids=.
// Team = the current engineer (GET /lookups/engineers?ids=; falls back to the name in GET /jobs/{id}/progress when the
// engineer is no longer active). Omitted when there is no current assignment.
// Tabs (job workspace bar has no shadow): Overview · Inspection · Material · Sourcing · Quote · Authorisation ·
// Purchase order · Repair & test. Tab content is an <Outlet/>; screens read the loaded job via useJobWorkspace().
// Route: /p/jobs/:jobId/* — child paths overview | inspection | material | sourcing | quote | authorisation |
// purchase-order | repair-test (index redirects to overview).
//
// Also MANAGEMENT's read-only job page — MJ1 · Job (view) 177:140458 at /mg/jobs/:jobId/overview, and the quote view
// MQ1 177:140738… at /mg/quotes/:quoteId (MgQuoteWorkspace passes `jobId`). Management gets no tab bar (MJ1 draws none)
// and "view only" in the meta. The PURCHASE-only lookups are not called: customer / assembly / engineer names come from
// the job's GET /jobs row (allows MANAGEMENT; matched by id after a search on the job number).
import { Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { useMe } from '../../../auth/AuthProvider';
import { can, deskBase } from '../../../auth/access';
import { IconFileUnknown } from '@tabler/icons-react';
import {
  useAssembliesByIds, useCustomersByIds, useEngineersByIds, useJob, useJobProgress, useJobsList, useReceipt,
  type AssemblyLookupRow, type CustomerLookupRow, type EquipmentUnit, type InwardReceipt, type Job,
} from '../api';
import { PageHeader } from '../../../ui/desktop/PageHeader';
import { PageContent } from '../../../ui/desktop/Glass';
import { TabBar, TabLink } from '../../../ui/desktop/Tabs';
import { TableCard, SkeletonRows } from '../../../ui/desktop/DataTable';
import { EmptyState, ErrorState, StateCard, errorBody } from '../../../ui/desktop/States';
import { ButtonLink } from '../../../ui/desktop/Button';
import { apiStatus } from '../../../api/http';

export const JOB_TABS = [
  { path: 'overview', label: 'Overview' },
  { path: 'inspection', label: 'Inspection' },
  { path: 'material', label: 'Material' },
  { path: 'sourcing', label: 'Sourcing' },
  { path: 'quote', label: 'Quote' },
  { path: 'authorisation', label: 'Authorisation' },
  { path: 'purchase-order', label: 'Purchase order' },
  { path: 'repair-test', label: 'Repair & test' },
] as const;

export type JobWorkspaceContext = {
  job: Job;
  /** The job's inward receipt (JIN). undefined while loading or if it failed to load. */
  receipt: InwardReceipt | undefined;
  /** The physical unit this job was created for (from receipt.equipment_units). */
  unit: EquipmentUnit | undefined;
  /** Units in the unit's equipment group (unit_number is numbered within the group). 0 while loading. */
  unitsInGroup: number;
  /** Customer of the receipt (lookup, or the GET /jobs row for Management). undefined while loading / not found. */
  customer: Pick<CustomerLookupRow, 'customer_name'> | undefined;
  customerLoading: boolean;
  /** Assembly of the unit's equipment group (lookup, or the GET /jobs row for Management). */
  assembly: Pick<AssemblyLookupRow, 'assembly_name'> | undefined;
  /** Current engineer's name (lookup, else progress history). null if unassigned or unknown. */
  engineerName: string | null;
};

/** Tab screens call this to get the loaded job (only valid under <JobWorkspace>). */
export const useJobWorkspace = () => useOutletContext<JobWorkspaceContext>();

/** Purchase only: Management's job page (MJ1) has no tab bar. */
function Tabs({ jobId }: { jobId: string }) {
  const me = useMe();
  if (!can.purchaseWork(me.role)) return null;
  return (
    <TabBar label="Job sections">
      {JOB_TABS.map((t) => <TabLink key={t.path} to={`/p/jobs/${jobId}/${t.path}`} label={t.label} />)}
    </TabBar>
  );
}

/** `jobId` overrides the route param (Management's quote view loads the job from the quote). */
export function JobWorkspace({ jobId: jobIdProp }: { jobId?: string } = {}) {
  const params = useParams();
  const jobId = jobIdProp ?? params.jobId ?? '';
  const me = useMe();
  const purchase = can.purchaseWork(me.role);
  const base = deskBase(me.role);
  const jobQ = useJob(jobId);
  const receiptQ = useReceipt(jobQ.data?.inward_id);
  const progressQ = useJobProgress(jobQ.data ? jobId : undefined);
  const receipt = receiptQ.data;
  const unit = receipt?.equipment_units.find((u) => u.id === jobQ.data?.unit_id);
  const group = unit ? receipt?.equipment_groups.find((g) => g.id === unit.group_id) : undefined;
  const engineerId = jobQ.data?.current_assignment?.engineer_id;
  // Lookups are PURCHASE-only: Management passes no ids (the hooks stay disabled) and reads its GET /jobs row instead.
  const customersQ = useCustomersByIds(purchase ? [receipt?.customer_id] : []);
  const assembliesQ = useAssembliesByIds(purchase ? [group?.assembly_id] : []);
  const engineersQ = useEngineersByIds(purchase ? [engineerId] : []);
  const rowQ = useJobsList({ search: jobQ.data?.job_number, page_size: 25 }, !purchase && !!jobQ.data);
  const row = rowQ.data?.rows.find((r) => r.id === jobId);

  if (jobQ.isPending) {
    return (
      <>
        <header className="flex w-full items-center gap-[16px] px-[20px]" role="status" aria-label="Loading job">
          <div className="flex flex-1 flex-col gap-[4px]">
            <div className="my-[6px] h-[16px] w-[160px] animate-pulse rounded-[6px] bg-disabled" />
            <div className="my-[4px] h-[12px] w-[320px] animate-pulse rounded-[6px] bg-disabled" />
          </div>
        </header>
        <PageContent>
          <Tabs jobId={jobId} />
          <TableCard fill><SkeletonRows rows={6} /></TableCard>
        </PageContent>
      </>
    );
  }

  if (jobQ.isError) {
    const notFound = apiStatus(jobQ.error) === 404;
    return (
      <>
        <PageHeader title="Job" meta={notFound ? 'Not found' : undefined} />
        <PageContent>
          <StateCard>
            {notFound ? (
              <EmptyState
                icon={IconFileUnknown}
                title="Job not found"
                body="This Job ID doesn't exist in your company, or the link is wrong."
                action={<ButtonLink to={`${base}/jobs`} kind="secondary">Back to jobs</ButtonLink>}
              />
            ) : (
              <ErrorState title="Couldn't load this job" body={errorBody(jobQ.error)} onRetry={() => jobQ.refetch()} retrying={jobQ.isFetching} />
            )}
          </StateCard>
        </PageContent>
      </>
    );
  }

  const job = jobQ.data;
  const customer = purchase
    ? (receipt ? customersQ.data?.[receipt.customer_id] : undefined)
    : (row ? { customer_name: row.customer_name } : undefined);
  const assembly = purchase
    ? (group ? assembliesQ.data?.[group.assembly_id] : undefined)
    : (row?.assembly_name ? { assembly_name: row.assembly_name } : undefined);
  const engineerName = engineerId
    ? (purchase ? engineersQ.data?.[engineerId]?.full_name : row?.current_engineer_name)
      ?? progressQ.data?.assignments.find((x) => x.is_current)?.engineer_name
      ?? null
    : null;
  const unitsInGroup = receipt && unit ? receipt.equipment_units.filter((u) => u.group_id === unit.group_id).length : 0;
  const ctx: JobWorkspaceContext = {
    job, receipt, unit, unitsInGroup, customer, customerLoading: purchase ? !!receipt && customersQ.isPending : rowQ.isPending, assembly, engineerName,
  };
  const meta = [assembly?.assembly_name, unit?.observed_model, customer?.customer_name, !purchase && 'view only'].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        title={job.job_number}
        meta={meta}
        team={engineerId && engineerName ? [{ name: engineerName, seed: engineerId }] : undefined}
      />
      {/* flex-1: Figma "Content" fills the frame (J1 177:116072), so a tab's stretching cards reach the bottom. */}
      <PageContent className="flex-1">
        <Tabs jobId={jobId} />
        <Outlet context={ctx} />
      </PageContent>
    </>
  );
}

/**
 * Tab content stand-in. `pending` = mounted placeholder the coordinator replaces with a screen group's element;
 * otherwise the tab is drawn in Figma but has no screen in this release.
 */
export function JobTabPlaceholder({ name, pending }: { name: string; pending?: boolean }) {
  return (
    <StateCard>
      <EmptyState
        icon={IconFileUnknown}
        title={pending ? `${name} — placeholder` : `${name} isn't built yet`}
        body={pending ? 'This tab is mounted; its screen is wired in by the screen group.' : 'This tab is next in the flow-by-flow build.'}
      />
    </StateCard>
  );
}

/** Index route of /p/jobs/:jobId → Overview tab. */
export function JobWorkspaceIndex() {
  return <Navigate to="overview" replace />;
}
