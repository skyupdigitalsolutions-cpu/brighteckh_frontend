// STG1–STG7 · GRN detail (177:139493 … 177:139902). Data: GET /stores/grns/:id. Writes: POST /uploads →
// POST /grn-lines/:id/media (photo gate), POST /grn-lines/:id/post (disposition → ledger).
// Layout: optional success alert (177:139497), then "Split" (gap 20): GRN card (flex-1) + right card (480).
//   GRN card 177:139499: glass-strong r24 p24 gap14 — title + GRN badge, inner table (Item grow · Received 90 ·
//   Accepted 90 · Rejected 90 · Held 80 · Status 150), "Quantities only" note, "Posted lines are final." once posted.
//   Right card, unposted line selected → "Inspect & post · line n" (STG1/2/3/5): Photo capture, Accept/Reject/Hold
//   qty boxes (h44 r12 bg-subtle 1px border-strong, Data/Number strong; 2px danger stroke when totals exceed),
//   allocation helper, then Gated action (blocked: "Add a photo to continue" + Take photo + disabled Post line;
//   ready: "n photos attached" + Add another photo + Post line) or, when totals exceed, the blocked alert + a
//   full-width disabled Post line (STG3).
//   Posted line selected → "Posted" (STG4): Accepted → MAIN STORE / Rejected / Held → QUARANTINE / Posted by.
//   Whole GRN posted, nothing picked → summary (STG6/STG7).
// Photo gate: server truth (line.media from the API); every photo uploads immediately. The DB trigger also refuses a
// post without a photo, and the server refuses accepted + rejected + held > received.
// API over Figma:
//   - Rejected stock goes to QUARANTINE with held stock (the post endpoint moves rejected + held to QUARANTINE; supplier
//     return is a later Purchase action). Figma's "rejected → supplier return" helper copy is replaced.
//   - "Hold reason" (STG5) has no API field (PostGrnLineDto = three quantities) — GapNote GRN-2, no input.
//   - "View quarantine" (STG6) → "Back to GRNs": the Quarantine screen is not built.
//   - Added: the ledger movements each posted line produced (scope: "show the resulting stock movement").
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { IconAlertTriangle, IconCamera, IconFileOff, IconLock } from '@tabler/icons-react';
import { apiStatus } from '../../../api/http';
import { formatDayTime, formatQty } from '../../../lib/format';
import {
  Badge, Button, EmptyState, ErrorState, FormErrors, GapNote, GatedAction, Ic, InlineAlert, PageContent, PageHeader,
  PhotoPicker, StateCard, cx, errorBody, type PickedFile,
} from '../../../ui/desktop';
import { purchaseApi } from '../../purchase/api';
import { num, useAddLineMedia, useGrn, usePostLine, type LedgerMovement, type StoresGrnDetail, type StoresGrnLine } from '../api';
import { CardTitle, GrnBadge, ItemCell, KV, LockedQty, PricesNote, StoresCard } from '../ui';

type Banner = { title: string; body: ReactNode };
const COLS = { qty: 90, held: 80, status: 150 };

export function GrnDetailPage() {
  const { grnId = '' } = useParams();
  const q = useGrn(grnId);

  if (q.isPending) return <DetailSkeleton />;
  if (q.isError) {
    const notFound = apiStatus(q.error) === 404;
    return (
      <>
        <PageHeader title="GRN" />
        <PageContent>
          <StateCard>
            {notFound
              ? <EmptyState icon={IconFileOff} title="GRN not found" body={<>It may belong to another company. <Link className="underline" to="/st/grns">Back to GRNs</Link></>} />
              : <ErrorState title="Couldn't load the GRN" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />}
          </StateCard>
        </PageContent>
      </>
    );
  }
  return <GrnDetail grn={q.data} />;
}

