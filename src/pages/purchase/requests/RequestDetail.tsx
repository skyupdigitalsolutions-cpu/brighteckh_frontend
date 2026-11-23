// Requests · detail panel — Figma "Detail · MR-…" (177:118096 submitted, 177:118239 / 177:118668 edit window closed,
// 177:118382 / 177:118525 processing, 177:118811 closed, 177:119727 change request pending, 177:119101 accepted,
// 177:119254 rejected, 177:118957 started).
// Panel: glass-strong, radius 24, p-20, gap 14 (the card is the parent <section>; this renders its children).
//   Head: request no. Data/Timer small (mono 20/26 Medium) · priority flag · spacer · status badge.
//   Meta (gap 28): label 12/16 secondary over value — Job (mono 13/18, link) · Engineer 14/20 Medium · Needed by 14/20 Medium.
//   Edit window strip: radius 12, px-12 py-8, gap 8, 16px icon, 12/16. Open = warning bg + clock + warning fg;
//     locked / closed = subtle bg + lock + secondary text.
//   "Parts · n" Desktop/H3 15/20 SemiBold. Part row: subtle, radius 16, px-14 py-12, gap 12; code mono 13/18 secondary ·
//     name 14/20 Medium · preference 12/16 muted; right column (gap 4, end): qty Data/Number strong + badge.
//   Change request card: warning bg + 1px warning border, radius 16, px-16 py-14, gap 10; head 14/20 Medium warning fg +
//     status badge; change row (mono 13 code + mono 14 SemiBold "from → to"); reason 14/20 secondary in quotes; review
//     line 12/16 secondary; actions Reject (secondary, x) + Accept change (primary, check), both flex-1.
//   Footer: SUBMITTED = full-width primary "Start processing" (send); PROCESSING = full-width primary "Run stock check"
//     (cart); CHANGE_REQUESTED = hug secondary "Run stock check"; CLOSED = lock + "Closed requests are read-only" 12/16.
//
// DATA: header/meta from the inbox row (GET /purchase/material-requests); status, priority, dates, lines and change
// requests from GET /jobs/{id}/material-requests (the MR with this id). Names of change-request requesters / reviewers
// via GET /lookups/employees?ids=. "IN STORE" = fulfilment.allocatable_now (ledger, company-wide).
// Writes (PURCHASE only — hidden for other roles): start processing, change-request review (ACCEPTED / REJECTED).
// "Run stock check" navigates to the job's Sourcing tab (POST /jobs/{id}/stock-checks lives there).
//
// Deviations: the change row ("CMP-CAP-0470 2 NOS → 3 NOS") renders only when proposed_change has the shape
// {lines:[{line_id|item_code, from_qty?, to_qty}]}; any other JSON is shown raw (GapNote GAP-MR-2). Reject opens an
// optional comment box (not drawn; the rejected frame shows a comment, so one has to be entered somewhere). A part row
// shows "ISSUED" (as in the closed frame) once BR-07 issued ≥ requested; otherwise "IN STORE n" is red when below the
// requested quantity (Figma only draws 0 = red). DRAFT / RETURNED / WITHDRAWN (no frame) get a plain lock strip and no
// footer action.
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { IconCheck, IconClock, IconLock, IconSend, IconShoppingCart, IconX } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { useEmployeesByIds } from '../api';
import { useStartMrProcessing } from '../jobtabs/data';
import { Badge, PriorityChip, StatusPill } from '../../../ui/desktop/Badge';
import { Button, ButtonLink } from '../../../ui/desktop/Button';
import { ErrorState, errorBody } from '../../../ui/desktop/States';
import { FormErrors, GapNote } from '../../../ui/desktop/Feedback';
import { TextAreaField } from '../../../ui/desktop/Fields';
import { Ic, cx } from '../../../ui/desktop/Icon';
import { formatDayMonth, formatDayTime, formatDuration, formatQty, formatTime } from '../../../lib/format';
import {
  rk, useJobMrsDesk, useReviewChangeRequest,
  type ChangeRequest, type JobMaterialRequest, type JobMaterialRequestLine, type MrStatus, type PurchaseMrListRow,
} from './api';

/** Result banner shown above the split after an action (Figma "Processing started" / "Change accepted" / "Change rejected"). */
export type ResultBanner = {
  mrId: string; title: string; body: ReactNode;
  /** Figma's banner says "<engineer> has been notified": no notifications exist, so the page shows GapNote GAP-MR-3. */
  notifyGap?: boolean;
};

