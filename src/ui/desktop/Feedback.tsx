// Feedback pieces.
// - InlineAlert (Figma "Inline alert" 5:332): 1px tone border, tone bg, radius 6, px-16 py-12, gap 12, 20px icon,
//   title 14/20 Medium + body 14/20 Regular in the tone fg. Copy: what happened + what to do.
// - FormErrors: the API {message: string | string[]} rendered as a blocked InlineAlert.
// - GapNote (desktop): marks an API gap on the screen it affects. No Figma component exists for it — same
//   dashed-warning treatment as the engineer GapNote, desktop type sizes (12/16 mono code + 14/20 text).
// - GatedAction (Figma "Gated action" 5:409, Platform=Desktop 5:333 / 5:353): reason strip (radius 6, px-12
//   py-10, gap 8, 16px icon, 14/20 Medium) + action row (gap 8, both buttons flex-1).
//   Blocked: blocked-bg strip with lock + reason, secondary camera button, DISABLED primary.
//   Ready:   success-bg strip with check + "n photos attached", ghost camera button, enabled primary.
import type { ReactNode } from 'react';
import { IconCamera, IconCheck, IconInfoCircle, IconLock, IconAlertTriangle } from '@tabler/icons-react';
import type { Tone } from '../../lib/tones';
import { apiErrorMessages } from '../../api/http';
import { cx, Ic, type TablerIcon } from './Icon';
import { Button } from './Button';

const ALERT_BOX: Record<Tone, string> = {
  neutral: 'bg-st-neutral-bg border-st-neutral-bd text-st-neutral-fg',
  progress: 'bg-st-progress-bg border-st-progress-bd text-st-progress-fg',
  success: 'bg-st-success-bg border-st-success-bd text-st-success-fg',
  blocked: 'bg-st-blocked-bg border-st-blocked-bd text-st-blocked-fg',
};
const ALERT_ICON: Record<Tone, TablerIcon> = { neutral: IconInfoCircle, progress: IconInfoCircle, success: IconCheck, blocked: IconAlertTriangle };

export function InlineAlert({ tone, title, children, icon, className }: { tone: Tone; title: ReactNode; children?: ReactNode; icon?: TablerIcon; className?: string }) {
  return (
    <div role={tone === 'blocked' ? 'alert' : 'status'} className={cx('flex w-full items-start gap-[12px] rounded-t-md border px-[16px] py-[12px]', ALERT_BOX[tone], className)}>
      <Ic icon={icon ?? ALERT_ICON[tone]} size={20} />
      <div className="flex min-w-0 flex-1 flex-col gap-[2px] text-[14px] leading-[20px]">
        <p className="font-medium">{title}</p>
        {children && <div className="font-normal">{children}</div>}
      </div>
    </div>
  );
}

/** Server rejection (DB trigger text / validation messages) under a form. Renders nothing when `error` is falsy. */
export function FormErrors({ error, title = 'The server rejected this' }: { error: unknown; title?: string }) {
  if (!error) return null;
  const msgs = apiErrorMessages(error);
  return (
    <InlineAlert tone="blocked" title={title}>
      {msgs.length === 1 ? msgs[0] : <ul className="list-disc pl-[16px]">{msgs.map((m, i) => <li key={i}>{m}</li>)}</ul>}
    </InlineAlert>
  );
}

export function GapNote({ code, children, className }: { code: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex w-full items-start gap-[8px] rounded-t-md border border-dashed border-warn-border bg-warn-bg px-[12px] py-[10px] text-warn-fg', className)}>
      <span className="shrink-0 font-mono text-[12px] font-medium leading-[20px]">{code}</span>
      <span className="min-w-0 text-[14px] leading-[20px]">{children}</span>
    </div>
  );
}

export function GatedAction({ ready, reason, readyNote, primaryLabel, onPrimary, busy, secondaryLabel, secondaryIcon = IconCamera, onSecondary, className }: {
  /** false = blocked (primary disabled + reason shown). */
  ready: boolean;
  /** Blocked reason, e.g. "Add a photo to continue". */
  reason: ReactNode;
  /** Ready note, e.g. "2 photos attached". */
  readyNote: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  busy?: boolean;
  /** The control that clears the gate (camera / add photo). Blocked label e.g. "Take photo", ready e.g. "Add another photo". */
  secondaryLabel?: string;
  secondaryIcon?: TablerIcon;
  onSecondary?: () => void;
  className?: string;
}) {
  return (
    <div className={cx('flex w-full flex-col items-start gap-[12px]', className)}>
      <div className={cx('flex w-full items-center gap-[8px] overflow-clip rounded-t-md px-[12px] py-[10px]', ready ? 'bg-st-success-bg text-st-success-fg' : 'bg-st-blocked-bg text-st-blocked-fg')}>
        <Ic icon={ready ? IconCheck : IconLock} size={16} />
        <p className="text-[14px] font-medium leading-[20px]">{ready ? readyNote : reason}</p>
      </div>
      <div className="flex w-full items-start justify-end gap-[8px] [&>*]:min-w-px [&>*]:flex-1">
        {secondaryLabel && onSecondary && (
          <Button kind={ready ? 'ghost' : 'secondary'} icon={<Ic icon={secondaryIcon} size={18} />} onClick={onSecondary}>{secondaryLabel}</Button>
        )}
        <Button kind="primary" disabled={!ready} busy={busy} onClick={onPrimary}>{primaryLabel}</Button>
      </div>
    </div>
  );
}