function GrnDetail({ grn }: { grn: StoresGrnDetail }) {
  const loc = useLocation();
  const nav = useNavigate();
  const firstOpen = grn.lines.find((l) => !l.posted_at)?.id ?? null;
  // Picked by the user (or the line just posted); null = follow the first unposted line / GRN summary.
  const [picked, setPicked] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(() => {
    const created = (loc.state as { created?: boolean } | null)?.created;
    if (!created) return null;
    const n = grn.lines.length;
    return { title: `${grn.grn_number} created`, body: `${n} ${n === 1 ? 'line' : 'lines'} to inspect. Add photos, then post accept / reject / hold.` };
  });
  // Drop the one-shot "created" flag so a reload doesn't show it again.
  useEffect(() => {
    if ((loc.state as { created?: boolean } | null)?.created) nav(loc.pathname, { replace: true, state: null });
  }, [loc.pathname, loc.state, nav]);

  const selectedId = picked ?? firstOpen;
  const selected = grn.lines.find((l) => l.id === selectedId) ?? null;
  const meta = [grn.po_number, grn.supplier_name, grn.notes].filter(Boolean).join(' · ');

  const onPosted = (line: StoresGrnLine, after: { accepted: number; rejected: number; held: number }) => {
    setPicked(line.id);
    const q = after.rejected + after.held;
    const remaining = grn.lines.filter((l) => !l.posted_at && l.id !== line.id).length;
    const moves = [after.accepted > 0 && `${formatQty(String(after.accepted), line.uom)} accepted → MAIN STORE`,
      q > 0 && `${formatQty(String(q), line.uom)} → QUARANTINE`].filter(Boolean).join(', ');
    if (remaining === 0 && grn.lines.length > 1) {
      setBanner({ title: `${grn.grn_number} complete`, body: `${line.item_name}: ${moves}.${q > 0 ? ' Purchase decides on the quarantined stock.' : ''}` });
    } else {
      const reserve = after.accepted > 0 && grn.job_number ? ` Purchase can now reserve it for ${grn.job_number}.` : '';
      setBanner({ title: 'Line posted', body: `${moves || 'Nothing allocated'}.${reserve}` });
    }
  };

  return (
    <>
      <PageHeader title={grn.grn_number} meta={meta} />
      <PageContent className="min-h-[808px]">
        {banner && <InlineAlert tone="success" title={banner.title}>{banner.body}</InlineAlert>}
        <div className="flex min-h-[640px] w-full flex-1 items-stretch gap-[20px]">
          <StoresCard className="min-w-px flex-1">
            <CardTitle right={<GrnBadge status={grn.grn_status} posted={grn.lines_posted} total={grn.lines_total} />}>{grn.grn_number}</CardTitle>
            <div className="flex w-full flex-col">
              <div role="row" className="flex w-full items-start gap-[12px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
                <Th grow>Item</Th><Th w={COLS.qty}>Received</Th><Th w={COLS.qty}>Accepted</Th><Th w={COLS.qty}>Rejected</Th>
                <Th w={COLS.held}>Held</Th><Th w={COLS.status}>Status</Th>
              </div>
              {grn.lines.map((l) => (
                <LineRow key={l.id} l={l} selected={l.id === picked || (picked === null && l.id === firstOpen)} onSelect={() => setPicked(l.id)} />
              ))}
            </div>
            <PricesNote />
            {grn.lines_posted > 0 && (
              <div className="flex w-full items-center gap-[8px] overflow-clip">
                <Ic icon={IconLock} size={14} className="text-fg-2" />
                <p className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">Posted lines are final.</p>
              </div>
            )}
          </StoresCard>

          <StoresCard className="w-[480px] shrink-0">
            {selected && !selected.posted_at
              ? <InspectPanel key={selected.id} line={selected} onPosted={onPosted} />
              : selected ? <PostedLinePanel line={selected} onBack={() => nav('/st/grns')} />
                : <GrnSummaryPanel grn={grn} onBack={() => nav('/st/grns')} />}
          </StoresCard>
        </div>
      </PageContent>
    </>
  );
}

