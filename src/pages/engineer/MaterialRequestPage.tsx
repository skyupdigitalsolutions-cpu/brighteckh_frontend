// E5a blocked (17:627) · E5b draft (17:684) · E5c item search (17:790) · E5d submitted, edit window (17:859)
// · E5e locked/processing (17:957) · E5f change request (17:1053).
// Material requests have NO approval gate: DRAFT → SUBMITTED lands straight in Purchase's inbox.
// Edit window: lines can be added while SUBMITTED until self_edit_deadline_at (1 working hour) or until
// Purchase starts processing. After that, changes go through a change request.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { IconClock, IconFileText, IconFilePlus, IconInfoCircle, IconLock, IconPlus, IconSearch, IconSend } from '@tabler/icons-react';
import { api } from '../../api/endpoints';
import { http } from '../../api/http';
import type { Item, JobDetail, MaterialLine, MaterialRequest, Priority } from '../../api/types';
import { useMe } from '../../auth/AuthProvider';
import { formatDate, formatQty, formatTime } from '../../lib/format';
import {
  BottomSheet, Button, Card, cx, EmptyState, ErrorState, FormError, GapNote, InlineAlert, PriorityFlag, SkeletonCard, StatusBadge, TextArea,
} from '../../ui/primitives';
import { GatedAction } from '../../ui/mobile';
import { qk, useInspectionReport, useJobMaterialRequests } from './data';
import { JobFrame, useJobAction } from './JobFrame';

export function MaterialRequestPage() {
  const { jobId = '' } = useParams();
  return (
    <JobFrame jobId={jobId} title="Material" flow="br03" step="material">
      {(job) => <Material job={job} />}
    </JobFrame>
  );
}

function Material({ job }: { job: JobDetail }) {
  const me = useMe();
  const report = useInspectionReport(job.id);
  const mrs = useJobMaterialRequests(job.id);
  const canAct = job.current_assignment?.engineer_id === me.id && job.current_assignment.response === 'ACCEPTED';

  if (report.isPending || mrs.isPending) return <><SkeletonCard /><SkeletonCard /></>;
  if (report.error || mrs.error) {
    return <ErrorState title="Couldn't load material requests" onRetry={() => { void report.refetch(); void mrs.refetch(); }} />;
  }

  // E5a — blocked until Purchase accepts the inspection report.
  if (report.data?.status !== 'ACCEPTED') {
    const latest = report.data?.versions[report.data.versions.length - 1];
    return (
      <>
        <InlineAlert tone="blocked" title="Parts can be requested after Purchase accepts your report" icon={<IconLock size={20} />}>
          The material request opens once an inspection version is accepted.
        </InlineAlert>
        <Card>
          <div className="flex items-center gap-2">
            <span className="text-base leading-6">{latest ? `Inspection report · v${latest.version_no}` : 'Inspection report'}</span>
            {report.data ? <StatusBadge domain="inspectionReport" value={report.data.status} /> : <span className="text-sm text-fg-2">not started</span>}
          </div>
        </Card>
        <Link to={`/jobs/${job.id}/report`} className="self-start">
          <Button kind="secondary" icon={<IconFileText size={20} />}>Open inspection report</Button>
        </Link>
      </>
    );
  }

  const rows = [...(mrs.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const current = rows[0];
  if (!current) {
    return canAct ? <CreateRequest job={job} /> : (
      <EmptyState icon={<IconFileText size={28} />} title="No material request yet">Only the engineer holding custody can request parts.</EmptyState>
    );
  }
  return <RequestView job={job} requestId={current.id} canAct={canAct} others={rows.length - 1} />;
}

// ------------------------------------------------------------------ create (E5b header)
const PRIORITIES: Priority[] = ['NORMAL', 'URGENT', 'CRITICAL'];

function CreateRequest({ job }: { job: JobDetail }) {
  const [priority, setPriority] = useState<Priority>(job.priority);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const create = useJobAction(job.id, () => api.createMaterialRequest(job.id, {
    priority,
    ...(date ? { required_by_date: date, required_by_reason: reason.trim() } : {}),
  }));
  const blocked = date && !reason.trim() ? 'Say why you need it by that date' : null;
  return (
    <>
      <PrioritySegment value={priority} onChange={setPriority} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="needed-by" className="text-base font-medium leading-6">Needed by (optional)</label>
        <input
          id="needed-by"
          type="date"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          className="h-[52px] rounded-xl border border-line-strong bg-surface px-3 text-base focus:border-line-focus focus:outline-none"
        />
        <p className="text-sm leading-5 text-fg-2">If set, add why</p>
      </div>
      {date && <TextArea label="Why by then?" value={reason} onChange={(e) => setReason(e.target.value)} />}
      <FormError messages={create.errors} />
      <GatedAction blockedReason={blocked} primaryLabel="Start request" primaryIcon={<IconPlus size={20} />} busy={create.busy} onPrimary={() => create.run(undefined)} />
      <p className="text-sm text-fg-2">Parts are added next. Nothing goes to Purchase until you send it.</p>
    </>
  );
}

function PrioritySegment({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-base font-medium leading-6">Priority</span>
      <div className="flex rounded-xl border border-line-strong bg-surface p-px" role="radiogroup" aria-label="Priority">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={value === p}
            onClick={() => onChange(p)}
            className={cx('h-12 flex-1 rounded-[11px] text-base font-medium', value === p ? 'bg-inverse text-fg-inverse' : 'text-fg')}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ request (E5b/E5d/E5e)
function useCountdown(deadline: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000));
}
const mmss = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m).padStart(2, '0')) + `:${String(x).padStart(2, '0')}`;
};

