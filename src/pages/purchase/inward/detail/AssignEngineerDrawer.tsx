// Figma "D·P2b · JIN detail · assign engineer" 177:103201 → kit Drawer variant="side" 177:103290 (480 wide).
// Body: success Inline alert "Unit verified · Job … created" (only right after verify) · "Choose an engineer"
// (Desktop/H3) · engineer option cards = kit LookupRadioList over engineerSource (GET /lookups/engineers: active
// ENGINEERs; sub-line "n open jobs · n awaiting custody").
// Footer (flex-col gap 12, buttons hug): primary "Assign to <name>" with check icon + ghost "Assign later".
// POST /jobs/{id}/assign { engineer_id, reassignment_reason? } → assignment row, response PENDING until the
// engineer acknowledges custody (spec note 37:1424).
// The reassignment reason field appears when the job already has a current assignment; whether it is required is
// enforced by the DB.
import { useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { Button, Drawer, FormErrors, Ic, InlineAlert, LookupRadioList, TextInput } from '../../../../ui/desktop';
import { engineerSource, useAssignEngineer, useEngineersByIds, useJob, type EngineerLookupRow } from '../../api';
import { shortId } from './local';

export function AssignEngineerDrawer({ open, onClose, jobId, jobNumber, unitText, created, onAssigned }: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber: string;
  /** "unit 3 of JIN-BLR-000061" */
  unitText: string;
  /** Present right after verify: "3 of 3 units on JIN-… now have Job IDs." */
  created?: { verified: number; total: number; jin: string };
  onAssigned?: (engineerName: string) => void;
}) {
  const [engineer, setEngineer] = useState<EngineerLookupRow | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const job = useJob(jobId);
  const assign = useAssignEngineer(jobId);
  const current = job.data?.current_assignment ?? null;
  const currentEng = useEngineersByIds([current?.engineer_id]);
  const currentName = current ? currentEng.data?.[current.engineer_id]?.full_name : undefined;
  const err = !engineer ? 'Choose an engineer' : null;

  const reset = () => { assign.reset(); setEngineer(null); setReason(''); setTouched(false); };
  const close = () => { reset(); onClose(); };
  const submit = () => {
    setTouched(true);
    if (!engineer) return;
    const name = engineer.full_name;
    assign.mutate(
      { engineer_id: engineer.id, ...(reason.trim() ? { reassignment_reason: reason.trim() } : {}) },
      { onSuccess: () => { reset(); onAssigned?.(name); onClose(); } },
    );
  };

  return (
    <Drawer
      variant="side"
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
            {engineer ? `Assign to ${engineer.full_name}` : 'Assign engineer'}
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
          {currentName ?? <span className="font-mono">{shortId(current.engineer_id)}</span>} holds this job. A new assignment replaces it.
        </InlineAlert>
      )}
      <LookupRadioList
        title="Choose an engineer"
        value={engineer?.id ?? null}
        onChange={(_id, row) => setEngineer(row)}
        source={engineerSource}
        searchPlaceholder="Search engineers"
        emptyText="No active engineers in this company."
        error={touched ? err : null}
      />
      {current && (
        <TextInput label="Reassignment reason" placeholder="Why the job moves to another engineer" value={reason} onChange={(e) => setReason(e.target.value)} />
      )}
    </Drawer>
  );
}
