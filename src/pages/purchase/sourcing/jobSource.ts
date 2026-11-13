// Job picker source (LookupPicker) over GET /jobs — used by the "New RFQ" and "New quote" drawers to pick a job by
// number / JIN / customer / serial / assembly instead of a pasted UUID. Kept local: the shared picker sources in
// ../api.ts have no job source (reported to the coordinator).
// Label = job number; sub = customer · assembly · status. A pre-set id (never used by these drawers today) resolves
// through GET /jobs/{id}, which carries no customer, so its sub-line is the status only.
import { useQuery } from '@tanstack/react-query';
import { enumLabel } from '../../../lib/format';
import type { LookupSource } from '../../../ui/desktop/LookupPicker';
import { purchaseApi, useJobsList, type JobListRow } from '../api';

export type JobPick = Pick<JobListRow, 'id' | 'job_number' | 'status'> & Partial<Pick<JobListRow, 'customer_name' | 'assembly_name'>>;

export const jobSource: LookupSource<JobPick> = {
  useSearch: (search, enabled) => useJobsList({ ...(search ? { search } : {}), page_size: 25 }, enabled),
  useResolve: (ids) => useQuery({
    queryKey: ['purchase', 'job-pick-resolve', ids],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const out: Record<string, JobPick> = {};
      for (const j of await Promise.all(ids.map((id) => purchaseApi.job(id)))) out[j.id] = { id: j.id, job_number: j.job_number, status: j.status };
      return out;
    },
  }),
  getId: (r) => r.id,
  getLabel: (r) => r.job_number,
  getSub: (r) => [r.customer_name, r.assembly_name, enumLabel(r.status)].filter(Boolean).join(' · '),
  noun: 'jobs',
};