function RequestView({ job, requestId, canAct, others }: { job: JobDetail; requestId: string; canAct: boolean; others: number }) {
  const mr = useQuery({ queryKey: qk.mr(requestId), queryFn: () => api.materialRequest(requestId) });
  const [addOpen, setAddOpen] = useState(false);
  const [crOpen, setCrOpen] = useState(false);
  const left = useCountdown(mr.data?.status === 'SUBMITTED' && !mr.data.purchase_processing_started_at ? mr.data.self_edit_deadline_at : null);
  const submit = useJobAction(job.id, () => api.submitMaterialRequest(requestId), () => void mr.refetch());

  if (mr.isPending) return <><SkeletonCard /><SkeletonCard /></>;
  if (mr.error) return <ErrorState title="Couldn't load the material request" onRetry={() => void mr.refetch()} />;
  const r = mr.data;

  // Mirrors br03_can_engineer_edit: DRAFT, or SUBMITTED within the window and not yet processing.
  const inWindow = r.status === 'SUBMITTED' && !r.purchase_processing_started_at && left != null && left > 0;
  const editable = r.status === 'DRAFT' || inWindow;
  const canChange = !editable && (r.status === 'SUBMITTED' || r.status === 'PROCESSING');
  const pendingCr = r.change_requests.find((c) => c.review_status === 'PENDING');

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-medium">{r.request_number}</span>
        <StatusBadge domain="materialRequest" value={r.status} />
        <PriorityFlag priority={r.priority} />
      </div>

      {r.status === 'DRAFT' && r.required_by_date && (
        <p className="text-sm text-fg-2">Needed by {formatDate(r.required_by_date)} · {r.required_by_reason}</p>
      )}

      {inWindow && (
        <div className="flex items-center gap-3 rounded-[10px] border border-warn-border bg-warn-bg px-4 py-3 text-warn-fg">
          <IconClock size={22} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium leading-6">You can still add parts</p>
            <p className="text-sm leading-5">Window closes at {formatTime(r.self_edit_deadline_at)}</p>
          </div>
          <span className="font-mono text-xl font-semibold tabular-nums" role="timer">{mmss(left!)}</span>
        </div>
      )}
      {r.status === 'SUBMITTED' && !r.self_edit_deadline_at && (
        <InlineAlert tone="neutral" title="Locked on submit">No working calendar is set for your company, so the 1-hour edit window doesn't apply.</InlineAlert>
      )}
      {r.status !== 'DRAFT' && r.submitted_at && (
        <p className="text-sm text-fg-2">Sent {formatTime(r.submitted_at)} · went straight to Purchase</p>
      )}
      {!editable && (r.status === 'PROCESSING' || r.status === 'SUBMITTED') && (
        <InlineAlert tone="neutral" title={r.status === 'PROCESSING' ? 'Locked · Purchase is processing' : 'Locked · edit window closed'} icon={<IconInfoCircle size={20} />}>
          Parts can't be edited now. Raise a change request and Purchase will review it.
        </InlineAlert>
      )}
      {r.status === 'CHANGE_REQUESTED' && (
        <InlineAlert tone="progress" title="Change request with Purchase">Purchase will accept or reject it. You can raise another after that.</InlineAlert>
      )}

      <h2 className="text-base font-medium leading-6">Parts · {r.lines.length}</h2>
      {r.lines.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-line-strong bg-surface px-4 py-6 text-center text-base text-fg-2">No parts yet. Add at least one to send.</p>
      ) : (
        <ul className="flex flex-col gap-3">{r.lines.map((l) => <li key={l.id}><LineCard line={l} locked={!editable} /></li>)}</ul>
      )}
      <GapNote code="G10">Lines carry only item_bridge_id — no endpoint resolves it to a part code/name, so lines show the bridge reference.</GapNote>

      {r.change_requests.length > 0 && (
        <Card title="Change requests">
          {r.change_requests.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 border-t border-line pt-3 first:border-0 first:pt-0">
              <div className="flex items-center gap-2"><StatusBadge domain="changeRequest" value={c.review_status} /></div>
              <p className="text-sm leading-5">{c.change_reason}</p>
              {c.review_comment && <p className="text-sm leading-5 text-fg-2">Purchase: {c.review_comment}</p>}
            </div>
          ))}
        </Card>
      )}
      {others > 0 && <p className="text-sm text-fg-2">{others} earlier request{others === 1 ? '' : 's'} on this job.</p>}

      <FormError messages={submit.errors} />
      {canAct && (
        <div className="flex flex-col gap-3">
          {editable && <Button kind="secondary" icon={<IconPlus size={20} />} onClick={() => setAddOpen(true)} className="self-start">Add part</Button>}
          {r.status === 'DRAFT' && (
            <GatedAction
              blockedReason={r.lines.length === 0 ? 'Add at least one part to send' : null}
              primaryLabel="Send to Purchase"
              primaryIcon={<IconSend size={20} />}
              busy={submit.busy}
              onPrimary={() => submit.run(undefined)}
            />
          )}
          {canChange && !pendingCr && (
            <Button icon={<IconFilePlus size={20} />} onClick={() => setCrOpen(true)} className="self-start">Raise change request</Button>
          )}
        </div>
      )}

      {canAct && <AddPartSheet open={addOpen} onClose={() => setAddOpen(false)} />}
      {canAct && canChange && <ChangeRequestSheet jobId={job.id} request={r} open={crOpen} onClose={() => setCrOpen(false)} />}
    </>
  );
}

