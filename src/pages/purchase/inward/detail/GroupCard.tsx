// One equipment group on the JIN detail page.
// Card (177:108645 / 177:108699): glass-strong, 1px glass border, radius 28, p-20, gap 16, glass shadow.
// Head: "Group n · <assembly>" Desktop/H2 18/24 + 14/20 secondary sub-line (gap 2).
// Not expanded (177:108610): progress Inline alert "Expand to create unit records" · Store location* + Custodian*
// pair (gap 14) · right-aligned primary "Expand into n units" (stack icon).
//   POST /equipment-groups/{id}/expand { location_id, custodian_id }. G18: no custody-location lookup → UUID.
//   Custodian defaults to the signed-in user (/auth/me id); no employee lookup (G17) to pick someone else by name.
// Expanded (177:108664 / 177:103148): fan-out connector (2px border-strong lines, 36 high: trunk at x 24, bar at
// y 18, a drop to the centre of each unit column; 8px dot on the trunk top in the frames that have verified units)
// then unit cards (gap 16, radius 20, p-16, gap 12):
//   PENDING  = brand-subtle fill + 2px dashed brand-border; job slot py-10 = primary "Verify unit" (camera), block.
//   VERIFIED = surface + 1px border-default; job slot = subtle fill, radius 14, px-12 py-10, gap 10: tool icon,
//              job_number (Data/ID, links to /p/jobs/:id) + 12/16 assignment line, job status badge.
// G19: the group's assembly has no lookup → its id is shown (mono) instead of a name.
// G?-B-2: GET /inward-receipts/{id} does not say which Job a verified unit got; jobs verified in this tab are
// remembered (useUnitJobs), others show the gap.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconCamera, IconStack2, IconTool, IconUserPlus } from '@tabler/icons-react';
import {
  Button, cx, FieldRow, FormErrors, GapNote, GlassCard, Ic, InlineAlert, StatusPill, TextInput,
} from '../../../../ui/desktop';
import { enumLabel } from '../../../../lib/format';
import { useAuth } from '../../../../auth/AuthProvider';
import { useExpandGroup, useJob, type EquipmentGroup, type EquipmentUnit, type InwardReceipt } from '../../api';
import { isUuid, shortId, type UnitJob } from './local';

export const groupLabel = (g: EquipmentGroup) => `Group ${g.group_number}`;

export function GroupCard({ receipt, group, units, jobs, canWork, fill, onVerify, onAssign }: {
  receipt: InwardReceipt;
  group: EquipmentGroup;
  units: EquipmentUnit[];
  jobs: Record<string, UnitJob>;
  canWork: boolean;
  /** Stretch to the page bottom (single-group layout of the frames). */
  fill?: boolean;
  onVerify: (unit: EquipmentUnit, index: number) => void;
  onAssign: (unit: EquipmentUnit, index: number, job: UnitJob) => void;
}) {
  const expanded = units.length > 0;
  const dcLine = group.customer_dc_line ? ` · DC line ${group.customer_dc_line}` : '';
  const sub = expanded
    ? `Quantity received ${group.quantity_received}${dcLine} · expanded into ${units.length} ${units.length === 1 ? 'unit' : 'units'} → each gets a Job ID when verified`
    : `Quantity received ${group.quantity_received}${dcLine} · not expanded yet`;

  return (
    <GlassCard strong shadow className={cx('flex w-full flex-col items-start gap-[16px] p-[20px]', fill && 'min-h-[616px] flex-1')}>
      <div className="flex w-full items-center overflow-clip">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
          <p className="text-[18px] font-semibold leading-[24px] text-fg">
            {groupLabel(group)} · <span className="font-mono text-[13px] font-medium leading-[18px]" title={group.assembly_id}>assembly {shortId(group.assembly_id)}</span>
          </p>
          <p className="text-[14px] leading-[20px] text-fg-2">{sub}</p>
        </div>
      </div>
      {expanded
        ? <Units units={units} jobs={jobs} canWork={canWork} onVerify={onVerify} onAssign={onAssign} />
        : canWork && <ExpandForm receiptId={receipt.id} group={group} />}
    </GlassCard>
  );
}