const h3 = 'whitespace-nowrap text-[15px] font-semibold leading-[20px] text-fg';

export function RequestDetail({ row, onResult }: { row: PurchaseMrListRow; onResult: (b: ResultBanner) => void }) {
  const me = useMe();
  const isPurchase = can.purchaseWork(me.role);
  const mrsQ = useJobMrsDesk(row.job_id);
  const mr = mrsQ.data?.find((m) => m.id === row.id);

  // Prefer the freshly read request (it refreshes after a write); fall back to the inbox row while it loads.
  const status: MrStatus = mr?.status ?? row.status;
  const priority = mr?.priority ?? row.priority;
  const processingAt = mr?.purchase_processing_started_at ?? row.purchase_processing_started_at;
  const deadline = mr?.self_edit_deadline_at ?? row.self_edit_deadline_at;
  const needed = (mr?.required_by_date ?? row.required_by_date) ? formatDayMonth(mr?.required_by_date ?? row.required_by_date) : null;
  const reason = mr?.required_by_reason ?? row.required_by_reason;

  return (
    <>
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className="truncate whitespace-nowrap font-mono text-[20px] font-medium leading-[26px] text-fg" title={row.request_number}>{row.request_number}</h2>
        <PriorityChip priority={priority} />
        <div className="h-px min-w-px flex-1" aria-hidden />
        <StatusPill domain="materialRequest" value={status} />
      </div>

      <div className="flex items-start gap-[28px] overflow-clip whitespace-nowrap">
        <Link to={`/p/jobs/${row.job_id}/material`} className="flex flex-col items-start gap-[2px] overflow-clip hover:underline">
          <span className="text-[12px] leading-[16px] text-fg-2">Job</span>
          <span className="font-mono text-[13px] font-medium leading-[18px] text-fg">{row.job_number}</span>
        </Link>
        <Meta label="Engineer">{row.responsible_engineer_name ?? '—'}</Meta>
        <Meta label="Needed by">{[needed, reason].filter(Boolean).join(' · ') || '—'}</Meta>
      </div>

      <EditWindow status={status} processingAt={processingAt} deadline={deadline} canEdit={row.engineer_can_edit} lines={mr?.lines} />

      {mrsQ.isError ? (
        <div className="flex w-full flex-1 items-center justify-center">
          <ErrorState title="Couldn't load the parts" body={errorBody(mrsQ.error)} onRetry={() => mrsQ.refetch()} retrying={mrsQ.isFetching} />
        </div>
      ) : !mr ? (
        mrsQ.isPending ? <PartsSkeleton count={row.lines_count} /> : (
          <div className="flex w-full flex-1 items-center justify-center">
            <p className="text-center text-[14px] leading-[20px] text-fg-2">This request wasn&apos;t found on {row.job_number}. Refresh the list.</p>
          </div>
        )
      ) : (
        <Body mr={mr} isPurchase={isPurchase} meId={me.id} onResult={onResult} jobId={row.job_id} />
      )}

      <div className="min-h-px w-px flex-1" aria-hidden />
      <Footer row={row} status={status} isPurchase={isPurchase} onResult={onResult} />
    </>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-[2px] overflow-clip">
      <span className="text-[12px] leading-[16px] text-fg-2">{label}</span>
      <span className="text-[14px] font-medium leading-[20px] text-fg">{children}</span>
    </div>
  );
}

// ------------------------------------------------------------------ edit window strip
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

/** "08:12" under an hour, else "01:08:12" (the deadline is 1 working hour, so lunch can stretch it past 60 min). */
const left = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 3600 ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : formatDuration(s);
};

