// Engineer mobile components from Figma: App bar / Mobile (5:293), Job step tracker (14:84),
// Session timer (6:568), Photo capture (6:499), Gated action (5:409), Job card / Mobile (7:481).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconArrowLeft, IconCamera, IconCheck, IconChevronRight, IconLock, IconPhoto, IconPlayerPause,
  IconPlayerPlay, IconPlayerStop,
} from '@tabler/icons-react';
import { useAuth } from '../auth/AuthProvider';
import { formatDuration } from '../lib/format';
import { Button, cx } from './primitives';

// ---------------------------------------------------------------- App bar
export function AppBarMobile({ title, back, trailing }: { title: string; back?: string | true; trailing?: ReactNode }) {
  const navigate = useNavigate();
  const { companyCode } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-1 bg-inverse pl-2 pr-3 text-fg-inverse">
      {back ? (
        <button
          type="button"
          aria-label="Back"
          onClick={() => (back === true ? navigate(-1) : navigate(back))}
          className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-inverse-raised"
        >
          <IconArrowLeft size={24} stroke={2} />
        </button>
      ) : <span className="w-2" />}
      <h1 className="min-w-0 flex-1 truncate text-xl font-semibold leading-[26px]">{title}</h1>
      {/* G6: company comes from the JWT — read-only indicator. */}
      <span className="rounded bg-company-accent px-2 py-1 font-mono text-[13px] font-medium leading-[18px]" title="Company (from your login)">
        {companyCode ?? '…'}
      </span>
      {trailing}
    </header>
  );
}

