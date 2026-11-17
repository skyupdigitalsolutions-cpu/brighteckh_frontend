// Inline two-step confirm for consequential governance writes (activate / revoke a binding or grant).
// Same strip treatment as the approval confirm (progress tone; blocked tone for destructive actions).
import { Button, cx } from '../../../ui/desktop';

export function ConfirmInline({ text, confirmLabel, onConfirm, onCancel, busy, danger }: {
  text: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean; danger?: boolean;
}) {
  return (
    <div className={cx(
      'flex w-full items-center gap-[12px] rounded-t-md border px-[16px] py-[12px]',
      danger ? 'border-st-blocked-bd bg-st-blocked-bg text-st-blocked-fg' : 'border-st-progress-bd bg-st-progress-bg text-st-progress-fg',
    )}>
      <p className="min-w-px flex-1 text-[14px] leading-[20px]">{text}</p>
      <Button kind="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
      <Button kind={danger ? 'danger' : 'primary'} busy={busy} onClick={onConfirm}>{confirmLabel}</Button>
    </div>
  );
}