function EditWindow({ status, processingAt, deadline, canEdit, lines }: {
  status: MrStatus; processingAt: string | null; deadline: string | null; canEdit: boolean; lines?: JobMaterialRequestLine[];
}) {
  const deadlineMs = deadline ? new Date(deadline).getTime() : NaN;
  const open = canEdit && !processingAt && status === 'SUBMITTED' && Number.isFinite(deadlineMs);
  const now = useNow(open);
  let text: string;
  let warn = false;
  if (status === 'CLOSED') {
    const done = !!lines && lines.length > 0 && lines.every((l) =>
      Number(l.fulfilment.issued_quantity) >= Number(l.quantity) && Number(l.fulfilment.consumed_quantity) >= Number(l.quantity));
    text = done ? 'Closed · all parts issued and consumed' : 'Closed';
  } else if (processingAt || status === 'PROCESSING') text = 'Locked · Purchase is processing';
  else if (status === 'DRAFT') text = "Draft · the engineer hasn't submitted it yet";
  else if (status === 'WITHDRAWN') text = 'Withdrawn by the engineer';
  else if (status === 'RETURNED') text = 'Returned to the engineer';
  else if (open && deadlineMs > now) { warn = true; text = `Engineer can still add parts until ${formatTime(deadline)} · ${left(deadlineMs - now)} left`; }
  else if (deadline && deadlineMs <= now) text = `Engineer edit window closed ${formatTime(deadline)} · locked`;
  else text = 'Engineer edit window closed · locked';
  return (
    <div className={cx('flex w-full items-center gap-[8px] overflow-clip rounded-[12px] px-[12px] py-[8px]', warn ? 'bg-warn-bg text-warn-fg' : 'bg-subtle text-fg-2')}>
      <Ic icon={warn ? IconClock : IconLock} size={16} />
      <p className="truncate whitespace-nowrap text-[12px] leading-[16px]">{text}</p>
    </div>
  );
}

// ------------------------------------------------------------------ parts + change requests
function Body({ mr, isPurchase, meId, onResult, jobId }: {
  mr: JobMaterialRequest; isPurchase: boolean; meId: string; onResult: (b: ResultBanner) => void; jobId: string;
}) {
  const crs = mr.change_requests;
  const empQ = useEmployeesByIds(crs.flatMap((c) => [c.requested_by_id, c.reviewed_by_id]).filter((id) => id && id !== meId));
  const nameOf = (id: string | null) => (id ? empQ.data?.[id]?.full_name : undefined);
  const anyUnparsed = crs.some((c) => parseChange(c.proposed_change, mr.lines) === null && hasContent(c.proposed_change));
  const anyAppliedGap = crs.some((c) => c.review_status !== 'REJECTED');
  return (
    <>
      <p className={h3}>Parts · {mr.lines.length}</p>
      {mr.lines.length === 0 && <p className="text-[14px] leading-[20px] text-fg-2">No parts on this request yet.</p>}
      {mr.lines.map((l) => <PartRow key={l.id} line={l} />)}
      {crs.map((c) => (
        <ChangeRequestCard
          key={c.id}
          cr={c}
          mr={mr}
          jobId={jobId}
          canReview={isPurchase && mr.status !== 'CLOSED'}
          requester={nameOf(c.requested_by_id)}
          reviewer={c.reviewed_by_id === meId ? 'you' : nameOf(c.reviewed_by_id)}
          onResult={onResult}
        />
      ))}
      {anyAppliedGap && (
        <GapNote code="GAP-MR-1">
          Accepting a change request doesn&apos;t change the request&apos;s parts — the backend has no step that applies the proposed
          change yet. The quantities above are what the request holds.
        </GapNote>
      )}
      {anyUnparsed && (
        <GapNote code="GAP-MR-2">
          The proposed change is free-form JSON with no agreed shape, so it is shown as sent. The &quot;item · from → to&quot;
          line needs the engineer app to write {'{lines:[{line_id, from_qty, to_qty}]}'}.
        </GapNote>
      )}
    </>
  );
}

function PartRow({ line }: { line: JobMaterialRequestLine }) {
  const qty = Number(line.quantity);
  const f = line.fulfilment;
  const issued = Number(f.issued_quantity) > 0 && Number(f.issued_quantity) >= qty;
  const enough = Number(f.allocatable_now) >= qty;
  const pref = [line.preferred_manufacturer, line.preferred_part_number].filter(Boolean).join(' · ');
  return (
    <div className="flex w-full items-center gap-[12px] overflow-clip rounded-[16px] bg-subtle px-[14px] py-[12px]">
      <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
        <span className="font-mono text-[13px] font-medium leading-[18px] text-fg-2">{line.item_code ?? '—'}</span>
        <span className="max-w-full truncate text-[14px] font-medium leading-[20px] text-fg" title={line.item_name ?? undefined}>{line.item_name ?? 'Unnamed item'}</span>
        <span className="max-w-full truncate text-[12px] leading-[16px] text-fg-muted">{pref ? `Preferred: ${pref}` : 'Any approved make'}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-[4px] overflow-clip">
        <span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{formatQty(line.quantity, line.uom_snapshot)}</span>
        {issued
          ? <Badge tone="success" label="ISSUED" />
          : <Badge tone={enough ? 'success' : 'blocked'} label={`IN STORE ${formatQty(f.allocatable_now, line.uom_snapshot)}`} />}
      </div>
    </div>
  );
}

