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
// Picker = kit LookupRadioList over engineerSource (GET /lookups/engineers: active engineers + open-job counts), with
// the current engineer removed from the list (Figma shows them only in the CURRENT card). Deviation: the kit cards
// carry a radio dot that the Figma cards don't draw.
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconX } from '@tabler/icons-react';
import { engineerSource, useAssignEngineer, useEngineersByIds, type EngineerLookupRow, type JobAssignment } from '../api';
import { Ic, cx } from '../../../ui/desktop/Icon';
import { Badge } from '../../../ui/desktop/Badge';
import { Button } from '../../../ui/desktop/Button';
import { TextInput } from '../../../ui/desktop/Fields';
import { FormErrors } from '../../../ui/desktop/Feedback';
import { Scrim, useDismiss } from '../../../ui/desktop/Popover';
import { useToast } from '../../../ui/desktop/Toast';
import { Avatar } from '../../../ui/desktop/Avatar';
import { LookupRadioList, type LookupSource } from '../../../ui/desktop/LookupPicker';
import { enumLabel, formatDayTime } from '../../../lib/format';

/** What the drawer needs of the current assignment (from GET /jobs/{id} or a GET /jobs list row). */
export type CurrentAssignment = Pick<JobAssignment, 'engineer_id' | 'response' | 'assigned_at'>;

/** engineerSource minus one engineer (the current one). */
function useSourceWithout(excludeId: string | undefined): LookupSource<EngineerLookupRow> {
  return useMemo(() => (!excludeId ? engineerSource : {
    ...engineerSource,
    useSearch: (search: string, enabled: boolean) => {
      const q = engineerSource.useSearch(search, enabled);
      const d = q.data;
      if (!d) return q;
      const rows = d.rows.filter((r) => r.id !== excludeId);
      return { ...q, data: { ...d, rows, total: d.total - (d.rows.length - rows.length) } };
    },
  }), [excludeId]);
}

export function ReassignDrawer({ open, onClose, jobId, jobNumber, current, currentName }: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber: string;
  /** The job's current assignment (null = first assignment). */
  current: CurrentAssignment | null;
  /** Current engineer's name when the caller already has it (list row / progress) — used if the lookup misses. */
  currentName?: string | null;
}) {
  const assign = useAssignEngineer(jobId);
  const toast = useToast();
  const [engineerId, setEngineerId] = useState('');
  const [picked, setPicked] = useState<EngineerLookupRow | null>(null);
  const source = useSourceWithout(current?.engineer_id);
  const currentQ = useEngineersByIds(open && current ? [current.engineer_id] : []);
  const curRow = current ? currentQ.data?.[current.engineer_id] : undefined;
  const curName = curRow?.full_name ?? currentName ?? null;
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const titleId = useId();
  const reassigning = !!current;

  useEffect(() => {
    if (open) { setEngineerId(''); setPicked(null); setReason(''); setTried(false); assign.reset(); }
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

  const id = engineerId;
  const idError = !id ? 'Choose an engineer.' : null;
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
          const who = picked?.full_name ?? 'The engineer';
          toast({ tone: 'success', title: reassigning ? `Reassigned to ${who}` : `Assigned to ${who}`, body: `${jobNumber} · ${who} must acknowledge custody.` });
          onClose();
        },
      },
    );
  };

  const subtitle = current
    ? `${jobNumber} · currently ${curName ?? (currentQ.isPending ? '…' : 'an engineer not in the active list')}`
    : `${jobNumber} · no engineer assigned`;
  const verb = reassigning ? 'Reassign' : 'Assign';
  const submitLabel = picked ? `${verb} to ${picked.full_name}` : `${verb} engineer`;

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
              {curName
                ? <Avatar name={curName} seed={current.engineer_id} size={40} className="!text-fg" />
                : <span className="h-[40px] w-[40px] shrink-0 rounded-full bg-disabled" aria-hidden />}
              <div className="flex min-w-0 flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
                <p className="text-[14px] font-medium leading-[20px] text-fg">{curName ?? (currentQ.isPending ? 'Loading…' : 'Engineer not in the active list')}</p>
                <p className="text-[12px] leading-[16px] text-fg-2">
                  {curRow ? engineerSource.getSub!(curRow) : `${enumLabel(current.response)} · assigned ${formatDayTime(current.assigned_at)}`}
                </p>
              </div>
              <Badge tone="neutral" label="CURRENT" />
            </div>
          )}

          {/* Engineer cards 177:116354 / 116360 / 116366 */}
          <LookupRadioList
            value={engineerId || null}
            onChange={(eid, row) => { setEngineerId(eid); setPicked(row); }}
            source={source}
            searchPlaceholder="Search engineers"
            emptyText={current ? 'No other active engineers in this company.' : 'No active engineers in this company.'}
            error={tried ? idError : null}
          />

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
            {submitLabel}
          </Button>
        </div>
      </form>
    </>,
    document.body,
  );
}