function LineCard({ line, locked }: { line: MaterialLine; locked: boolean }) {
  const stock = line.available_stock_snapshot;
  const inStore = stock != null && Number(stock) > 0;
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-medium text-fg-2" title={line.item_bridge_id}>BRIDGE …{line.item_bridge_id.slice(-8)}</span>
        <span className="flex-1" />
        {locked && <IconLock size={16} className="text-fg-muted" aria-label="Locked" />}
      </div>
      {line.technical_note && <p className="text-base leading-6">{line.technical_note}</p>}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-semibold">{formatQty(line.quantity, line.uom_snapshot)}</span>
        <span className="flex-1" />
        {stock != null && (
          <span className={cx('inline-flex items-center gap-1.5 rounded border px-2 py-[3px] text-[11px] font-semibold tracking-[0.04em]',
            inStore ? 'border-st-success-bd bg-st-success-bg text-st-success-fg' : 'border-st-blocked-bd bg-st-blocked-bg text-st-blocked-fg')}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />IN STORE {formatQty(stock, line.uom_snapshot)}
          </span>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ E5c · add part (approved items only)
function AddPartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Item | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  // G5: no search endpoint; GET /masters/items is status-filtered (≤50 rows). Only APPROVED/ACTIVE can be requested.
  const lists = useQueries({
    queries: (['APPROVED', 'ACTIVE'] as const).map((status) => ({
      queryKey: ['items', status],
      queryFn: () => http.get<Item[]>('/masters/items', { params: { status } }).then((r) => r.data),
      enabled: open, staleTime: 5 * 60_000,
    })),
  });
  const items = useMemo(() => {
    const all = lists.flatMap((l) => l.data ?? []);
    const s = q.trim().toLowerCase();
    return s ? all.filter((i) => i.item_code.toLowerCase().includes(s) || i.standard_name.toLowerCase().includes(s)) : all;
  }, [lists, q]);
  const loading = lists.some((l) => l.isPending);
  const failed = lists.find((l) => l.error);

  // G10: AddMaterialLineDto needs item_bridge_id, and no endpoint maps an item to its bridge row.
  // The line is NOT posted with a guessed id — the action is blocked with the reason shown. When the API
  // exposes the bridge id, call api.addMaterialLine(requestId, { item_bridge_id, quantity, technical_note }).

  const close = () => { setPicked(null); setQ(''); setQty(1); setNote(''); onClose(); };
  return (
    <BottomSheet open={open} onClose={close} title={picked ? 'Quantity' : 'Add a part'}>
      {!picked ? (
        <>
          <div className="relative">
            <IconSearch size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search part code or name"
              aria-label="Search parts"
              className="h-[52px] w-full rounded-xl border border-line-strong pl-10 pr-3 text-base focus:border-line-focus focus:outline-none"
            />
          </div>
          <InlineAlert tone="neutral" title="Approved parts only">Parts still in review can't be requested. Ask Purchase to approve a part you can't find.</InlineAlert>
          {loading ? <SkeletonCard /> : failed ? <p className="text-sm text-st-blocked-fg">Couldn't load parts.</p> : items.length === 0 ? (
            <p className="py-4 text-center text-base text-fg-2">No approved part matches.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.slice(0, 30).map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => setPicked(i)} className="flex w-full items-center gap-3 rounded-[10px] border border-line px-3 py-3 text-left hover:border-line-strong">
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[13px] font-medium">{i.item_code}</span>
                      <span className="block text-base leading-6">{i.standard_name}</span>
                    </span>
                    <StatusBadge domain="itemStatus" value={i.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <GapNote code="G5">No item search endpoint — searching the first 50 APPROVED + 50 ACTIVE items only.</GapNote>
        </>
      ) : (
        <>
          <div>
            <p className="font-mono text-[13px] font-medium">{picked.item_code}</p>
            <p className="text-base font-medium leading-6">{picked.standard_name}</p>
          </div>
          <QtyStepper value={qty} onChange={setQty} uom={picked.base_uom} />
          <TextArea label="Technical note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <GatedAction
            blockedReason="Can't add: no API maps this part to its catalog-bridge ID (G10)"
            primaryLabel="Add to request"
            primaryIcon={<IconPlus size={20} />}
            onPrimary={() => undefined}
          />
          <Button kind="ghost" block onClick={() => setPicked(null)}>Back to search</Button>
        </>
      )}
    </BottomSheet>
  );
}

export function QtyStepper({ value, onChange, uom, min = 1, max }: { value: number; onChange: (n: number) => void; uom: string; min?: number; max?: number }) {
  const btn = 'flex h-12 w-12 items-center justify-center rounded-lg border border-line-strong text-xl font-medium disabled:opacity-40';
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} aria-label="Decrease" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="min-w-[72px] text-center font-mono text-[15px] font-semibold" aria-live="polite">{value} {uom}</span>
      <button type="button" className={btn} aria-label="Increase" disabled={max != null && value >= max} onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}>+</button>
    </div>
  );
}