type ParsedChange = { code: string; from: string | null; to: string; uom: string | null }[];
const hasContent = (pc: unknown) => !!pc && typeof pc === 'object' && Object.keys(pc as object).length > 0;

/** Reads {lines:[{line_id|item_code, from_qty?, to_qty}]}; anything else → null (rendered raw). */
function parseChange(pc: unknown, lines: JobMaterialRequestLine[]): ParsedChange | null {
  const arr = (pc as { lines?: unknown } | null)?.lines;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const out: ParsedChange = [];
  for (const x of arr) {
    if (!x || typeof x !== 'object') return null;
    const o = x as Record<string, unknown>;
    const to = o.to_qty;
    if (typeof to !== 'number' && typeof to !== 'string') return null;
    const line = lines.find((l) => (typeof o.line_id === 'string' && l.id === o.line_id) || (typeof o.item_code === 'string' && l.item_code === o.item_code));
    const code = typeof o.item_code === 'string' ? o.item_code : line?.item_code;
    if (!code) return null;
    const from = typeof o.from_qty === 'number' || typeof o.from_qty === 'string' ? String(o.from_qty) : line?.quantity ?? null;
    out.push({ code, from, to: String(to), uom: line?.uom_snapshot ?? null });
  }
  return out;
}

function ChangeRequestCard({ cr, mr, jobId, canReview, requester, reviewer, onResult }: {
  cr: ChangeRequest; mr: JobMaterialRequest; jobId: string; canReview: boolean;
  requester: string | undefined; reviewer: string | undefined; onResult: (b: ResultBanner) => void;
}) {
  const review = useReviewChangeRequest(jobId);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');
  const parsed = parseChange(cr.proposed_change, mr.lines);
  const pending = cr.review_status === 'PENDING';

  const decide = (decision: 'ACCEPTED' | 'REJECTED') => {
    const c = comment.trim();
    review.mutate(
      { mrId: mr.id, crId: cr.id, body: { decision, ...(decision === 'REJECTED' && c ? { comment: c } : {}) } },
      {
        onSuccess: () => {
          setRejecting(false);
          onResult(decision === 'ACCEPTED'
            ? { mrId: mr.id, title: 'Change accepted', body: `${mr.request_number} is back in processing. Its parts are unchanged — see GAP-MR-1.`, notifyGap: true }
            : { mrId: mr.id, title: 'Change rejected', body: `${mr.request_number} stays as it is.`, notifyGap: true });
        },
      },
    );
  };

  return (
    <div className="flex w-full flex-col items-start gap-[10px] overflow-clip rounded-[16px] border border-warn-border bg-warn-bg px-[16px] py-[14px]">
      <div className="flex w-full items-center gap-[8px] overflow-clip">
        <p className="min-w-px flex-1 text-[14px] font-medium leading-[20px] text-warn-fg">Change request{requester ? ` from ${requester}` : ''}</p>
        <StatusPill domain="changeRequest" value={cr.review_status} />
      </div>
      {parsed ? parsed.map((p, i) => (
        <div key={i} className="flex items-center gap-[8px] overflow-clip text-fg">
          <span className="whitespace-nowrap font-mono text-[13px] font-medium leading-[18px]">{p.code}</span>
          <span className="whitespace-pre font-mono text-[14px] font-semibold leading-[20px]">
            {p.from != null ? `${formatQty(p.from, p.uom)}  →  ` : '→  '}{formatQty(p.to, p.uom)}
          </span>
        </div>
      )) : hasContent(cr.proposed_change) && (
        <pre className="w-full whitespace-pre-wrap break-all font-mono text-[13px] font-medium leading-[18px] text-fg">{JSON.stringify(cr.proposed_change)}</pre>
      )}
      <p className="w-full text-[14px] leading-[20px] text-fg-2">&quot;{cr.change_reason}&quot;</p>
      {!pending && (
        <p className="w-full text-[12px] leading-[16px] text-fg-2">
          {cr.review_status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}{reviewer ? ` by ${reviewer}` : ''} · {cr.review_status === 'REJECTED' && cr.review_comment
            ? <>&quot;{cr.review_comment}&quot;</>
            : formatDayTime(cr.reviewed_at)}
        </p>
      )}
      {pending && canReview && (rejecting ? (
        <>
          <TextAreaField
            label="Comment for the engineer"
            helper="Optional. Saved with the rejection."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full"
          />
          <div className="flex w-full items-start gap-[8px] [&>*]:min-w-px [&>*]:flex-1">
            <Button kind="secondary" onClick={() => { setRejecting(false); review.reset(); }} disabled={review.isPending}>Cancel</Button>
            <Button kind="primary" icon={<Ic icon={IconX} size={18} />} busy={review.isPending} onClick={() => decide('REJECTED')}>Reject change</Button>
          </div>
        </>
      ) : (
        <div className="flex w-full items-start gap-[8px] [&>*]:min-w-px [&>*]:flex-1">
          <Button kind="secondary" icon={<Ic icon={IconX} size={18} />} onClick={() => { review.reset(); setRejecting(true); }} disabled={review.isPending}>Reject</Button>
          <Button kind="primary" icon={<Ic icon={IconCheck} size={18} />} busy={review.isPending} onClick={() => decide('ACCEPTED')}>Accept change</Button>
        </div>
      ))}
      <FormErrors error={review.error} title="Couldn't record the review" />
    </div>
  );
}

