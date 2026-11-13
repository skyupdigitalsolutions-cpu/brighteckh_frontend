// JIN detail — /p/inward/:jinId. GET /inward-receipts/{id} → header + equipment_groups[] + equipment_units[].
// Frames (page 177:102060): 177:108504 new · no equipment yet · 177:108542 add group drawer · 177:108610 group
// added · expand · 177:108664 units ready to verify · 177:103100 verify drawer · 177:103201 assign drawer.
// Content column (gap 20): Breadcrumb (chevron-left 18 + "Inward register" 14/20 secondary, "/" muted, JIN Data/ID)
// · [success Inline alert after create] · JIN header card (glass-strong, p-20, gap 16, radius 28, glass shadow):
// title row (JIN 20/26 mono Medium · Priority flag · Status badge · spacer · secondary "Add equipment group") and
// meta grid (gap 40) · then one card per equipment group, or the empty-state card.
// Loading / error / not-found use the kit states (StateCard + ErrorState / EmptyState).
// G16: no customer lookup → the Customer cell shows the customer id.
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { IconChevronLeft, IconFileSearch, IconPackage, IconPlus } from '@tabler/icons-react';
import {
  Button, ButtonLink, EmptyState, GapNote, GlassCard, Ic, InlineAlert, PageContent, PageHeader, PriorityChip,
  QueryView, StateCard, StatusPill, useToast,
} from '../../../../ui/desktop';
import { enumLabel, formatDateTime } from '../../../../lib/format';
import { useAuth } from '../../../../auth/AuthProvider';
import { can } from '../../../../auth/access';
import { useReceipt, type EquipmentUnit, type InwardReceipt } from '../../api';
import { AddGroupDrawer } from './AddGroupDrawer';
import { AssignEngineerDrawer } from './AssignEngineerDrawer';
import { GroupCard, groupLabel } from './GroupCard';
import { formatDayMonth, isUuid, MetaItem, shortId, useUnitJobs, type UnitJob } from './local';
import { VerifyUnitDrawer } from './VerifyUnitDrawer';

function Breadcrumb({ jin }: { jin?: string }) {
  return (
    <Link to="/p/inward" className="flex items-center gap-[8px] overflow-clip">
      <Ic icon={IconChevronLeft} size={18} className="text-fg" />
      <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2 hover:text-fg">Inward register</span>
      {jin && (
        <>
          <span className="text-[14px] leading-[20px] text-fg-muted">/</span>
          <span className="whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-fg">{jin}</span>
        </>
      )}
    </Link>
  );
}

function Bar({ w }: { w: number }) {
  return <div className="h-[12px] shrink-0 animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />;
}

function LoadingBody() {
  return (
    <>
      <GlassCard strong shadow className="flex w-full flex-col gap-[16px] p-[20px]" aria-busy="true" aria-label="Loading">
        <div className="flex h-[36px] items-center gap-[12px]"><Bar w={160} /><Bar w={66} /><Bar w={100} /></div>
        <div className="flex gap-[40px]">{[150, 128, 60, 40, 150, 70].map((w, i) => <div key={i} className="flex flex-col gap-[8px]"><Bar w={50} /><Bar w={w} /></div>)}</div>
      </GlassCard>
      <GlassCard strong shadow className="flex min-h-[528px] w-full flex-col gap-[16px] p-[20px]">
        <Bar w={300} /><Bar w={420} />
      </GlassCard>
    </>
  );
}

function NotFound() {
  return (
    <EmptyState
      icon={IconFileSearch}
      title="JIN not found"
      body="This inward receipt doesn't exist or belongs to another company. Check the link and try again."
      action={<ButtonLink to="/p/inward" kind="secondary">Back to inward register</ButtonLink>}
    />
  );
}

export function JinDetailPage() {
  const { jinId } = useParams();
  const valid = !!jinId && isUuid(jinId);
  const q = useReceipt(valid ? jinId : undefined);
  if (valid && q.isSuccess) return <JinDetail receipt={q.data} />;
  return (
    <>
      <PageHeader title="Inward receipt" />
      <PageContent>
        <Breadcrumb />
        {!valid ? (
          <StateCard><NotFound /></StateCard>
        ) : (
          <QueryView query={q} loading={<LoadingBody />} errorTitle="Couldn't load this JIN" notFound={<NotFound />}>
            {() => null}
          </QueryView>
        )}
      </PageContent>
    </>
  );
}

type VerifyTarget = { unit: EquipmentUnit; index: number; total: number; group: string };
type AssignTarget = { jobId: string; jobNumber: string; unitText: string; created?: { verified: number; total: number; jin: string } };