// ---------------------------------------------------------------- GRN table pieces
function Th({ w, grow, children }: { w?: number; grow?: boolean; children: ReactNode }) {
  return (
    <div role="columnheader" className={cx('flex items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0')} style={grow ? undefined : { width: w }}>
      <span className="whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{children}</span>
    </div>
  );
}
function Td({ w, grow, children }: { w?: number; grow?: boolean; children: ReactNode }) {
  return <div role="cell" className={cx('flex items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0')} style={grow ? undefined : { width: w }}>{children}</div>;
}
const Dash = () => <span className="font-mono text-[14px] leading-[20px] text-fg-muted">—</span>;

function LineRow({ l, selected, onSelect }: { l: StoresGrnLine; selected: boolean; onSelect: () => void }) {
  const posted = !!l.posted_at;
  return (
    <button
      type="button"
      role="row"
      aria-selected={selected}
      onClick={onSelect}
      className={cx(
        'flex w-full items-center gap-[12px] overflow-clip px-[14px] py-[12px] text-left',
        selected ? 'rounded-[16px] border border-brand-border bg-brand-subtle' : 'border-b border-line hover:bg-surface',
      )}
    >
      <Td grow><ItemCell code={l.item_code} name={l.item_name} /></Td>
      <Td w={COLS.qty}><span className="whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg">{formatQty(l.received_quantity, l.uom)}</span></Td>
      <Td w={COLS.qty}>{posted ? <LockedQty value={l.accepted_quantity} /> : <Dash />}</Td>
      <Td w={COLS.qty}>{posted ? <LockedQty value={l.rejected_quantity} /> : <Dash />}</Td>
      <Td w={COLS.held}>{posted ? <LockedQty value={l.held_quantity} /> : <Dash />}</Td>
      <Td w={COLS.status}>{posted ? <Badge tone="success" label="POSTED" /> : <Badge tone="neutral" label="TO INSPECT" />}</Td>
    </button>
  );
}

// ---------------------------------------------------------------- inspect & post
type Pending = PickedFile & { file: File };