// ------------------------------------------------------------------ E5f · change request
function ChangeRequestSheet({ jobId, request, open, onClose }: { jobId: string; request: MaterialRequest; open: boolean; onClose: () => void }) {
  const [lineId, setLineId] = useState<string | null>(request.lines[0]?.id ?? null);
  const line = request.lines.find((l) => l.id === lineId) ?? null;
  const [qty, setQty] = useState(() => Math.max(1, Math.round(Number(line?.quantity ?? 1))));
  const [reason, setReason] = useState('');
  useEffect(() => { if (line) setQty(Math.max(1, Math.round(Number(line.quantity)))); }, [line]);

  // proposed_change is free JSON in the API (no schema); this shape is the UI's proposal — flagged for sign-off.
  const act = useJobAction(jobId, () => api.createChangeRequest(request.id, {
    change_reason: reason.trim(),
    proposed_change: line
      ? { kind: 'QUANTITY', line_id: line.id, item_bridge_id: line.item_bridge_id, quantity_from: line.quantity, quantity_to: qty, uom: line.uom_snapshot }
      : { kind: 'OTHER' },
    // OpenAPI declares proposed_change as bare `object`; openapi-typescript renders that as Record<string, never>.
  } as unknown as Parameters<typeof api.createChangeRequest>[1]), () => { setReason(''); onClose(); });

  return (
    <BottomSheet open={open} onClose={onClose} title="Request a change">
      {request.lines.length > 1 && (
        <select
          aria-label="Line to change"
          value={lineId ?? ''}
          onChange={(e) => setLineId(e.target.value)}
          className="h-12 rounded-xl border border-line-strong bg-surface px-3 text-base"
        >
          {request.lines.map((l) => <option key={l.id} value={l.id}>…{l.item_bridge_id.slice(-8)} · {formatQty(l.quantity, l.uom_snapshot)}</option>)}
        </select>
      )}
      {line && (
        <div className="flex flex-col gap-3 rounded-[10px] border border-line p-4">
          <p className="font-mono text-[13px] text-fg-2">BRIDGE …{line.item_bridge_id.slice(-8)}</p>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[13px] font-semibold">{formatQty(line.quantity, line.uom_snapshot)} →</span>
            <QtyStepper value={qty} onChange={setQty} uom={line.uom_snapshot} />
          </div>
        </div>
      )}
      <TextArea label="Why?" value={reason} onChange={(e) => setReason(e.target.value)} helper="Required. Purchase reviews every change." />
      <FormError messages={act.errors} />
      <GatedAction
        blockedReason={!reason.trim() ? 'Say why you need the change' : null}
        primaryLabel="Send change request"
        primaryIcon={<IconSend size={20} />}
        busy={act.busy}
        onPrimary={() => act.run(undefined)}
      />
      <Button kind="ghost" block onClick={onClose}>Cancel</Button>
    </BottomSheet>
  );
}