function JinDetail({ receipt: r }: { receipt: InwardReceipt }) {
  const { me } = useAuth();
  const canWork = !!me && can.purchaseWork(me.role);
  const toast = useToast();
  const loc = useLocation();
  const createdJin = (loc.state as { created?: string } | null)?.created;
  const { jobs, remember } = useUnitJobs(r.id);
  const [addOpen, setAddOpen] = useState(false);
  const [verifyT, setVerifyT] = useState<VerifyTarget | null>(null);
  const [assignT, setAssignT] = useState<AssignTarget | null>(null);

  const groups = r.equipment_groups;
  const unitsOf = (gid: string) => r.equipment_units.filter((u) => u.group_id === gid);
  const totalUnits = r.equipment_units.length;
  const verifiedUnits = r.equipment_units.filter((u) => u.verification_status === 'VERIFIED').length;

  // Register row menu deep links: ?action=add-group | verify. Opens the drawer once, then drops the param.
  const [params, setParams] = useSearchParams();
  const action = params.get('action');
  useEffect(() => {
    if (!action) return;
    if (canWork && action === 'add-group') setAddOpen(true);
    if (canWork && action === 'verify') {
      for (const g of groups) {
        const units = unitsOf(g.id);
        const index = units.findIndex((u) => u.verification_status !== 'VERIFIED');
        if (index >= 0) { setVerifyT({ unit: units[index], index, total: units.length, group: groupLabel(g) }); break; }
      }
    }
    const next = new URLSearchParams(params);
    next.delete('action');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const channel = enumLabel(r.receipt_channel) + (r.courier_name ? ` · ${r.courier_name}` : '');
  const dc = [r.customer_dc_number, formatDayMonth(r.dc_date)].filter(Boolean).join(' · ') || '—';
  const meta = [
    r.declared_quantity != null ? `${r.declared_quantity} ${r.declared_quantity === 1 ? 'unit' : 'units'} declared` : null,
    enumLabel(r.receipt_channel),
  ].filter(Boolean).join(' · ');

  const addButton = canWork && (
    <Button kind="secondary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setAddOpen(true)}>Add equipment group</Button>
  );

  return (
    <>
      <PageHeader title={r.jin_number} meta={meta} />
      <PageContent>
        <Breadcrumb jin={r.jin_number} />
        {createdJin && groups.length === 0 && (
          <InlineAlert tone="success" title={`${r.jin_number} created`}>Now add the equipment you received.</InlineAlert>
        )}

        <GlassCard strong shadow className="flex w-full flex-col items-start gap-[16px] p-[20px]">
          <div className="flex w-full items-center gap-[12px] overflow-clip">
            <p className="whitespace-nowrap font-mono text-[20px] font-medium leading-[26px] text-fg">{r.jin_number}</p>
            <PriorityChip priority={r.priority} />
            <StatusPill domain="receipt" value={r.receipt_status} />
            <div className="h-px min-w-px flex-1" />
            {addButton}
          </div>
          <div className="flex flex-wrap items-start gap-x-[40px] gap-y-[12px] overflow-clip">
            <MetaItem label="Customer" value={shortId(r.customer_id)} mono title={r.customer_id} />
            <MetaItem label="Received" value={formatDateTime(r.receipt_at)} />
            <MetaItem label="Channel" value={channel} />
            <MetaItem label="AWB" value={r.courier_awb || '—'} mono />
            <MetaItem label="Customer DC" value={dc} mono />
            <MetaItem label="Declared qty" value={r.declared_quantity ?? '—'} />
            {r.dc_exception_status !== 'NONE' && (
              <div className="flex shrink-0 flex-col items-start gap-[2px]">
                <p className="text-[12px] leading-[16px] text-fg-2">DC exception</p>
                <StatusPill domain="dcException" value={r.dc_exception_status} />
              </div>
            )}
          </div>
          {r.priority_reason && <p className="text-[14px] leading-[20px] text-fg-2">Priority reason: {r.priority_reason}</p>}
          {r.notes && <p className="text-[14px] leading-[20px] text-fg-2">Notes: {r.notes}</p>}
          <GapNote code="G16">No customer lookup in the API — the customer is shown by ID.</GapNote>
        </GlassCard>

        {groups.length === 0 ? (
          <GlassCard strong shadow className="flex min-h-[528px] w-full flex-1 flex-col items-center justify-center p-[20px]">
            <EmptyState
              icon={IconPackage}
              title="No equipment added yet"
              body="Add each equipment type with the quantity received. Every physical unit gets its own Job ID after verification."
              action={canWork ? (
                <Button kind="primary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setAddOpen(true)}>Add equipment group</Button>
              ) : undefined}
            />
          </GlassCard>
        ) : (
          groups.map((g) => {
            const units = unitsOf(g.id);
            return (
              <GroupCard
                key={g.id}
                receipt={r}
                group={g}
                units={units}
                jobs={jobs}
                canWork={canWork}
                fill={groups.length === 1}
                onVerify={(unit, index) => setVerifyT({ unit, index, total: units.length, group: groupLabel(g) })}
                onAssign={(_u, index, job: UnitJob) => setAssignT({ jobId: job.jobId, jobNumber: job.jobNumber, unitText: `unit ${index + 1} of ${r.jin_number}` })}
              />
            );
          })
        )}
      </PageContent>

      {canWork && <AddGroupDrawer open={addOpen} onClose={() => setAddOpen(false)} receipt={r} />}
      {canWork && verifyT && (
        <VerifyUnitDrawer
          key={verifyT.unit.id}
          open
          onClose={() => setVerifyT(null)}
          receipt={r}
          unit={verifyT.unit}
          unitLabel={`${verifyT.index + 1} of ${verifyT.total}`}
          groupLabel={verifyT.group}
          onVerified={(res) => {
            const t = verifyT;
            remember(t.unit.id, { jobId: res.job.id, jobNumber: res.job.job_number });
            setVerifyT(null);
            setAssignT({
              jobId: res.job.id,
              jobNumber: res.job.job_number,
              unitText: `unit ${t.index + 1} of ${r.jin_number}`,
              created: { verified: Math.min(totalUnits, verifiedUnits + 1), total: totalUnits, jin: r.jin_number },
            });
          }}
        />
      )}
      {canWork && assignT && (
        <AssignEngineerDrawer
          key={assignT.jobId}
          open
          onClose={() => setAssignT(null)}
          jobId={assignT.jobId}
          jobNumber={assignT.jobNumber}
          unitText={assignT.unitText}
          created={assignT.created}
          onAssigned={() => toast({ tone: 'success', title: `${assignT.jobNumber} assigned`, body: 'Assignment is PENDING until the engineer accepts custody.' })}
        />
      )}
    </>
  );
}
