// E1 · My jobs (Figma 15:9 success · 15:97 loading · 15:131 empty · 15:165 error).
//
// G1 — there is NO "my jobs" list endpoint. The list is built from what the API does expose:
//   (a) GET /material-requests rows where responsible_engineer_id = me (server data), plus
//   (b) jobs opened on this device (Purchase shares the job link), plus a manual "open job" box.
// Each candidate is then read with GET /jobs/{id} and kept only if I am the CURRENT assignee.
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { IconBriefcase, IconExternalLink } from '@tabler/icons-react';
import { api } from '../../api/endpoints';
import { apiStatus } from '../../api/http';
import type { JobDetail } from '../../api/types';
import { useMe } from '../../auth/AuthProvider';
import { recentJobs } from '../../lib/storage';
import { Button, cx, EmptyState, ErrorState, GapNote, LoadingList, PriorityFlag, StatusBadge } from '../../ui/primitives';
import { JobCardMobile, MobilePage } from '../../ui/mobile';
import { UserMenuMobile } from '../../layout/UserMenu';
import { equipmentLabel, isMine, qk, useJobContext } from './data';

const PRIORITY_RANK = { CRITICAL: 0, URGENT: 1, NORMAL: 2 } as const;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Figma chips are All / Inspection / Repair / On hold. JobDetail.status has no repair value
// (BR-07 never changes service_jobs.status), so "Repair" can't be filtered from the API — omitted.
type Filter = 'ALL' | 'INSPECTION' | 'ON_HOLD';
const FILTERS: { key: Filter; label: string; match: (j: JobDetail) => boolean }[] = [
  { key: 'ALL', label: 'All', match: () => true },
  { key: 'INSPECTION', label: 'Inspection', match: (j) => j.status === 'INSPECTION' },
  { key: 'ON_HOLD', label: 'On hold', match: (j) => j.status === 'ON_HOLD' },
];

export function MyJobsPage() {
  const me = useMe();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [manual, setManual] = useState('');
  const [manualErr, setManualErr] = useState<string | null>(null);

  const mrs = useQuery({ queryKey: qk.mrs, queryFn: api.materialRequests });
  const candidateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of mrs.data ?? []) if (r.responsible_engineer_id === me.id) ids.add(r.job_id);
    for (const r of recentJobs.list(me.id)) ids.add(r.id);
    return [...ids];
  }, [mrs.data, me.id]);

  const jobs = useQueries({
    queries: candidateIds.map((id) => ({ queryKey: qk.job(id), queryFn: () => api.job(id), enabled: !mrs.isPending })),
  });

  const loading = mrs.isPending || jobs.some((q) => q.isPending && q.fetchStatus !== 'idle');
  // A 404/403 for a remembered job just means it's gone or not ours any more — not a page error.
  const hardError = mrs.error ?? jobs.find((q) => q.error && ![403, 404].includes(apiStatus(q.error) ?? 0))?.error;

  const mine = jobs
    .map((q) => q.data)
    .filter((j): j is JobDetail => !!j && isMine(j, me.id) && j.status !== 'CLOSED' && j.status !== 'CANCELLED')
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.created_at.localeCompare(a.created_at));
  const shown = mine.filter(FILTERS.find((f) => f.key === filter)!.match);

  function openManual(e: FormEvent) {
    e.preventDefault();
    const id = UUID.exec(manual)?.[0];
    if (!id) { setManualErr('Paste the job link or job ID Purchase sent you.'); return; }
    setManualErr(null);
    navigate(`/jobs/${id.toLowerCase()}`);
  }

  const retry = () => { void mrs.refetch(); jobs.forEach((q) => q.error && void q.refetch()); };

  return (
    <MobilePage title="My jobs" trailing={<UserMenuMobile />}>
      {hardError ? (
        <ErrorState title="Couldn't load your jobs" onRetry={retry} />
      ) : loading ? (
        <LoadingList />
      ) : (
        <>
          {mine.length > 0 && (
            <>
              <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filter jobs">
                {FILTERS.map((f) => {
                  const n = mine.filter(f.match).length;
                  const on = f.key === filter;
                  return (
                    <button
                      key={f.key}
                      role="tab"
                      aria-selected={on}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      className={cx('h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium',
                        on ? 'border-inverse bg-inverse text-fg-inverse' : 'border-line bg-surface text-fg hover:border-line-strong')}
                    >
                      {f.key === 'ALL' ? `All · ${n}` : f.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm leading-5 text-fg-2">Sorted: Critical → Urgent → Normal, then newest</p>
            </>
          )}

          {mine.length === 0 ? (
            <EmptyState icon={<IconBriefcase size={28} />} title="No jobs assigned to you">
              When Purchase assigns you a unit, open the job link they send you. Jobs you've opened appear here.
            </EmptyState>
          ) : shown.length === 0 ? (
            <p className="py-6 text-center text-base text-fg-2">No jobs in this filter.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((j) => <li key={j.id}><JobRow job={j} /></li>)}
            </ul>
          )}

          <form onSubmit={openManual} className="mt-2 flex flex-col gap-2 rounded-[10px] border border-line bg-surface p-4">
            <label htmlFor="open-job" className="text-base font-medium leading-6">Open a job</label>
            <div className="flex gap-2">
              <input
                id="open-job"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Paste job link or ID"
                className="h-12 min-w-0 flex-1 rounded-xl border border-line-strong px-3 text-base focus:border-line-focus focus:outline-none"
              />
              <Button type="submit" kind="secondary" icon={<IconExternalLink size={20} />}>Open</Button>
            </div>
            {manualErr && <p className="text-sm text-st-blocked-fg">{manualErr}</p>}
          </form>
          <GapNote code="G1">No “my jobs” endpoint: this list = your material requests + jobs opened on this device. A job assigned to you that you haven't opened yet won't show until you open its link.</GapNote>
        </>
      )}
    </MobilePage>
  );
}

function JobRow({ job }: { job: JobDetail }) {
  const { inward, unit, assembly, unitsInGroup } = useJobContext(job.id);
  return (
    <JobCardMobile
      to={`/jobs/${job.id}`}
      jobNumber={job.job_number}
      priority={<PriorityFlag priority={job.priority} />}
      equipment={inward.isPending ? '…' : equipmentLabel(assembly, unit)}
      parent={inward.data && unit ? `From ${inward.data.jin_number} · unit ${unit.unit_number} of ${unitsInGroup}` : ' '}
      status={<StatusBadge domain="job" value={job.status} />}
    />
  );
}
