// Shared frame for every engineer job screen: loads GET /jobs/{id}, renders the app bar + step tracker,
// and owns the loading / error / not-yours states so each page only renders its success state.
import { useEffect, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { IconLock } from '@tabler/icons-react';
import { apiErrorMessages, apiStatus } from '../../api/http';
import type { JobDetail } from '../../api/types';
import { useMe } from '../../auth/AuthProvider';
import { recentJobs } from '../../lib/storage';
import { ErrorState, InlineAlert, LoadingList } from '../../ui/primitives';
import { MobilePage, StepTracker } from '../../ui/mobile';
import { BR03_STEPS, BR07_STEPS, isMine, useBr03Done, useBr07Done, useInvalidateJob, useJob } from './data';

type Flow = 'br03' | 'br07';

export function JobFrame({ jobId, title, flow, step, children, actions }: {
  jobId: string;
  /** Screen name after the job number, e.g. "Inspection". Omit on the job overview. */
  title?: string;
  flow: Flow;
  step: string;
  children: (job: JobDetail) => ReactNode;
  /** Sticky action bar; only rendered when the job is assigned to the signed-in engineer. */
  actions?: (job: JobDetail) => ReactNode;
}) {
  const me = useMe();
  const job = useJob(jobId);
  const mine = isMine(job.data, me.id);

  useEffect(() => { if (mine) recentJobs.add(me.id, jobId); }, [mine, me.id, jobId]);

  const pageTitle = job.data ? (title ? `${job.data.job_number} · ${title}` : job.data.job_number) : (title ?? 'Job');
  const back = step === 'overview' ? '/jobs' : `/jobs/${jobId}`;

  if (job.isPending) {
    return <MobilePage title={pageTitle} back={back}><LoadingList count={3} /></MobilePage>;
  }
  if (job.error) {
    const s = apiStatus(job.error);
    return (
      <MobilePage title={pageTitle} back={back}>
        <ErrorState
          title={s === 404 ? 'Job not found' : s === 403 ? 'Not your company' : "Couldn't load this job"}
          message={s === 404 || s === 403 ? 'Check the link Purchase sent you.' : undefined}
          onRetry={s === 404 || s === 403 ? undefined : () => void job.refetch()}
        />
      </MobilePage>
    );
  }

  return (
    <MobilePage title={pageTitle} back={back} actions={mine && actions ? <ActionSlot>{actions(job.data)}</ActionSlot> : undefined}>
      <Tracker jobId={jobId} flow={flow} step={step} />
      {!mine && (
        <InlineAlert tone="blocked" title="Not assigned to you" icon={<IconLock size={20} />}>
          {job.data.current_assignment
            ? 'This job is assigned to another engineer. You can read it, but you can’t act on it.'
            : 'This job has no engineer assigned yet.'}
        </InlineAlert>
      )}
      {children(job.data)}
    </MobilePage>
  );
}

function ActionSlot({ children }: { children: ReactNode }) {
  if (children == null || children === false) return null;
  return (
    <div className="sticky bottom-0 z-10 border-t border-line bg-surface px-4 pb-7 pt-3">
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Tracker({ jobId, flow, step }: { jobId: string; flow: Flow; step: string }) {
  return flow === 'br03' ? <Br03Tracker jobId={jobId} step={step} /> : <Br07Tracker jobId={jobId} step={step} />;
}
function Br03Tracker({ jobId, step }: { jobId: string; step: string }) {
  const done = useBr03Done(jobId);
  return <StepTracker steps={BR03_STEPS(jobId)} current={step === 'overview' ? 'custody' : step} done={done} />;
}
function Br07Tracker({ jobId, step }: { jobId: string; step: string }) {
  const done = useBr07Done(jobId);
  return <StepTracker steps={BR07_STEPS(jobId)} current={step} done={done} />;
}

/**
 * Mutation that surfaces the server's own message (DB trigger text arrives verbatim) and re-reads
 * every query of the job afterwards, so screens always show server truth.
 */
export function useJobAction<TVars, TRes>(jobId: string, fn: (v: TVars) => Promise<TRes>, onDone?: (r: TRes) => void) {
  const invalidate = useInvalidateJob(jobId);
  const [errors, setErrors] = useState<string[] | null>(null);
  const m = useMutation({
    mutationFn: fn,
    onMutate: () => setErrors(null),
    onError: (e) => setErrors(apiErrorMessages(e)),
    onSuccess: async (r) => { await invalidate(); onDone?.(r); },
  });
  return { run: m.mutate, runAsync: m.mutateAsync, busy: m.isPending, errors, clearErrors: () => setErrors(null) };
}
