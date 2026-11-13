// Figma "D·P2b · JIN detail · assign engineer" 177:103201 → SideDrawer 177:103290 (480 wide).
// Body: success Inline alert "Unit verified · Job … created" (only right after verify) · "Choose an engineer"
// (Desktop/H3) · engineer option cards (px-16 py-12, radius 16, gap 12; selected = brand-subtle + 2px brand-border,
// other = surface + 1px border-default; 40px subtle avatar; name 14/20 Medium + 12/16 secondary; 22px radio).
// Footer (flex-col gap 12, buttons hug): primary "Assign to …" with check icon + ghost "Assign later".
// POST /jobs/{id}/assign { engineer_id, reassignment_reason? } → assignment row, response PENDING until the
// engineer acknowledges custody (spec note 37:1424).
// G17: no engineer / employee lookup → the option card keeps its designed slot and takes the engineer's employee
// ID (UUID). The reassignment reason field appears when the job already has a current assignment; whether it is
// required is enforced by the DB.
import { useState } from 'react';
import { IconCheck, IconUser } from '@tabler/icons-react';
import { Button, cx, FormErrors, GapNote, Ic, InlineAlert, TextInput } from '../../../../ui/desktop';
import { useAssignEngineer, useJob } from '../../api';
import radioOn from '../../../../assets/figma/inward-detail/radio-on.svg';
import radioOff from '../../../../assets/figma/inward-detail/radio-off.svg';
import { isUuid, shortId, SideDrawer } from './local';

export function AssignEngineerDrawer({ open, onClose, jobId, jobNumber, unitText, created, onAssigned }: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber: string;
  /** "unit 3 of JIN-BLR-000061" */
  unitText: string;
  /** Present right after verify: "3 of 3 units on JIN-… now have Job IDs." */
  created?: { verified: number; total: number; jin: string };
  onAssigned?: () => void;
}) {
  const [engineer, setEngineer] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const job = useJob(jobId);
  const assign = useAssignEngineer(jobId);
  const current = job.data?.current_assignment ?? null;
  const valid = isUuid(engineer);
  const err = !engineer.trim() ? "Enter the engineer's employee ID" : !valid ? 'Employee ID is a UUID' : null;

  const close = () => { assign.reset(); setEngineer(''); setReason(''); setTouched(false); onClose(); };
  const submit = () => {
    setTouched(true);
    if (err) return;
    assign.mutate(
      { engineer_id: engineer.trim(), ...(reason.trim() ? { reassignment_reason: reason.trim() } : {}) },
      { onSuccess: () => { setEngineer(''); setReason(''); setTouched(false); onAssigned?.(); onClose(); } },
    );
  };

  return (
    <SideDrawer
      open={open}
      onClose={close}
      busy={assign.isPending}
      title="Assign engineer"
      subtitle={`${jobNumber} · ${unitText}`}
      onSubmit={submit}
      footer={
        <div className="flex w-full flex-col items-start gap-[12px]">
          <FormErrors error={assign.error} />
          <Button kind="primary" type="submit" busy={assign.isPending} icon={<Ic icon={IconCheck} size={18} />}>
            {valid ? `Assign to ${shortId(engineer.trim())}` : 'Assign engineer'}
          </Button>
          <Button kind="ghost" onClick={close} disabled={assign.isPending}>Assign later</Button>
        </div>
      }
    >
      {created && (
        <InlineAlert tone="success" title={`Unit verified · Job ${jobNumber} created`}>
          {created.verified} of {created.total} units on {created.jin} now have Job IDs. Assign an engineer to start inspection.
        </InlineAlert>
      )}
      {current && (
        <InlineAlert tone="neutral" title={`Currently assigned · ${current.response}`}>
          Engineer <span className="font-mono">{shortId(current.engineer_id)}</span> holds this job. A new assignment replaces it.
        </InlineAlert>
      )}
      <p className="whitespace-nowrap text-[15px] font-semibold leading-[20px] text-fg">Choose an engineer</p>
      <label
        className={cx(
          'flex w-full cursor-text items-center gap-[12px] overflow-clip rounded-[16px] px-[16px] py-[12px]',
          valid ? 'border-2 border-brand-border bg-brand-subtle' : 'border border-line bg-surface',
          touched && err && 'ring-inside-danger',
        )}
      >
        <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-clip rounded-[20px] bg-subtle text-fg-2">
          <Ic icon={IconUser} size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-start overflow-clip">
          <input
            autoFocus
            aria-label="Engineer employee ID"
            placeholder="Engineer employee ID (UUID)"
            value={engineer}
            onChange={(e) => setEngineer(e.target.value)}
            className="w-full bg-transparent font-mono text-[13px] font-medium leading-[20px] text-fg placeholder:font-sans placeholder:text-[14px] placeholder:font-medium placeholder:text-fg-muted focus:outline-none"
          />
          <span className={cx('text-[12px] leading-[16px]', touched && err ? 'text-st-blocked-fg' : 'text-fg-2')}>
            {touched && err ? err : 'Role ENGINEER, same company'}
          </span>
        </span>
        <img src={valid ? radioOn : radioOff} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0" />
      </label>
      <GapNote code="G17">No engineer list or open-job counts in the API — enter the engineer's employee ID.</GapNote>
      {current && (
        <TextInput label="Reassignment reason" placeholder="Why the job moves to another engineer" value={reason} onChange={(e) => setReason(e.target.value)} />
      )}
    </SideDrawer>
  );
}