// ------------------------------------------------------------------ footer
function Footer({ row, status, isPurchase, onResult }: {
  row: PurchaseMrListRow; status: MrStatus; isPurchase: boolean; onResult: (b: ResultBanner) => void;
}) {
  const qc = useQueryClient();
  const start = useStartMrProcessing(row.job_id);
  const sourcing = `/p/jobs/${row.job_id}/sourcing`;
  const cart = <Ic icon={IconShoppingCart} size={18} />;

  if (status === 'CLOSED') {
    return (
      <div className="flex w-full items-center gap-[8px] overflow-clip text-fg-2">
        <Ic icon={IconLock} size={16} />
        <p className="text-[12px] leading-[16px]">Closed requests are read-only</p>
      </div>
    );
  }
  if (!isPurchase) return null;
  if (status === 'SUBMITTED') {
    return (
      <div className="flex w-full flex-col gap-[10px]">
        <FormErrors error={start.error} title="Couldn't start processing" />
        <Button
          kind="primary"
          block
          busy={start.isPending}
          icon={<Ic icon={IconSend} size={18} />}
          onClick={() => start.mutate(row.id, {
            onSuccess: () => {
              void qc.invalidateQueries({ queryKey: rk.lists });
              onResult({ mrId: row.id, title: 'Processing started', body: `${row.request_number} is locked for the engineer. Run a stock check next.` });
            },
          })}
        >
          Start processing
        </Button>
      </div>
    );
  }
  if (status === 'PROCESSING') return <ButtonLink to={sourcing} icon={cart} className="w-full">Run stock check</ButtonLink>;
  if (status === 'CHANGE_REQUESTED') return <ButtonLink to={sourcing} kind="secondary" icon={cart}>Run stock check</ButtonLink>;
  return null;
}

// ------------------------------------------------------------------ loading
function PartsSkeleton({ count }: { count: number }) {
  return (
    <div role="status" aria-label="Loading parts" className="flex w-full flex-col gap-[14px]">
      <div className="h-[14px] w-[72px] animate-pulse rounded-[6px] bg-disabled" />
      {Array.from({ length: Math.max(1, Math.min(count, 4)) }, (_, i) => (
        <div key={i} className="flex h-[78px] w-full items-center gap-[12px] rounded-[16px] bg-subtle px-[14px]">
          <div className="flex flex-1 flex-col gap-[8px]">
            <div className="h-[12px] w-[96px] animate-pulse rounded-[6px] bg-disabled" />
            <div className="h-[12px] w-[180px] animate-pulse rounded-[6px] bg-disabled" />
          </div>
          <div className="h-[12px] w-[56px] animate-pulse rounded-[6px] bg-disabled" />
        </div>
      ))}
    </div>
  );
}

/** Whole-panel placeholder while the inbox itself is loading. */
export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading request" className="flex w-full flex-col gap-[14px]">
      <div className="h-[20px] w-[160px] animate-pulse rounded-[6px] bg-disabled" />
      <div className="flex gap-[28px]">
        {[64, 80, 110].map((w) => <div key={w} className="h-[30px] animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />)}
      </div>
      <div className="h-[32px] w-full animate-pulse rounded-[12px] bg-subtle" />
      <PartsSkeleton count={2} />
    </div>
  );
}
