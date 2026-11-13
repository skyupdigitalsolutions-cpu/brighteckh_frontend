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
import { Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { IconFileUnknown } from '@tabler/icons-react';
import {
  useAssembliesByIds, useCustomersByIds, useEngineersByIds, useJob, useJobProgress, useReceipt,
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
  /** Customer of the receipt (lookup). undefined while loading / not found. */
  customer: CustomerLookupRow | undefined;
  customerLoading: boolean;
  /** Assembly of the unit's equipment group (lookup). */
  assembly: AssemblyLookupRow | undefined;
  /** Current engineer's name (lookup, else progress history). null if unassigned or unknown. */
  engineerName: string | null;
};

/** Tab screens call this to get the loaded job (only valid under <JobWorkspace>). */
export const useJobWorkspace = () => useOutletContext<JobWorkspaceContext>();

function Tabs({ jobId }: { jobId: string }) {
  return (
    <TabBar label="Job sections">
      {JOB_TABS.map((t) => <TabLink key={t.path} to={`/p/jobs/${jobId}/${t.path}`} label={t.label} />)}
    </TabBar>
  );
}

export function JobWorkspace() {
  const { jobId = '' } = useParams();
  const jobQ = useJob(jobId);
  const receiptQ = useReceipt(jobQ.data?.inward_id);
  const progressQ = useJobProgress(jobQ.data ? jobId : undefined);
  const receipt = receiptQ.data;
  const unit = receipt?.equipment_units.find((u) => u.id === jobQ.data?.unit_id);
  const group = unit ? receipt?.equipment_groups.find((g) => g.id === unit.group_id) : undefined;
  const engineerId = jobQ.data?.current_assignment?.engineer_id;
  const customersQ = useCustomersByIds([receipt?.customer_id]);
  const assembliesQ = useAssembliesByIds([group?.assembly_id]);
  const engineersQ = useEngineersByIds([engineerId]);

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
                action={<ButtonLink to="/p/jobs" kind="secondary">Back to jobs</ButtonLink>}
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
  const customer = receipt ? customersQ.data?.[receipt.customer_id] : undefined;
  const assembly = group ? assembliesQ.data?.[group.assembly_id] : undefined;
  const engineerName = engineerId
    ? engineersQ.data?.[engineerId]?.full_name
      ?? progressQ.data?.assignments.find((x) => x.is_current)?.engineer_name
      ?? null
    : null;
  const unitsInGroup = receipt && unit ? receipt.equipment_units.filter((u) => u.group_id === unit.group_id).length : 0;
  const ctx: JobWorkspaceContext = {
    job, receipt, unit, unitsInGroup, customer, customerLoading: !!receipt && customersQ.isPending, assembly, engineerName,
  };
  const meta = [assembly?.assembly_name, unit?.observed_model, customer?.customer_name].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        title={job.job_number}
        meta={meta}
        team={engineerId && engineerName ? [{ name: engineerName, seed: engineerId }] : undefined}
      />
      <PageContent>
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