// ---------------------------------------------------------------- Step tracker
export type Step = { key: string; label: string; to?: string };
/** Done = green bar + check, current = brand red bar + medium label, upcoming = grey. */
export function StepTracker({ steps, current, done }: { steps: Step[]; current: string; done: Set<string> }) {
  return (
    <nav aria-label="Progress" className="flex gap-1">
      {steps.map((s) => {
        const isDone = done.has(s.key) && s.key !== current;
        const isCur = s.key === current;
        const body = (
          <>
            <span className={cx('h-1 w-full rounded-sm', isDone ? 'bg-success' : isCur ? 'bg-accent' : 'bg-disabled')} />
            <span className={cx('flex items-center gap-1 whitespace-nowrap',
              isCur ? 'text-base font-medium leading-6 text-fg' : isDone ? 'text-sm leading-5 text-st-success-fg' : 'text-sm leading-5 text-fg-muted')}>
              {isDone && <IconCheck size={14} stroke={2.5} />}{s.label}
            </span>
          </>
        );
        return s.to && !isCur ? (
          <Link key={s.key} to={s.to} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-label={`${s.label}${isDone ? ' (done)' : ''}`}>{body}</Link>
        ) : (
          <div key={s.key} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={isCur ? 'step' : undefined}>{body}</div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------- Session timer
export type TimerState = 'idle' | 'running' | 'paused' | 'stopped';
type TimerProps = {
  session: string;
  state: TimerState;
  /** active seconds as of `asOf` (from GET …-sessions time totals) */
  activeSeconds: number;
  pausedSeconds: number;
  asOf: number;
  pauseReason?: string | null;
  stoppedAt?: string | null;
  busy?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
};
export function SessionTimer(p: TimerProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (p.state !== 'running' && p.state !== 'paused') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [p.state]);
  const drift = Math.max(0, Math.floor((now - p.asOf) / 1000));
  const active = p.activeSeconds + (p.state === 'running' ? drift : 0);
  const paused = p.pausedSeconds + (p.state === 'paused' ? drift : 0);
  const pill = {
    idle: ['bg-inverse-raised text-fg-inverse-muted', 'NOT STARTED'],
    running: ['bg-success text-white', 'RUNNING'],
    paused: ['bg-warn-fill text-fg', 'PAUSED'],
    stopped: ['bg-inverse-raised text-fg-inverse-muted', 'STOPPED'],
  }[p.state];

  return (
    <section className="flex flex-col gap-4 rounded-[10px] bg-inverse p-5 text-fg-inverse" aria-label={`${p.session} timer`}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-base font-medium leading-6">{p.session}</h2>
        <span className={cx('flex items-center gap-1.5 rounded px-2 py-[3px] text-[11px] font-semibold leading-[14px] tracking-[0.04em]', pill[0])}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />{pill[1]}
        </span>
      </div>
      <p className={cx('font-mono text-[48px] font-semibold leading-[56px] tabular-nums', p.state === 'paused' && 'text-fg-inverse-muted')} role="timer" aria-live="off">
        {formatDuration(active)}
      </p>
      <p className="text-sm leading-5 text-fg-inverse-muted">
        {p.state === 'idle' ? 'Active time is tracked separately from paused time.'
          : p.state === 'stopped' ? `Active ${formatDuration(active)} · Paused ${formatDuration(paused)}${p.stoppedAt ? ` · Stopped ${p.stoppedAt}` : ''}`
          : `Active time · Paused ${formatDuration(paused)} total`}
      </p>
      {p.state === 'paused' && p.pauseReason && (
        <div className="flex items-center gap-2 rounded-md bg-inverse-raised px-3 py-2 text-sm leading-5">
          <IconPlayerPause size={16} className="text-warn-fill" /> Reason: {p.pauseReason}
        </div>
      )}
      <div className="flex gap-3">
        {p.state === 'idle' && p.onStart && <TimerBtn primary icon={<IconPlayerPlay size={24} />} label="Start" onClick={p.onStart} busy={p.busy} />}
        {p.state === 'running' && (
          <>
            {p.onPause && <TimerBtn primary icon={<IconPlayerPause size={24} />} label="Pause" onClick={p.onPause} busy={p.busy} />}
            {p.onStop && <TimerBtn icon={<IconPlayerStop size={24} />} label="Stop" onClick={p.onStop} busy={p.busy} />}
          </>
        )}
        {p.state === 'paused' && (
          <>
            {p.onResume && <TimerBtn primary icon={<IconPlayerPlay size={24} />} label="Resume" onClick={p.onResume} busy={p.busy} />}
            {p.onStop && <TimerBtn icon={<IconPlayerStop size={24} />} label="Stop" onClick={p.onStop} busy={p.busy} />}
          </>
        )}
        {p.state === 'stopped' && (
          <p className="flex items-center gap-2 text-sm leading-5 text-fg-inverse-muted"><IconLock size={16} /> Session recorded · read-only</p>
        )}
      </div>
    </section>
  );
}
function TimerBtn({ primary, icon, label, onClick, busy }: { primary?: boolean; icon: ReactNode; label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cx('flex h-[60px] flex-1 items-center justify-center gap-2 rounded-lg text-[17px] font-semibold leading-6 disabled:opacity-60',
        primary ? 'bg-accent text-white hover:bg-accent-hover' : 'border-2 border-line-inverse text-fg-inverse hover:bg-inverse-raised')}
    >
      {icon}{label}
    </button>
  );
}

// ---------------------------------------------------------------- Photo capture
export type Capture = { key: string; name: string; kind?: 'PHOTO' | 'VIDEO'; previewUrl?: string; state: 'uploading' | 'uploaded' | 'failed'; error?: string };
export function PhotoCapture({ title = 'Photos', captures, onFiles, locked }: {
  title?: string; captures: Capture[]; onFiles: (files: File[]) => void; locked?: boolean;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const uploaded = captures.filter((c) => c.state === 'uploaded').length;
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) onFiles(files);
  };
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-base font-medium leading-6">{title}</h2>
        <span className={cx('text-sm leading-5', uploaded ? 'text-st-success-fg' : 'text-st-blocked-fg')}>
          {uploaded ? `${uploaded} uploaded` : 'Required · at least 1'}
        </span>
      </div>
      {captures.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {captures.map((c) => (
            <li key={c.key} className={cx('relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-lg border bg-subtle',
              c.state === 'failed' ? 'border-danger' : 'border-line')} title={c.error ?? c.name}>
              {c.previewUrl ? <img src={c.previewUrl} alt={c.name} className="h-full w-full object-cover" /> : <IconPhoto size={24} className="text-fg-muted" />}
              {c.state === 'uploading' && <span className="absolute inset-0 flex items-center justify-center bg-black/40"><span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /></span>}
              {c.state === 'failed' && <span className="absolute inset-x-0 bottom-0 bg-danger px-1 text-center text-[10px] font-semibold text-white">FAILED</span>}
            </li>
          ))}
        </ul>
      )}
      {captures.some((c) => c.state === 'failed') && (
        <p className="text-sm leading-5 text-st-blocked-fg">{captures.find((c) => c.state === 'failed')?.error}</p>
      )}
      {!locked && (
        <>
          <button
            type="button"
            onClick={() => camRef.current?.click()}
            className={cx('flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-line-strong bg-subtle hover:bg-canvas',
              captures.length ? 'h-[120px]' : 'h-[200px]')}
          >
            <IconCamera size={40} stroke={1.75} />
            <span className="text-[17px] font-semibold leading-6">{captures.length ? 'Take another photo' : 'Take photo'}</span>
            <span className="text-sm leading-5 text-fg-2">Opens the camera. Or choose from gallery.</span>
          </button>
          <button type="button" onClick={() => galRef.current?.click()} className="self-start text-sm font-medium leading-5 text-brand-text underline">
            Choose from gallery
          </button>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
          <input ref={galRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={pick} />
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Gated action
/** Disabled primary ONLY for a gate this role can clear, always with a visible reason (Figma rule 2/4). */
export function GatedAction({ blockedReason, readyNote, secondary, primaryLabel, primaryIcon, onPrimary, busy }: {
  blockedReason: string | null; readyNote?: string; secondary?: ReactNode; primaryLabel: string; primaryIcon?: ReactNode;
  onPrimary: () => void; busy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {blockedReason ? (
        <div className="flex items-center gap-2 rounded-md bg-st-blocked-bg px-3 py-2.5 text-base font-medium leading-6 text-st-blocked-fg" role="status">
          <IconLock size={20} /> {blockedReason}
        </div>
      ) : readyNote ? (
        <div className="flex items-center gap-2 rounded-md bg-st-success-bg px-3 py-2.5 text-base font-medium leading-6 text-st-success-fg" role="status">
          <IconCheck size={20} /> {readyNote}
        </div>
      ) : null}
      {secondary}
      <Button block disabled={!!blockedReason} busy={busy} icon={primaryIcon} onClick={onPrimary}>{primaryLabel}</Button>
    </div>
  );
}

// ---------------------------------------------------------------- Job card
export function JobCardMobile({ to, jobNumber, priority, equipment, parent, status }: {
  to: string; jobNumber: string; priority: ReactNode; equipment: string; parent: string; status: ReactNode;
}) {
  return (
    <Link to={to} className="flex min-h-[72px] items-center gap-3 rounded-[10px] border border-line bg-surface py-3.5 pl-4 pr-3 hover:border-line-strong">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-medium leading-[18px]">{jobNumber}</span>
          {priority}
        </div>
        <p className="text-base font-medium leading-6">{equipment}</p>
        <p className="text-sm leading-5 text-fg-2">{parent}</p>
        {status}
      </div>
      <IconChevronRight size={24} className="shrink-0 text-fg-muted" />
    </Link>
  );
}

/** Mobile page frame: canvas bg, max 480px, body padding 16 with 12 gap. */
export function MobilePage({ title, back, children, actions, trailing }: {
  title: string; back?: string | true; children: ReactNode; actions?: ReactNode; trailing?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col bg-canvas">
      <AppBarMobile title={title} back={back} trailing={trailing} />
      <main className="flex flex-1 flex-col gap-3 p-4">{children}</main>
      {actions}
    </div>
  );
}
