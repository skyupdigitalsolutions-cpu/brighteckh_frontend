// POUT1 · Outward detail (PS-D 238:41629): draft pick 246:50960 · packing BLOCKED 51277 · packing READY 51615 ·
// cancel drawer 51981 · DISPATCHED 52230 · POD drawer 52594 · delivered 52891 · POD DAMAGED → BLOCKED 53235.
// Data: GET /sales-outwards/:id (lines, packing evidence, delivery evidence, tracking events) + data.ts lookups.
// Layout: Content → optional success alert → "Split" (gap 20): Outward card (flex-1, glass-strong r24 p20 gap12) +
// Panel (460, same card). Inner table: Item grow · Qty 70 (right) · Serials 150 · Evidence 110 · Line status 130.
// Right panel by state:
//   DRAFT, selected line DRAFT   → Pick (verification checks + serials, POST /sales-outward-lines/:id/pick)
//   DRAFT, selected line PICKED  → Packing evidence (kind chips + PhotoPicker, each file uploads at once →
//                                  POST /sales-outward-lines/:id/packing-evidence) + Gated action "Dispatch outward"
//                                  (server truth: every line PICKED and with ≥1 evidence row) + Cancel outward
//   DISPATCHED                   → Tracking timeline + Add event + Record proof of delivery
// Dispatch = POST /sales-outwards/:id/dispatch: a REAL stock-ledger ISSUE out of MAIN_STORE per line, reservations
// CONSUMED, SOUT-<CO>-000001 assigned (stated on the confirm drawer and in the result alert).
// API over Figma:
//   - Item code (CMP-…) isn't on any outward read: the line shows the order line description (OUT-1).
//   - "not tracked" serials: the API doesn't say which items are serial-tracked (OUT-3); a picked line with no serials
//     shows "not tracked" because the server refuses a serial-tracked pick without them.
//   - Cancel reason (51981): POST /sales-outwards/:id/cancel takes no body → GapNote OUT-2, no input.
//   - Tracking "Dispatched · Ravi Kumar": the dispatcher is an id only → "Dispatched" + time.
//   - Pick checks (51250…) are the operator's confirmations; they're sent as the verification_note text.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { IconAlertTriangle, IconCamera, IconCheck, IconFileOff, IconLock, IconPlus, IconSquare, IconX } from '@tabler/icons-react';
import { apiStatus } from '../../../api/http';
import { enumLabel, formatDateTime, formatQty } from '../../../lib/format';
import {
  Badge, Button, DateField, Drawer, EmptyState, ErrorState, FormErrors, GapNote, GatedAction, Ic, InlineAlert, PageContent,
  PageHeader, PhotoPicker, StateCard, StatusPill, TextAreaField, TextInput, cx, errorBody, type PickedFile,
} from '../../../ui/desktop';
import { purchaseApi } from '../../purchase/api';
import {
  PACKING_EVIDENCE_KINDS, supplyApi, useOutward, useSupplyMutation, type DispatchOutwardBody, type OutwardDetail, type OutwardLine,
  type PackingEvidenceBody, type PackingEvidenceKind, type PickBody, type TrackingEventBody,
} from '../api';
import { isPodBlocked, latestDelivery, lineLabel, useOutwardContext, type LineInfo } from './data';
import { PodDrawer } from './PodDrawer';
import { T } from './text';
import { Bars, CardHead, DetailRow, HeadRow, KVBox, OpenQuestion, OptionChips, PanelHead, SplitCard, Td, Th } from './ui';

const W = { qty: 70, serials: 150, evidence: 110, status: 130 };
type Banner = { title: string; body: ReactNode };

export function OutwardDetailPage() {
  const { id = '' } = useParams();
  const q = useOutward(id);
  if (q.isPending) return <DetailSkeleton />;
  if (q.isError) {
    const notFound = apiStatus(q.error) === 404;
    return (
      <>
        <PageHeader title="Outward" />
        <PageContent>
          <StateCard>
            {notFound
              ? <EmptyState icon={IconFileOff} title="Outward not found" body={<>It may belong to another company. <Link className="underline" to="/p/supply/outwards">Back to outwards</Link></>} />
              : <ErrorState title="Couldn't load the outward" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />}
          </StateCard>
        </PageContent>
      </>
    );
  }
  return <Detail o={q.data} />;
}