function InspectPanel({ line, onPosted }: { line: StoresGrnLine; onPosted: (l: StoresGrnLine, q: { accepted: number; rejected: number; held: number }) => void }) {
  const addMedia = useAddLineMedia();
  const post = usePostLine();
  const camera = useRef<HTMLInputElement>(null);
  const previews = useRef(new Map<string, string>()); // file_uri -> object URL of a photo taken in this session
  const [pending, setPending] = useState<Pending[]>([]);
  const received = num(line.received_quantity);
  const [acc, setAcc] = useState(formatQty(line.received_quantity).replace(/,/g, ''));
  const [rej, setRej] = useState('0');
  const [hold, setHold] = useState('0');

  useEffect(() => () => { previews.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const upload = async (p: Pending) => {
    const set = (patch: Partial<Pending>) => setPending((s) => s.map((x) => (x.key === p.key ? { ...x, ...patch } : x)));
    set({ state: 'uploading', progress: 0 });
    try {
      const up = await purchaseApi.upload(p.file, (pct) => set({ progress: pct }));
      await addMedia.mutateAsync({ lineId: line.id, file_uri: up.file_uri, file_name: up.original_name });
      if (p.previewUrl) previews.current.set(up.file_uri, p.previewUrl);
      setPending((s) => s.filter((x) => x.key !== p.key));
    } catch {
      set({ state: 'failed' });
    }
  };
  const addFiles = (files: File[]) => {
    const fresh: Pending[] = files.map((file) => ({
      key: crypto.randomUUID(), name: file.name, file, previewUrl: URL.createObjectURL(file), state: 'uploading', progress: 0,
    }));
    setPending((s) => [...s, ...fresh]);
    fresh.forEach(upload);
  };
  const retry = () => pending.filter((p) => p.state === 'failed').forEach(upload);

  const shown: PickedFile[] = [
    ...line.media.map((m) => ({ key: m.id, name: m.file_name, previewUrl: previews.current.get(m.file_uri), state: 'uploaded' as const })),
    ...pending,
  ];
  const photos = line.media.length; // server truth

  const parse = (s: string) => (s.trim() === '' ? NaN : Number(s));
  const a = parse(acc); const r = parse(rej); const h = parse(hold);
  const invalid = [a, r, h].some((x) => !Number.isFinite(x) || x < 0);
  const total = invalid ? 0 : a + r + h;
  const exceeds = !invalid && total > received;
  const unallocated = !invalid && !exceeds ? received - total : 0;
  const uom = line.uom;

  const submit = () => post.mutate(
    { lineId: line.id, accepted_quantity: a, rejected_quantity: r, held_quantity: h },
    { onSuccess: () => onPosted(line, { accepted: a, rejected: r, held: h }) },
  );

  return (
    <>
      <CardTitle>Inspect &amp; post · line {line.line_no}</CardTitle>
      <PhotoPicker title="Line photos *" required files={shown} onFiles={addFiles} onRetry={retry} />
      <input
        ref={camera}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        hidden
        onChange={(e) => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value = ''; }}
      />

      <div className="flex w-full items-start gap-[10px] overflow-clip">
        <QtyBox label="Accept" value={acc} onChange={setAcc} error={exceeds} />
        <QtyBox label="Reject" value={rej} onChange={setRej} error={exceeds} />
        <QtyBox label="Hold" value={hold} onChange={setHold} error={exceeds} />
      </div>

      {exceeds ? (
        <InlineAlert tone="blocked" icon={IconAlertTriangle} title="Totals exceed received">
          {formatQty(String(a))} accepted + {formatQty(String(r))} rejected + {formatQty(String(h))} held = {formatQty(String(total))}, but{' '}
          {formatQty(line.received_quantity, uom)} was received. Reduce one of them to post.
        </InlineAlert>
      ) : (
        <p className="text-[12px] leading-[16px] text-fg-2">
          {invalid ? 'Enter 0 or more in each box' : `${formatQty(String(total))} of ${formatQty(line.received_quantity)} received allocated`}
          {' · '}accepted → main store · rejected + held → quarantine
        </p>
      )}
      {!exceeds && !invalid && unallocated > 0 && total > 0 && (
        <InlineAlert tone="neutral" title={`${formatQty(String(unallocated), uom)} not allocated`}>
          Posted lines are final: unallocated quantity is not stocked anywhere.
        </InlineAlert>
      )}
      {!invalid && h > 0 && (
        <GapNote code="GRN-2">Hold reason: the post API takes quantities only, so a reason for held stock can't be recorded here.</GapNote>
      )}
      <FormErrors error={post.error} title="The line wasn't posted" />

      <div className="min-h-px w-px flex-1" />
      {exceeds || invalid || total === 0 ? (
        <div className="flex w-full flex-col gap-[12px]">
          {total === 0 && !invalid && !exceeds && (
            <p className="text-[12px] leading-[16px] text-fg-2">Allocate at least one unit to post this line.</p>
          )}
          <Button block disabled>Post line</Button>
        </div>
      ) : (
        <GatedAction
          ready={photos > 0}
          reason="Add a photo to continue"
          readyNote={`${photos} ${photos === 1 ? 'photo' : 'photos'} attached`}
          secondaryLabel={photos > 0 ? 'Add another photo' : 'Take photo'}
          secondaryIcon={IconCamera}
          onSecondary={() => camera.current?.click()}
          primaryLabel="Post line"
          busy={post.isPending}
          onPrimary={submit}
        />
      )}
    </>
  );
}

function QtyBox({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: boolean }) {
  return (
    <label className="flex min-w-px flex-1 flex-col items-start gap-[6px] overflow-clip">
      <span className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        aria-invalid={error || undefined}
        className={cx(
          'h-[44px] w-full rounded-t-field bg-subtle px-[12px] font-mono text-[14px] font-semibold leading-[20px] text-fg focus:outline-none',
          error ? 'border-2 border-danger' : 'border border-line-strong focus:ring-inside-brand',
        )}
      />
    </label>
  );
}

// ---------------------------------------------------------------- posted views
function PostedLinePanel({ line, onBack }: { line: StoresGrnLine; onBack: () => void }) {
  return (
    <>
      <CardTitle>Posted</CardTitle>
      <KV label="Accepted → MAIN STORE" value={formatQty(line.accepted_quantity, line.uom)} />
      <KV label="Rejected → QUARANTINE" value={formatQty(line.rejected_quantity, num(line.rejected_quantity) ? line.uom : null)} />
      <KV label="Held → QUARANTINE" value={formatQty(line.held_quantity, num(line.held_quantity) ? line.uom : null)} />
      <KV label="Posted by" value={`${line.posted_by_name ?? '—'} · ${formatDayTime(line.posted_at)}`} />
      <Movements movements={line.movements} />
      <div className="min-h-px w-px flex-1" />
      <Button kind="secondary" block onClick={onBack}>Back to GRNs</Button>
    </>
  );
}

function GrnSummaryPanel({ grn, onBack }: { grn: StoresGrnDetail; onBack: () => void }) {
  const sum = (k: 'accepted_quantity' | 'rejected_quantity' | 'held_quantity') => grn.lines.reduce((t, l) => t + num(l[k]), 0);
  const uoms = new Set(grn.lines.map((l) => l.uom));
  const uom = uoms.size === 1 ? grn.lines[0].uom : null; // mixed units can't be summed into one label
  const q = (n: number) => formatQty(String(n), n ? uom : null);
  const single = grn.lines.length === 1 ? grn.lines[0] : null;
  return (
    <>
      <CardTitle>Posted</CardTitle>
      {!single && <KV label="Lines posted" value={`${grn.lines_posted} of ${grn.lines_total}`} />}
      <KV label="Accepted → MAIN STORE" value={q(sum('accepted_quantity'))} />
      <KV label="Rejected → QUARANTINE" value={q(sum('rejected_quantity'))} />
      <KV label="Held → QUARANTINE" value={q(sum('held_quantity'))} />
      {single && <KV label="Posted by" value={`${single.posted_by_name ?? '—'} · ${formatDayTime(single.posted_at)}`} />}
      <Movements movements={grn.lines.flatMap((l) => l.movements)} />
      <div className="min-h-px w-px flex-1" />
      <Button kind="secondary" block onClick={onBack}>Back to GRNs</Button>
    </>
  );
}

/** The ledger rows the post produced (fdn_inventory_journal, reference = the GRN line). */
function Movements({ movements }: { movements: LedgerMovement[] }) {
  if (movements.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-[8px] border-t border-line pt-[14px]">
      <p className="text-[14px] font-medium leading-[20px] text-fg">Stock movement</p>
      {movements.map((m) => (
        <div key={m.id} className="flex w-full items-start gap-[8px] text-[14px] leading-[20px]">
          <div className="flex min-w-px flex-1 flex-col">
            <p className="text-fg-2">
              {m.movement_type.replace(/_/g, ' ')} → {m.to_location_role?.replace(/_/g, ' ') ?? '—'}
              {m.to_location_code && <span className="font-mono text-[13px] font-medium leading-[18px]"> · {m.to_location_code}</span>}
            </p>
            <p className="text-[12px] leading-[16px] text-fg-muted">{formatDayTime(m.posted_at)}{m.status !== 'POSTED' && ` · ${m.status}`}</p>
          </div>
          <p className="shrink-0 whitespace-nowrap font-medium text-fg">{formatQty(m.qty, m.uom)}</p>
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  const bar = (w: number) => <span className="block h-[12px] animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />;
  return (
    <>
      <PageHeader title="GRN" meta=" " />
      <PageContent className="min-h-[808px]">
        <div role="status" aria-label="Loading" className="flex min-h-[808px] w-full flex-1 items-stretch gap-[20px]">
          <StoresCard className="min-w-px flex-1">{bar(140)}{bar(520)}{bar(420)}</StoresCard>
          <StoresCard className="w-[480px] shrink-0">{bar(200)}{bar(380)}{bar(300)}</StoresCard>
        </div>
      </PageContent>
    </>
  );
}
