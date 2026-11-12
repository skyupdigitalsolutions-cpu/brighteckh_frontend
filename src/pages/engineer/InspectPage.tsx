// E3 · Inspection · timer running (Figma 15:327) + E3b · Pause reason sheet (15:401).
// Sessions: POST /jobs/{id}/inspection-sessions, /inspection-sessions/{id}/pause|resume|stop.
// Totals come from GET /jobs/{id}/inspection-sessions → time_totals (view includes the open interval up to now()).
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { IconFileText, IconPlayerPause } from '@tabler/icons-react';
import { api } from '../../api/endpoints';
import type { JobDetail } from '../../api/types';
import { useMe } from '../../auth/AuthProvider';
import { formatDuration, formatTime } from '../../lib/format';
import { BottomSheet, Button, Card, cx, ErrorState, FormError, KV, SkeletonCard, TextArea, Toast } from '../../ui/primitives';
import { SessionTimer, type TimerState } from '../../ui/mobile';
import { useInspectionSessions } from './data';
import { JobFrame, useJobAction } from './JobFrame';

export function InspectPage() {
  const { jobId = '' } = useParams();
  return (
    <JobFrame
      jobId={jobId}
      title="Inspection"
      flow="br03"
      step="inspect"
      actions={(job) => job.current_assignment?.response === 'ACCEPTED' && (
        <Link to={`/jobs/${jobId}/report`} className="self-start">
          <Button kind="secondary" icon={<IconFileText size={20} />}>Open inspection report</Button>
        </Link>
      )}
    >
      {(job) => <Inspection job={job} />}
    </JobFrame>
  );
}

/** Pause categories from the Figma sheet. pause_category is free text (varchar 32) in the API. */
export const PAUSE_CATEGORIES = ['Waiting for test bench', 'Waiting for parts', 'Break', 'Other'] as const;

function Inspection({ job }: { job: JobDetail }) {
  const me = useMe();
  const loc = useLocation();
  const toast = (loc.state as { toast?: string } | null)?.toast;
  const sessions = useInspectionSessions(job.id);
  const [pauseOpen, setPauseOpen] = useState(false);
  const mine = job.current_assignment?.engineer_id === me.id;
  const accepted = mine && job.current_assignment?.response === 'ACCEPTED';

  const start = useJobAction(job.id, () => api.startInspection(job.id));
  const resume = useJobAction(job.id, (id: string) => api.resumeInspection(id));
  const stop = useJobAction(job.id, (id: string) => api.stopInspection(id));

  if (sessions.isPending) return <><SkeletonCard /><SkeletonCard /></>;
  if (sessions.error) return <ErrorState title="Couldn't load the inspection timer" onRetry={() => void sessions.refetch()} />;

  const list = sessions.data.sessions;
  const open = [...list].reverse().find((s) => s.status === 'ACTIVE' || s.status === 'PAUSED') ?? null;
  const totals = sessions.data.time_totals.find((t) => t.engineer_id === me.id);
  const state: TimerState = open?.status === 'ACTIVE' ? 'running' : open?.status === 'PAUSED' ? 'paused' : list.length ? 'stopped' : 'idle';
  const busy = start.busy || resume.busy || stop.busy;
  const errors = start.errors ?? resume.errors ?? stop.errors;

  return (
    <>
      {toast && <Toast>{toast}</Toast>}
      {!accepted && mine && (
        <p className="text-sm text-fg-2">Acknowledge custody on the job page before starting the inspection.</p>
      )}
      <SessionTimer
        session="Inspection"
        state={state}
        activeSeconds={Number(totals?.active_seconds ?? 0)}
        pausedSeconds={Number(totals?.paused_seconds ?? 0)}
        asOf={sessions.dataUpdatedAt}
        stoppedAt={state === 'stopped' ? formatTime(list[list.length - 1]?.completed_at) : null}
        busy={busy}
        // Actions are only wired for the current accepted engineer — hidden for everyone else.
        onStart={accepted && !open ? () => start.run(undefined) : undefined}
        onPause={accepted && open ? () => setPauseOpen(true) : undefined}
        onResume={accepted && open ? () => resume.run(open.id) : undefined}
        onStop={accepted && open ? () => stop.run(open.id) : undefined}
      />
      {/* A stopped session is final, but a new one can be started (the DB allows one open session at a time). */}
      {accepted && state === 'stopped' && (
        <Button kind="secondary" busy={start.busy} onClick={() => start.run(undefined)} className="self-start">Start another session</Button>
      )}
      <FormError messages={errors} />

      <Card>
        <dl className="flex flex-col gap-3">
          <KV label="Active" mono>{formatDuration(totals?.active_seconds)}</KV>
          <KV label="Paused" mono>{formatDuration(totals?.paused_seconds)}</KV>
          <KV label="Sessions">
            {list.length ? `${list.length} · first started ${formatTime(totals?.first_inspection_start ?? list[0]?.started_at)}` : 'None yet'}
          </KV>
        </dl>
      </Card>

      {open && <PauseSheet jobId={job.id} sessionId={open.id} open={pauseOpen} onClose={() => setPauseOpen(false)} pause={api.pauseInspection} />}
    </>
  );
}

/** E3b. pause_reason is required (DB rejects blank); the chosen chip is sent as pause_category. */
export function PauseSheet({ jobId, sessionId, open, onClose, pause }: {
  jobId: string; sessionId: string; open: boolean; onClose: () => void;
  pause: (id: string, b: { pause_reason: string; pause_category?: string }) => Promise<unknown>;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const act = useJobAction(jobId, () => pause(sessionId, {
    pause_reason: note.trim() || category!,
    pause_category: category ?? undefined,
  }), () => { setNote(''); setCategory(null); onClose(); });

  const needsNote = category === 'Other' && !note.trim();
  const ready = !!category && !needsNote;
  return (
    <BottomSheet open={open} onClose={onClose} title="Why are you pausing?">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pause category">
        {PAUSE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            onClick={() => setCategory(c)}
            className={cx('h-11 rounded-full border px-3.5 text-base',
              category === c ? 'border-inverse bg-inverse text-fg-inverse' : 'border-line-strong bg-surface text-fg')}
          >
            {c}
          </button>
        ))}
      </div>
      <TextArea
        label={category === 'Other' ? 'Reason' : 'Note (optional)'}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        helper={needsNote ? 'Say why you are pausing.' : 'Paused time is tracked separately from active time.'}
      />
      <FormError messages={act.errors} />
      <Button block disabled={!ready} busy={act.busy} icon={<IconPlayerPause size={20} />} onClick={() => act.run(undefined)}>Pause timer</Button>
      <Button kind="ghost" block onClick={onClose}>Keep working</Button>
    </BottomSheet>
  );
}
