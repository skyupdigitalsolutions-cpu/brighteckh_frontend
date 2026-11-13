// One equipment group on the JIN detail page.
// Card (177:108645 / 177:108699): glass-strong, 1px glass border, radius 28, p-20, gap 16, glass shadow.
// Head: "Group n · <assembly>" Desktop/H2 18/24 + 14/20 secondary sub-line (gap 2).
// Not expanded (177:108610): progress Inline alert "Expand to create unit records" · Store location* + Custodian*
// pair (gap 14) · right-aligned primary "Expand into n units" (stack icon).
//   POST /equipment-groups/{id}/expand { location_id, custodian_id }. Store location = LookupPicker over
//   custodyLocationSource; Custodian = LookupPicker over employeeSource() — any active employee of the company (the DB
//   check in br02_expand_equipment_group requires only that, so no role filter is applied) — defaulting to the
//   signed-in user.
// Expanded (177:108664 / 177:103148): fan-out connector (2px border-strong lines, 36 high: trunk at x 24, bar at
// y 18, a drop to the centre of each unit column; 8px dot on the trunk top in the frames that have verified units)
// then unit cards (gap 16, radius 20, p-16, gap 12):
//   PENDING  = brand-subtle fill + 2px dashed brand-border; job slot py-10 = primary "Verify unit" (camera), block.
//   VERIFIED = surface + 1px border-default; job slot = subtle fill, radius 14, px-12 py-10, gap 10: tool icon,
//              job_number (Data/ID, links to /p/jobs/:id) + 12/16 assignment line, job status badge.
// Group title = assembly name (resolved once on the page via useAssembliesByIds). A verified unit's Job comes from the
// receipt detail (equipment_units[].job_id / job_number); the assignment line names the engineer (useEngineersByIds).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconCamera, IconStack2, IconTool, IconUserPlus } from '@tabler/icons-react';
import {
  Button, cx, FieldRow, FormErrors, GlassCard, Ic, InlineAlert, LookupPicker, StatusPill,
} from '../../../../ui/desktop';
import { enumLabel } from '../../../../lib/format';
import { useAuth } from '../../../../auth/AuthProvider';
import {
  custodyLocationSource, employeeSource, useEngineersByIds, useExpandGroup, useJob, type AssemblyLookupRow,
  type EquipmentGroup, type InwardReceipt,
} from '../../api';
import { shortId } from './local';

/** A unit row of the receipt detail (carries job_id / job_number). */
export type ReceiptUnit = InwardReceipt['equipment_units'][number];
export type UnitJob = { jobId: string; jobNumber: string };
/** The Job created when the unit was verified (null before verification). */
export const unitJob = (u: ReceiptUnit): UnitJob | null =>
  u.job_id && u.job_number ? { jobId: u.job_id, jobNumber: u.job_number } : null;

export const groupLabel = (g: EquipmentGroup) => `Group ${g.group_number}`;
const CUSTODIANS = employeeSource();

export function GroupCard({ receipt, group, assembly, units, canWork, fill, onVerify, onAssign }: {
  receipt: InwardReceipt;
  group: EquipmentGroup;
  /** Resolved assembly row (undefined while it loads or if the lookup can't see it → short id shown). */
  assembly?: AssemblyLookupRow;
  units: ReceiptUnit[];
  canWork: boolean;
  /** Stretch to the page bottom (single-group layout of the frames). */
  fill?: boolean;
  onVerify: (unit: ReceiptUnit, index: number) => void;
  onAssign: (unit: ReceiptUnit, index: number, job: UnitJob) => void;
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
            {groupLabel(group)} · {assembly
              ? <span title={assembly.assembly_code}>{assembly.assembly_name}</span>
              : <span className="font-mono text-[13px] font-medium leading-[18px]" title={group.assembly_id}>assembly {shortId(group.assembly_id)}</span>}
          </p>
          <p className="text-[14px] leading-[20px] text-fg-2">{sub}</p>
        </div>
      </div>
      {expanded
        ? <Units units={units} canWork={canWork} onVerify={onVerify} onAssign={onAssign} />
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
    location: !location ? 'Choose the store location' : null,
    custodian: !custodian ? 'Choose the custodian' : null,
  };
  const n = group.quantity_received;
  const submit = () => {
    setTouched(true);
    if (errs.location || errs.custodian) return;
    expand.mutate({ groupId: group.id, body: { location_id: location, custodian_id: custodian } });
  };
  const isMe = !!me && custodian === me.id;

  return (
    <>
      <InlineAlert tone="progress" title="Expand to create unit records">
        Creates {n} unit {n === 1 ? 'record' : 'records'} in the receiving store with a custodian. Verify each unit next to issue its Job ID.
      </InlineAlert>
      <FieldRow>
        <LookupPicker
          label="Store location *"
          placeholder="Select location"
          value={location || null}
          onChange={(id) => setLocation(id ?? '')}
          source={custodyLocationSource}
          error={touched ? errs.location : null}
        />
        <LookupPicker
          label="Custodian *"
          placeholder="Select employee"
          value={custodian || null}
          onChange={(id) => setCustodian(id ?? '')}
          source={CUSTODIANS}
          error={touched ? errs.custodian : null}
          helper={isMe ? 'You' : 'Who holds the units in the store'}
        />
      </FieldRow>
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
function Units({ units, canWork, onVerify, onAssign }: {
  units: ReceiptUnit[];
  canWork: boolean;
  onVerify: (unit: ReceiptUnit, index: number) => void;
  onAssign: (unit: ReceiptUnit, index: number, job: UnitJob) => void;
}) {
  const cols = Math.min(units.length, 3);
  const anyVerified = units.some((u) => u.verification_status === 'VERIFIED');
  const gaps = (cols - 1) * 16;
  const centre = (i: number) => `calc((100% - ${gaps}px) / ${cols} * ${i + 0.5} + ${i * 16}px)`;

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
            job={unitJob(u)}
            canWork={canWork}
            onVerify={() => onVerify(u, i)}
            onAssign={(j) => onAssign(u, i, j)}
          />
        ))}
      </div>
    </>
  );
}

function UnitCard({ unit, label, job, canWork, onVerify, onAssign }: {
  unit: ReceiptUnit;
  label: string;
  job: UnitJob | null;
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
  const eng = useEngineersByIds([a?.engineer_id]);
  const engName = a ? eng.data?.[a.engineer_id]?.full_name ?? `Engineer ${shortId(a.engineer_id)}` : '';
  const line = q.isPending ? 'Loading…'
    : q.isError ? "Couldn't load the job"
      : a ? `${engName} · ${a.response === 'PENDING' ? 'PENDING · awaiting custody' : enumLabel(a.response)}`
        : 'Not assigned yet';
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip rounded-[14px] bg-subtle px-[12px] py-[10px]">
      <Ic icon={IconTool} size={18} className="text-fg" />
      <div className="flex min-w-0 flex-1 flex-col items-start overflow-clip whitespace-nowrap">
        <Link to={`/p/jobs/${job.jobId}`} className="font-mono text-[13px] font-medium leading-[18px] text-fg hover:underline">{job.jobNumber}</Link>
        <p className="text-[12px] leading-[16px] text-fg-2">{line}</p>
      </div>
      {q.data && !a && canWork && (
        <Button kind="ghost" icon={<Ic icon={IconUserPlus} size={18} />} onClick={onAssign}>Assign</Button>
      )}
      {q.data && <StatusPill domain="job" value={q.data.status} />}
    </div>
  );
}