// ---------------------------------------------------------------- expand
function ExpandForm({ receiptId, group }: { receiptId: string; group: EquipmentGroup }) {
  const { me } = useAuth();
  const [location, setLocation] = useState('');
  const [custodian, setCustodian] = useState(me?.id ?? '');
  const [touched, setTouched] = useState(false);
  const expand = useExpandGroup(receiptId);
  const errs = {
    location: !location.trim() ? 'Enter the store location ID' : !isUuid(location) ? 'Location ID is a UUID' : null,
    custodian: !custodian.trim() ? 'Enter the custodian ID' : !isUuid(custodian) ? 'Custodian ID is a UUID' : null,
  };
  const n = group.quantity_received;
  const submit = () => {
    setTouched(true);
    if (errs.location || errs.custodian) return;
    expand.mutate({ groupId: group.id, body: { location_id: location.trim(), custodian_id: custodian.trim() } });
  };
  const isMe = me && custodian.trim() === me.id;

  return (
    <>
      <InlineAlert tone="progress" title="Expand to create unit records">
        Creates {n} unit {n === 1 ? 'record' : 'records'} in the receiving store with a custodian. Verify each unit next to issue its Job ID.
      </InlineAlert>
      <FieldRow>
        <TextInput
          label="Store location *"
          mono
          placeholder="Custody location ID (UUID)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          error={touched ? errs.location : null}
        />
        <TextInput
          label="Custodian *"
          mono
          value={custodian}
          onChange={(e) => setCustodian(e.target.value)}
          error={touched ? errs.custodian : null}
          helper={isMe ? `You · ${me!.full_name}` : 'Employee ID (UUID)'}
        />
      </FieldRow>
      <GapNote code="G18">No custody-location lookup in the API — enter the receiving location's ID.</GapNote>
      <GapNote code="G17">No employee lookup — the custodian defaults to you; enter another employee's ID to change it.</GapNote>
      <FormErrors error={expand.error} />
      <div className="flex w-full items-start justify-end overflow-clip">
        <Button kind="primary" busy={expand.isPending} icon={<Ic icon={IconStack2} size={18} />} onClick={submit}>
          Expand into {n} {n === 1 ? 'unit' : 'units'}
        </Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- units + fan-out
function Units({ units, jobs, canWork, onVerify, onAssign }: {
  units: EquipmentUnit[];
  jobs: Record<string, UnitJob>;
  canWork: boolean;
  onVerify: (unit: EquipmentUnit, index: number) => void;
  onAssign: (unit: EquipmentUnit, index: number, job: UnitJob) => void;
}) {
  const cols = Math.min(units.length, 3);
  const anyVerified = units.some((u) => u.verification_status === 'VERIFIED');
  const gaps = (cols - 1) * 16;
  const centre = (i: number) => `calc((100% - ${gaps}px) / ${cols} * ${i + 0.5} + ${i * 16}px)`;
  const missingJob = units.some((u) => u.verification_status === 'VERIFIED' && !jobs[u.id]);

  return (
    <>
      <div className="relative h-[36px] w-full shrink-0" aria-hidden>
        <div className="absolute left-[24px] top-0 h-[18px] w-[2px] bg-line-strong" />
        <div className="absolute left-[24px] top-[18px] h-[2px] bg-line-strong" style={{ width: `calc(${centre(cols - 1)} - 24px)` }} />
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className="absolute top-[18px] h-[18px] w-[2px] bg-line-strong" style={{ left: `calc(${centre(i)} - 1px)` }} />
        ))}
        {anyVerified && <div className="absolute left-[21px] top-[-4px] h-[8px] w-[8px] rounded-full bg-line-strong" />}
      </div>
      <div className="grid w-full items-start gap-[16px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {units.map((u, i) => (
          <UnitCard
            key={u.id}
            unit={u}
            label={`Unit ${i + 1} of ${units.length}`}
            job={jobs[u.id]}
            canWork={canWork}
            onVerify={() => onVerify(u, i)}
            onAssign={(j) => onAssign(u, i, j)}
          />
        ))}
      </div>
      {missingJob && (
        <GapNote code="G?-B-2">
          GET /inward-receipts/&#123;id&#125; doesn't return the Job ID of a verified unit. Units verified in another session or tab show without their job.
        </GapNote>
      )}
    </>
  );
}

function UnitCard({ unit, label, job, canWork, onVerify, onAssign }: {
  unit: EquipmentUnit;
  label: string;
  job?: UnitJob;
  canWork: boolean;
  onVerify: () => void;
  onAssign: (j: UnitJob) => void;
}) {
  const pending = unit.verification_status === 'PENDING';
  return (
    <div
      className={cx(
        'flex min-w-0 flex-col items-start gap-[12px] overflow-clip rounded-[20px] p-[16px]',
        pending ? 'border-2 border-dashed border-brand-border bg-brand-subtle' : 'border border-line bg-surface',
      )}
    >
      <div className="flex w-full items-center gap-[8px] overflow-clip">
        <p className="min-w-0 flex-1 text-[15px] font-semibold leading-[20px] text-fg">{label}</p>
        <StatusPill domain="unitVerification" value={unit.verification_status} />
      </div>
      <div className="flex flex-col items-start gap-[4px] overflow-clip whitespace-nowrap text-fg-2">
        <p className="font-mono text-[13px] font-medium leading-[18px]">
          {unit.serial_number ? `S/N ${unit.serial_number}` : 'S/N — record on verify'}
        </p>
        {unit.reported_fault && <p className="text-[12px] leading-[16px]">{unit.reported_fault}</p>}
      </div>
      {pending && canWork && (
        <div className="flex w-full items-center overflow-clip py-[10px]">
          <Button kind="primary" block icon={<Ic icon={IconCamera} size={18} />} onClick={onVerify}>Verify unit</Button>
        </div>
      )}
      {unit.verification_status === 'VERIFIED' && job && <JobSlot job={job} canWork={canWork} onAssign={() => onAssign(job)} />}
    </div>
  );
}

function JobSlot({ job, canWork, onAssign }: { job: UnitJob; canWork: boolean; onAssign: () => void }) {
  const q = useJob(job.jobId);
  const a = q.data?.current_assignment ?? null;
  const line = q.isPending ? 'Loading…'
    : q.isError ? "Couldn't load the job"
      : a ? `Engineer ${shortId(a.engineer_id)} · ${a.response === 'PENDING' ? 'PENDING · awaiting custody' : enumLabel(a.response)}`
        : 'Not assigned yet';
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip rounded-[14px] bg-subtle px-[12px] py-[10px]">
      <Ic icon={IconTool} size={18} className="text-fg" />
      <div className="flex min-w-0 flex-1 flex-col items-start overflow-clip whitespace-nowrap">
        <Link to={`/p/jobs/${job.jobId}`} className="font-mono text-[13px] font-medium leading-[18px] text-fg hover:underline">{job.jobNumber}</Link>
        <p className="text-[12px] leading-[16px] text-fg-2" title={a?.engineer_id}>{line}</p>
      </div>
      {q.data && !a && canWork && (
        <Button kind="ghost" icon={<Ic icon={IconUserPlus} size={18} />} onClick={onAssign}>Assign</Button>
      )}
      {q.data && <StatusPill domain="job" value={q.data.status} />}
    </div>
  );
}
