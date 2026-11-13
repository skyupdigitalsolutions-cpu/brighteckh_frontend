// Figma "J1 · Job · Reassign engineer (drawer)" 177:116204 → panel 177:116340.
// Panel: 520 wide, 12px inset, surface fill, 1px glass border, radius 28, ONE column p-28 gap-16 (header, cards,
// reason, flexible spacer, footer — no footer divider). This differs from the kit Drawer (header pb-20 + bordered
// footer), so the panel is built here with the kit's Scrim / useDismiss.
// Cards (177:116347 / 116354): radius 16, px-16 py-12, gap 12, 40px avatar; current = bg-subtle + 1px border-default
// + "CURRENT" neutral badge; selected (picker) = brand-subtle + 2px brand-border.
//
// API: POST /jobs/{id}/assign {engineer_id, reassignment_reason?} (@Roles PURCHASE). Server rules (br02.service
// assignEngineer): CANCELLED/CLOSED jobs are rejected; engineer must be an active ENGINEER of the company;
// reassignment_reason is required when the job already has a current assignment; the new assignment starts PENDING
// (engineer acknowledges custody) and the job moves to ASSIGNED. Any rejection is shown verbatim (FormErrors).
// G17: no engineer lookup → the picker slot takes the engineer's employee UUID; no names, no "n open jobs".
import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconUser, IconX } from '@tabler/icons-react';
import { useAssignEngineer, type JobAssignment } from '../api';
import { Ic, cx } from '../../../ui/desktop/Icon';
import { Badge } from '../../../ui/desktop/Badge';
import { Button } from '../../../ui/desktop/Button';
import { TextInput } from '../../../ui/desktop/Fields';
import { FormErrors, GapNote } from '../../../ui/desktop/Feedback';
import { Scrim, useDismiss } from '../../../ui/desktop/Popover';
import { useToast } from '../../../ui/desktop/Toast';
import { enumLabel, formatDayTime } from '../../../lib/format';
import { isUuid, shortId } from './jobsData';

export function ReassignDrawer({ open, onClose, jobId, jobNumber, current }: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber: string;
  /** The job's current assignment (null = first assignment). */
  current: JobAssignment | null;
}) {
  const assign = useAssignEngineer(jobId);
  const toast = useToast();
  const [engineerId, setEngineerId] = useState('');
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const titleId = useId();
  const reassigning = !!current;

  useEffect(() => {
    if (open) { setEngineerId(''); setReason(''); setTried(false); assign.reset(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const busy = assign.isPending;
  const close = () => { if (!busy) onClose(); };
  useDismiss(open, close);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;

  const id = engineerId.trim();
  const idError = !id ? 'Enter the engineer\'s employee ID.' : !isUuid(id) ? 'Must be a UUID (employee id).' : null;
  const sameAsCurrent = !!current && id.toLowerCase() === current.engineer_id.toLowerCase();
  // Mirrors the server message; the server still enforces it.
  const reasonError = reassigning && !reason.trim() ? 'reassignment_reason is required when reassigning an already-assigned job' : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (idError || reasonError) return;
    assign.mutate(
      { engineer_id: id, ...(reassigning ? { reassignment_reason: reason.trim() } : {}) },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: reassigning ? 'Engineer reassigned' : 'Engineer assigned', body: `${jobNumber} · the engineer must acknowledge custody.` });
          onClose();
        },
      },
    );
  };

  const subtitle = current
    ? `${jobNumber} · currently engineer ${shortId(current.engineer_id)}`
    : `${jobNumber} · no engineer assigned`;

  return createPortal(
    <>
      <Scrim alpha={0.55} onClick={close} />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        noValidate
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-[12px] right-[12px] top-[12px] z-50 flex w-[520px] max-w-[calc(100vw-24px)] flex-col items-start gap-[16px] overflow-clip rounded-t-card border border-glass-border bg-surface p-[28px]"
      >
        {/* Header 177:116341 */}
        <div className="flex w-full shrink-0 items-start gap-[12px] overflow-clip">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-[4px] overflow-clip">
            <h2 id={titleId} className="whitespace-nowrap text-[22px] font-semibold leading-[28px] text-fg">
              {reassigning ? 'Reassign engineer' : 'Assign engineer'}
            </h2>
            <p className="truncate text-[14px] leading-[20px] text-fg-2">{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-clip rounded-t-popover bg-subtle text-fg hover:bg-disabled"
          >
            <Ic icon={IconX} size={20} />
          </button>
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-[16px] overflow-y-auto">
          {/* Current engineer card 177:116347 */}
          {current && (
            <div className="flex w-full shrink-0 items-center gap-[12px] overflow-clip rounded-[16px] border border-line bg-subtle px-[16px] py-[12px]">
              <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-clip rounded-[20px] bg-disabled text-fg-2" aria-hidden>
                <Ic icon={IconUser} size={20} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
                <p className="font-mono text-[13px] font-medium leading-[20px] text-fg" title={current.engineer_id}>{current.engineer_id}</p>
                <p className="text-[12px] leading-[16px] text-fg-2">
                  {enumLabel(current.response)} · assigned {formatDayTime(current.assigned_at)}
                </p>
              </div>
              <Badge tone="neutral" label="CURRENT" />
            </div>
          )}

          {/* Picker slot = selected card 177:116354, holding the engineer-id input (G17). */}
          <div className="flex w-full shrink-0 items-start gap-[12px] overflow-clip rounded-[16px] border-2 border-brand-border bg-brand-subtle px-[16px] py-[12px]">
            <span className="mt-[26px] flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-clip rounded-[20px] bg-surface text-fg-2" aria-hidden>
              <Ic icon={IconUser} size={20} />
            </span>
            <TextInput
              label={reassigning ? 'New engineer — employee ID' : 'Engineer — employee ID'}
              mono
              autoFocus
              value={engineerId}
              onChange={(e) => setEngineerId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              error={tried ? idError : null}
              helper={sameAsCurrent ? 'This is the current engineer.' : undefined}
              className="min-w-0 flex-1"
            />
          </div>
          <GapNote code="G17">
            There is no engineer / employee lookup in the API, so engineers can't be listed by name or open-job count.
            Paste the engineer's employee UUID; the server checks it is an active Service Engineer in this company.
          </GapNote>

          {/* Reason 177:116372 (required only when replacing a current assignment — server rule). */}
          {reassigning && (
            <TextInput
              label="Reason for reassignment *"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={tried ? reasonError : null}
              helper="Required when replacing a current assignment. The new engineer must acknowledge custody."
            />
          )}

          <FormErrors error={assign.error} />
        </div>

        {/* Footer 177:116378 */}
        <div className={cx('flex w-full shrink-0 items-start gap-[12px] overflow-clip [&>*]:min-w-px [&>*]:flex-1')}>
          <Button kind="secondary" onClick={close}>Cancel</Button>
          <Button kind="primary" type="submit" busy={busy} icon={<Ic icon={IconCheck} size={18} />}>
            {reassigning ? 'Reassign engineer' : 'Assign engineer'}
          </Button>
        </div>
      </form>
    </>,
    document.body,
  );
}
