// Figma "Status badge" 3:14 + "Priority flag" 3:21 (desktop and mobile share them).
// Badge: 1px tone border, radius 4, px-8 py-3, gap 6, 6px dot, 11/14 SemiBold +0.44px tracking.
// Label = exact API enum value with underscores shown as spaces; tone per domain from src/lib/tones.ts.
import { enumLabel } from '../../lib/format';
import { toneOf, type Tone, type ToneDomain } from '../../lib/tones';
import type { Priority } from '../../api/types';
import { cx } from './Icon';

const TONE_BOX: Record<Tone, string> = {
  neutral: 'bg-st-neutral-bg border-st-neutral-bd text-st-neutral-fg',
  progress: 'bg-st-progress-bg border-st-progress-bd text-st-progress-fg',
  success: 'bg-st-success-bg border-st-success-bd text-st-success-fg',
  blocked: 'bg-st-blocked-bg border-st-blocked-bd text-st-blocked-fg',
};

/** Raw badge: you pick the tone and label. Prefer <StatusPill domain value> for API enums. */
export function Badge({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-[6px] rounded-t-sm border px-[8px] py-[3px]', TONE_BOX[tone], className)}>
      <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-current" aria-hidden />
      <span className="whitespace-nowrap text-[11px] font-semibold leading-[14px] tracking-[0.44px]">{label}</span>
    </span>
  );
}

/** Status badge driven by an API enum value + tone domain (e.g. domain="receipt" value="VERIFYING"). */
export function StatusPill({ domain, value, className }: { domain: ToneDomain; value: string; className?: string }) {
  return <Badge tone={toneOf(domain, value)} label={enumLabel(value)} className={className} />;
}

/** Figma "Priority flag": NORMAL = 1px border-default + secondary text; URGENT = warning bg/border/fg; CRITICAL = danger fill, white. */
export function PriorityChip({ priority, className }: { priority: Priority; className?: string }) {
  const cls = priority === 'CRITICAL' ? 'bg-danger text-fg-inverse'
    : priority === 'URGENT' ? 'border border-warn-border bg-warn-bg text-warn-fg'
      : 'border border-line text-fg-2';
  return (
    <span className={cx('inline-flex shrink-0 items-center rounded-t-sm px-[8px] py-[3px] text-[11px] font-semibold leading-[14px] tracking-[0.44px] whitespace-nowrap', cls, className)}>
      {priority}
    </span>
  );
}