function Detail({ o }: { o: OutwardDetail }) {
  const loc = useLocation();
  const nav = useNavigate();
  const ctx = useOutwardContext(o);
  const [picked, setPicked] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(() =>
    (loc.state as { created?: boolean } | null)?.created
      ? { title: 'Draft outward created', body: 'Pick each line, add packing evidence, then dispatch. The SOUT number is assigned at dispatch.' }
      : null);
  const [drawer, setDrawer] = useState<null | 'dispatch' | 'cancel' | 'event' | 'pod'>(null);
  // Drop the one-shot "created" flag so a reload doesn't show the banner again.
  useEffect(() => {
    if ((loc.state as { created?: boolean } | null)?.created) nav(loc.pathname, { replace: true, state: null });
  }, [loc.pathname, loc.state, nav]);

  const draft = o.status === 'DRAFT';
  const total = o.lines.length;
  const pickedN = o.lines.filter((l) => l.status !== 'DRAFT').length;
  const evidencedN = o.lines.filter((l) => l.packing_evidence.length > 0).length;
  const defaultLine = o.lines.find((l) => l.status === 'DRAFT') ?? o.lines.find((l) => l.packing_evidence.length === 0) ?? o.lines[0];
  const selected = o.lines.find((l) => l.id === picked) ?? defaultLine ?? null;
  const podPending = o.lines.filter((l) => l.status === 'DISPATCHED' && !isPodBlocked(l));
  const podBlocked = o.lines.filter(isPodBlocked);

  const customer = ctx.customerName ?? 'Customer';
  const orders = ctx.orderNumbers.join(', ');
  const allDelivered = total > 0 && o.lines.every((l) => l.status === 'DELIVERED');
  const lastDelivered = o.lines.flatMap((l) => l.delivery_evidence).map((d) => d.delivered_at).filter(Boolean).sort().pop();
  const title = o.status === 'DISPATCHED' ? o.outward_number ?? 'Outward'
    : o.status === 'DRAFT' ? `Draft outward · ${customer}` : `${o.outward_number ?? 'Cancelled outward'} · ${customer}`;
  const meta = allDelivered
    ? [orders, `delivered ${formatDateTime(lastDelivered)}`]
    : [orders, enumLabel(o.dispatch_mode), o.carrier_name,
      o.status === 'DISPATCHED' ? `dispatched ${formatDateTime(o.dispatched_at)}`
        : o.status === 'DRAFT' ? 'number assigned at dispatch' : `cancelled ${formatDateTime(o.cancelled_at)}`];

  return (
    <>
      <PageHeader title={title} meta={meta.filter(Boolean).join(' · ')} />
      <PageContent className="min-h-[808px]">
        {banner && <InlineAlert tone="success" title={banner.title}>{banner.body}</InlineAlert>}
        <div className="flex min-h-[640px] w-full flex-1 items-stretch gap-[20px]">
          <SplitCard className="min-w-px flex-1">
            <CardHead right={<StatusPill domain="supplyOutward" value={o.status} />}>{o.outward_number ?? (draft ? 'Draft outward' : 'Outward')}</CardHead>
            <div className="flex w-full flex-col">
              <HeadRow>
                <Th grow>Item</Th><Th w={W.qty} right>Qty</Th><Th w={W.serials}>Serials</Th><Th w={W.evidence}>Evidence</Th><Th w={W.status}>Line status</Th>
              </HeadRow>
              {o.lines.map((l) => (
                <LineRow key={l.id} l={l} info={ctx.lines[l.sales_order_line_id]} selected={draft && l.id === selected?.id} onSelect={draft ? () => setPicked(l.id) : undefined} />
              ))}
            </div>
            <KVBox rows={[
              ['Recipient', o.recipient_name],
              ['Destination', o.destination_address],
              ['Mode · carrier', [enumLabel(o.dispatch_mode), o.carrier_name ?? o.dispatch_mode_note].filter(Boolean).join(' · ')],
              ['Tracking', o.tracking_reference ? [o.carrier_name, o.tracking_reference].filter(Boolean).join(' · ') : '—'],
            ]} />
            {o.status !== 'DRAFT' && <StockMovement o={o} lines={ctx.lines} />}
            {podBlocked.length > 0 && (
              <>
                <InlineAlert tone="blocked" icon={IconAlertTriangle} title={`Next step BLOCKED · ${podBlocked.length} ${podBlocked.length === 1 ? 'line' : 'lines'} ${podBlocked.map((l) => latestDelivery(l)?.delivery_status).filter((v, i, a) => a.indexOf(v) === i).join(' / ')}`}>
                  {podBlocked.map((l) => lineLabel(l, ctx.lines[l.sales_order_line_id])).join(', ')}: the POD is recorded, but re-dispatch, return to stock or
                  credit note for FAILED / DAMAGED lines is not decided. These lines can't reach DELIVERED, so the order can't close yet.
                </InlineAlert>
                <OpenQuestion code="G20">POD FAILED / DAMAGED path (re-dispatch vs return to stock vs credit note) is not decided.</OpenQuestion>
              </>
            )}
          </SplitCard>

          <SplitCard className="w-[460px] shrink-0">
            {o.status === 'CANCELLED' ? (
              <>
                <PanelHead>Cancelled</PanelHead>
                <p className="text-[14px] leading-[20px] text-fg-2">Cancelled {formatDateTime(o.cancelled_at)} before dispatch. Nothing left the store; the reservations stay CONFIRMED on the order.</p>
                <div className="min-h-px w-px flex-1" />
                <Button kind="secondary" block onClick={() => nav('/p/supply/outwards')}>Back to outwards</Button>
              </>
            ) : o.status === 'DISPATCHED' ? (
              <TrackingPanel o={o} lines={ctx.lines} canPod={podPending.length > 0} onEvent={() => setDrawer('event')} onPod={() => setDrawer('pod')} />
            ) : selected && selected.status === 'DRAFT' ? (
              <PickPanel key={selected.id} line={selected} index={o.lines.indexOf(selected) + 1} info={ctx.lines[selected.sales_order_line_id]}
                onPicked={() => { const next = o.lines.find((l) => l.status === 'DRAFT' && l.id !== selected.id); setPicked(next?.id ?? selected.id); }} />
            ) : selected ? (
              <PackingPanel
                key={selected.id}
                line={selected}
                index={o.lines.indexOf(selected) + 1}
                ready={pickedN === total && evidencedN === total}
                reason={pickedN < total ? `Pick every line first (${pickedN} of ${total})` : `Add packing evidence to every line (${evidencedN} of ${total})`}
                readyNote={`Evidence on all ${total} ${total === 1 ? 'line' : 'lines'} — ready to dispatch`}
                onDispatch={() => setDrawer('dispatch')}
                onCancel={() => setDrawer('cancel')}
              />
            ) : <p className="text-[14px] leading-[20px] text-fg-2">This outward has no lines.</p>}
          </SplitCard>
        </div>
      </PageContent>

      {drawer === 'dispatch' && (
        <DispatchDrawer o={o} customer={customer} onClose={() => setDrawer(null)} onDone={(d) => {
          setDrawer(null);
          setBanner({ title: `Dispatched · ${d.outward_number ?? ''}`, body: 'Stock ISSUE posted out of MAIN STORE. Reservations CONSUMED.' });
        }} />
      )}
      {drawer === 'cancel' && (
        <CancelDrawer o={o} customer={customer} onClose={() => setDrawer(null)} onDone={() => {
          setDrawer(null);
          setBanner({ title: 'Outward cancelled', body: 'Nothing left the store. The reservations stay CONFIRMED on the order.' });
        }} />
      )}
      {drawer === 'event' && <TrackingEventDrawer o={o} onClose={() => setDrawer(null)} />}
      {drawer === 'pod' && (
        <PodDrawer o={o} lines={podPending} info={ctx.lines} onClose={() => setDrawer(null)} onDone={(r) => {
          setDrawer(null);
          setBanner({
            title: 'Proof of delivery saved',
            body: r.blocked > 0
              ? `${r.delivered} ${r.delivered === 1 ? 'line' : 'lines'} DELIVERED, ${r.blocked} FAILED / DAMAGED — next step BLOCKED (open decision G20).`
              : `${r.delivered} ${r.delivered === 1 ? 'line' : 'lines'} DELIVERED.${orders ? ` Order ${orders} updates delivered qty.` : ''}`,
          });
        }} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- table
function LineRow({ l, info, selected, onSelect }: { l: OutwardLine; info?: LineInfo; selected: boolean; onSelect?: () => void }) {
  const ev = l.packing_evidence;
  const latestEv = [...ev].sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
  const pod = latestDelivery(l);
  const serials = l.serial_numbers?.length ? l.serial_numbers.join(', ') : l.status === 'DRAFT' ? '—' : 'not tracked';
  return (
    <DetailRow selected={selected} onSelect={onSelect}>
      <Td grow><span className={T.strong}>{lineLabel(l, info)}</span></Td>
      <Td w={W.qty} right><span className={T.num}>{formatQty(l.outward_qty, l.uom)}</span></Td>
      <Td w={W.serials}><span className={T.text} title={serials}>{serials}</span></Td>
      <Td w={W.evidence}>
        {latestEv ? <span title={`${ev.length} evidence ${ev.length === 1 ? 'file' : 'files'}`}><Badge tone="success" label={enumLabel(latestEv.evidence_kind)} /></span>
          : <span className={T.text}>—</span>}
      </Td>
      <Td w={W.status}>
        {pod && pod.delivery_status !== 'DELIVERED' && l.status !== 'DELIVERED'
          ? <StatusPill domain="supplyDelivery" value={pod.delivery_status} />
          : <StatusPill domain="supplyOutwardLine" value={l.status} />}
      </Td>
    </DetailRow>
  );
}

function StockMovement({ o, lines }: { o: OutwardDetail; lines: Record<string, LineInfo> }) {
  const issued = o.lines.filter((l) => l.inventory_issue_ref);
  if (issued.length === 0) return null;
  return (
    <div className="flex w-full flex-col items-start gap-[10px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px]">
      <div className="flex w-full items-center gap-[10px]">
        <p className="min-w-px flex-1 text-[14px] font-semibold leading-[20px] text-fg">Stock movement posted</p>
        <Badge tone="success" label="ISSUE" />
      </div>
      {issued.map((l) => (
        <div key={l.id} className="flex w-full items-start gap-[10px] text-[13px] leading-[18px]">
          <p className="min-w-px flex-1 truncate text-fg-2">MAIN STORE → customer · {lineLabel(l, lines[l.sales_order_line_id])}</p>
          <p className="shrink-0 whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">−{formatQty(l.outward_qty, l.uom)}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- pick
function PickPanel({ line, index, info, onPicked }: { line: OutwardLine; index: number; info?: LineInfo; onPicked: () => void }) {
  const desc = lineLabel(line, info);
  const qty = formatQty(line.outward_qty, line.uom);
  const checks = [`Item matches ${desc}`, 'Part number on the label checked', `Qty ${qty} counted`];
  const [done, setDone] = useState<boolean[]>([false, false, false]);
  const [serials, setSerials] = useState('');
  const [note, setNote] = useState('');
  const pick = useSupplyMutation((b: PickBody) => supplyApi.pick(line.id, b));
  const list = serials.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  const ready = done.every(Boolean);

  const submit = () => pick.mutate({
    verification_note: [...checks, note.trim()].filter(Boolean).join('; '),
    serial_numbers: list.length ? list : undefined,
  }, { onSuccess: onPicked });

  return (
    <>
      <PanelHead>Pick · line {index}</PanelHead>
      {checks.map((c, i) => (
        <button
          key={c}
          type="button"
          role="checkbox"
          aria-checked={done[i]}
          onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
          className="flex w-full items-center gap-[10px] overflow-clip rounded-[12px] bg-subtle px-[14px] py-[10px] text-left"
        >
          <Ic icon={done[i] ? IconCheck : IconSquare} size={16} className={done[i] ? 'text-fg' : 'text-fg-muted'} />
          <span className="min-w-0 truncate text-[14px] leading-[20px] text-fg">{c}</span>
        </button>
      ))}
      <TextInput
        label="Serial numbers"
        value={serials}
        onChange={(e) => setSerials(e.target.value)}
        mono
        placeholder="One per unit, comma separated"
        helper={list.length ? `${list.length} entered · ${qty} on this line` : 'Required for serial-tracked items (one per unit); leave empty otherwise'}
      />
      <TextAreaField label="Verification note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else checked (optional)" />
      <GapNote code="OUT-3">The outward read doesn't say whether this item is serial-tracked; the server refuses a pick of a serial-tracked item without one serial per unit.</GapNote>
      <FormErrors error={pick.error} title="The line wasn't picked" />
      <div className="min-h-px w-px flex-1" />
      {!ready && <p className="text-[12px] leading-[16px] text-fg-2">Tick all three checks to mark this line picked.</p>}
      <Button block disabled={!ready} busy={pick.isPending} icon={<Ic icon={IconCheck} size={18} />} onClick={submit}>Mark picked</Button>
    </>
  );
}

// ---------------------------------------------------------------- packing evidence + dispatch gate
type Pending = PickedFile & { file: File; kind: PackingEvidenceKind };
const ACCEPT: Record<PackingEvidenceKind, string> = {
  PHOTO: 'image/jpeg,image/png,image/webp,image/heic,image/heif',
  SERIAL_LABEL: 'image/jpeg,image/png,image/webp,image/heic,image/heif',
  VIDEO: 'video/mp4,video/quicktime',
  PACKING_LIST: 'image/jpeg,image/png,image/webp,application/pdf',
  OTHER: 'image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,application/pdf',
};
const HINT: Record<PackingEvidenceKind, string> = {
  PHOTO: 'JPG or PNG · Use camera on tablet', SERIAL_LABEL: 'Photo of the serial label', VIDEO: 'MP4 or MOV',
  PACKING_LIST: 'Photo or PDF of the packing list', OTHER: 'Photo, video or PDF',
};

function PackingPanel({ line, index, ready, reason, readyNote, onDispatch, onCancel }: {
  line: OutwardLine; index: number; ready: boolean; reason: string; readyNote: string; onDispatch: () => void; onCancel: () => void;
}) {
  const add = useSupplyMutation((b: PackingEvidenceBody) => supplyApi.addPackingEvidence(line.id, b));
  const [kind, setKind] = useState<PackingEvidenceKind>('PHOTO');
  const [pending, setPending] = useState<Pending[]>([]);
  const previews = useRef(new Map<string, string>());
  const camera = useRef<HTMLInputElement>(null);

  const upload = async (p: Pending) => {
    const set = (patch: Partial<Pending>) => setPending((s) => s.map((x) => (x.key === p.key ? { ...x, ...patch } : x)));
    set({ state: 'uploading', progress: 0 });
    try {
      const up = await purchaseApi.upload(p.file, (pct) => set({ progress: pct }));
      await add.mutateAsync({ evidence_kind: p.kind, file_uri: up.file_uri, file_name: up.original_name });
      if (p.previewUrl) previews.current.set(up.file_uri, p.previewUrl);
      setPending((s) => s.filter((x) => x.key !== p.key));
    } catch {
      set({ state: 'failed' });
    }
  };
  const addFiles = (files: File[]) => {
    const fresh: Pending[] = files.map((file) => ({
      key: crypto.randomUUID(), name: file.name, file, kind,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined, state: 'uploading', progress: 0,
    }));
    setPending((s) => [...s, ...fresh]);
    fresh.forEach(upload);
  };
  const retry = () => pending.filter((p) => p.state === 'failed').forEach(upload);
  const shown: PickedFile[] = [
    ...line.packing_evidence.map((e) => ({ key: e.id, name: `${enumLabel(e.evidence_kind)} · ${e.file_name}`, previewUrl: previews.current.get(e.file_uri), state: 'uploaded' as const })),
    ...pending,
  ];

  return (
    <>
      <PanelHead>Packing evidence · line {index}</PanelHead>
      <OptionChips label="Evidence kind *" value={kind} options={PACKING_EVIDENCE_KINDS} onChange={setKind} />
      <PhotoPicker title={kind === 'PHOTO' ? 'Packing photo' : 'Packing evidence'} required files={shown} onFiles={addFiles} onRetry={retry} accept={ACCEPT[kind]} hint={HINT[kind]} />
      <input
        ref={camera}
        type="file"
        accept={ACCEPT[kind]}
        capture="environment"
        hidden
        onChange={(e) => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value = ''; }}
      />
      <div className="min-h-px w-px flex-1" />
      <GatedAction
        ready={ready}
        reason={reason}
        readyNote={readyNote}
        secondaryLabel={ready ? undefined : 'Add evidence'}
        secondaryIcon={IconCamera}
        onSecondary={() => camera.current?.click()}
        primaryLabel="Dispatch outward"
        onPrimary={onDispatch}
      />
      <Button kind="ghost" block icon={<Ic icon={IconX} size={18} />} onClick={onCancel}>Cancel outward</Button>
    </>
  );
}

// ---------------------------------------------------------------- dispatched: tracking
type TimelineItem = { key: string; title: string; sub: string; at: string; tone: 'success' | 'progress' | 'neutral' | 'blocked' };
const DOT: Record<TimelineItem['tone'], string> = { success: 'bg-st-success-fg', progress: 'bg-st-progress-fg', neutral: 'bg-fg-2', blocked: 'bg-st-blocked-fg' };

function TrackingPanel({ o, lines, canPod, onEvent, onPod }: { o: OutwardDetail; lines: Record<string, LineInfo>; canPod: boolean; onEvent: () => void; onPod: () => void }) {
  const items: TimelineItem[] = [
    ...o.tracking_events.map((e) => ({
      key: e.id, title: e.status_note, sub: [o.carrier_name, e.provider_event_ref, formatDateTime(e.occurred_at)].filter(Boolean).join(' · '), at: e.occurred_at, tone: 'progress' as const,
    })),
    ...o.lines.flatMap((l) => l.delivery_evidence.map((d) => ({
      key: d.id,
      title: d.delivery_status === 'DELIVERED' ? `Delivered · POD recorded · ${lineLabel(l, lines[l.sales_order_line_id])}` : `${d.delivery_status} · ${lineLabel(l, lines[l.sales_order_line_id])}`,
      sub: [d.received_by_name, formatDateTime(d.delivered_at ?? d.created_at), d.remarks].filter(Boolean).join(' · '),
      at: d.delivered_at ?? d.created_at,
      tone: d.delivery_status === 'DELIVERED' ? 'success' as const : 'blocked' as const,
    }))),
    ...(o.dispatched_at ? [{ key: 'dispatched', title: 'Dispatched', sub: formatDateTime(o.dispatched_at), at: o.dispatched_at, tone: 'neutral' as const }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <PanelHead right={<Button kind="secondary" icon={<Ic icon={IconPlus} size={18} />} onClick={onEvent}>Add event</Button>}>Tracking</PanelHead>
      <ol className="flex w-full flex-col">
        {items.map((it, i) => (
          <li key={it.key} className="flex w-full items-stretch gap-[12px]">
            <div className="flex w-[10px] shrink-0 flex-col items-center">
              <span className={cx('mt-[5px] h-[10px] w-[10px] shrink-0 rounded-full', DOT[it.tone])} />
              {i < items.length - 1 && <span className="w-px flex-1 bg-line" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[2px] pb-[18px]">
              <p className="text-[14px] font-medium leading-[20px] text-fg">{it.title}</p>
              <p className="text-[12px] leading-[16px] text-fg-2">{it.sub}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="min-h-px w-px flex-1" />
      <div className="flex w-full items-center gap-[8px] overflow-clip rounded-[12px] bg-subtle px-[12px] py-[8px]">
        <Ic icon={IconLock} size={14} className="text-fg-2" />
        <p className="text-[12px] leading-[16px] text-fg-2">Dispatched outwards are read-only.</p>
      </div>
      {canPod && <Button block icon={<Ic icon={IconCheck} size={18} />} onClick={onPod}>Record proof of delivery</Button>}
    </>
  );
}

// ---------------------------------------------------------------- drawers
function DispatchDrawer({ o, customer, onClose, onDone }: { o: OutwardDetail; customer: string; onClose: () => void; onDone: (d: OutwardDetail) => void }) {
  const [tracking, setTracking] = useState(o.tracking_reference ?? '');
  const m = useSupplyMutation((b: DispatchOutwardBody) => supplyApi.dispatchOutward(o.id, b));
  const n = o.lines.length;
  return (
    <Drawer
      open
      onClose={onClose}
      busy={m.isPending}
      title="Dispatch outward"
      subtitle={`${customer} · ${n} ${n === 1 ? 'line' : 'lines'}`}
      onSubmit={() => m.mutate({ tracking_reference: tracking.trim() || undefined }, { onSuccess: onDone })}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose} disabled={m.isPending}>Not yet</Button>
          <Button type="submit" busy={m.isPending}>Dispatch outward</Button>
        </>
      )}
    >
      <InlineAlert tone="progress" title="This posts real stock movement">
        Dispatch posts a stock-ledger ISSUE out of MAIN STORE for every line, consumes the reservations and assigns the
        SOUT number. A dispatched outward can't be cancelled.
      </InlineAlert>
      <TextInput label="Tracking reference" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Add after booking" mono />
      <FormErrors error={m.error} title="The outward wasn't dispatched" />
    </Drawer>
  );
}

function CancelDrawer({ o, customer, onClose, onDone }: { o: OutwardDetail; customer: string; onClose: () => void; onDone: () => void }) {
  const m = useSupplyMutation(() => supplyApi.cancelOutward(o.id));
  return (
    <Drawer
      open
      onClose={onClose}
      busy={m.isPending}
      title="Cancel outward"
      subtitle={`Draft outward · ${customer}`}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose} disabled={m.isPending}>Keep</Button>
          <Button kind="danger" busy={m.isPending} icon={<Ic icon={IconX} size={18} />} onClick={() => m.mutate(undefined, { onSuccess: onDone })}>Cancel outward</Button>
        </>
      )}
    >
      <InlineAlert tone="neutral" title="Before dispatch only">Reservations stay CONFIRMED on the order; nothing leaves the store.</InlineAlert>
      <GapNote code="OUT-2">Reason: POST /sales-outwards/:id/cancel takes no body, so a cancel reason can't be recorded.</GapNote>
      <FormErrors error={m.error} title="The outward wasn't cancelled" />
    </Drawer>
  );
}

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function TrackingEventDrawer({ o, onClose }: { o: OutwardDetail; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [at, setAt] = useState(nowLocal);
  const [ref, setRef] = useState('');
  const [tried, setTried] = useState(false);
  const m = useSupplyMutation((b: TrackingEventBody) => supplyApi.addTrackingEvent(o.id, b));
  const submit = () => {
    setTried(true);
    if (!note.trim() || !at) return;
    m.mutate({ status_note: note.trim(), occurred_at: new Date(at).toISOString(), provider_event_ref: ref.trim() || undefined }, { onSuccess: onClose });
  };
  return (
    <Drawer
      open
      onClose={onClose}
      busy={m.isPending}
      title="Add tracking event"
      subtitle={[o.outward_number, o.carrier_name, o.tracking_reference].filter(Boolean).join(' · ')}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose} disabled={m.isPending}>Cancel</Button>
          <Button type="submit" busy={m.isPending} icon={<Ic icon={IconPlus} size={18} />}>Add event</Button>
        </>
      )}
    >
      <TextInput label="Status *" value={note} onChange={(e) => setNote(e.target.value)} placeholder="In transit · Hosur hub" error={tried && !note.trim() ? 'Required' : null} />
      <DateField label="When *" withTime value={at} onChange={(e) => setAt(e.target.value)} error={tried && !at ? 'Required' : null} />
      <TextInput label="Carrier event reference" value={ref} onChange={(e) => setRef(e.target.value)} mono />
      <FormErrors error={m.error} title="The event wasn't added" />
    </Drawer>
  );
}

function DetailSkeleton() {
  return (
    <>
      <PageHeader title="Outward" meta=" " />
      <PageContent className="min-h-[808px]">
        <div role="status" aria-label="Loading" className="flex min-h-[808px] w-full flex-1 items-stretch gap-[20px]">
          <SplitCard className="min-w-px flex-1"><Bars widths={[160, 620, 560, 580, 420]} /></SplitCard>
          <SplitCard className="w-[460px] shrink-0"><Bars widths={[140, 380, 380, 300]} /></SplitCard>
        </div>
      </PageContent>
    </>
  );
}
