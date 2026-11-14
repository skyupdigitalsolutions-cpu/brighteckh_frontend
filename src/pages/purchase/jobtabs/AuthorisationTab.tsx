// Job workspace · Authorisation tab — Figma "D·P8 · Job · Authorisation → release → reserve" 177:104163 (Columns
// 177:104176) + "D·P8b · Record customer authority (peer types)" 177:104281 (drawer 177:104299).
// Columns gap 16: Progress (420, glass-strong p-20 gap-14 radius 24) = 6-step vertical stepper (row gap 14; rail 28px
// dot radius 14 — done = success fill + 16px white check, current = accent fill + 14/20 Medium number, pending =
// bg-subtle + 1px border-strong + muted number; 2px connector, success after a done step; text pb-18 = 14/20 Medium
// title (current 15/20 SemiBold, pending muted) over 12/16 secondary meta; status badge right on done steps).
// Right = the current step's panel (flex, glass-strong p-20 gap-14). The drawn main state is step 5: "Stock recheck ·
// time" + "Recheck again" (secondary), table (header bg-subtle radius 18 px-14 py-10 gap 14; cells Item flex · Required
// 84 → · Available now 104 → · Reserve 76 → · Status 130; rows px-14 py-12 border-b), blocked alert per short line,
// "Release note" text field, spacer, right-aligned "Release job" (secondary, send) + "Release & reserve n lines"
// (primary, stack).
//
// Steps ← API (all BR-05, @Roles(PURCHASE) except the quote-response read):
//   1 Customer response = GET /jobs/{id}/quote-responses (ACCEPTED; recorded by Sales on the Quote tab)
//   2 Customer authority = GET/POST /jobs/{id}/customer-authority, POST /customer-authority/{id}/verify
//   3 Order allocated = GET/POST /jobs/{id}/order-allocations, POST /order-allocations/{id}/verify
//   4 Job authorised = GET/POST /jobs/{id}/authorisations
//   5 Stock recheck & release = GET/POST /jobs/{id}/stock-rechecks {material_request_id}, GET/POST /jobs/{id}/release
//   6 Reserve material = GET/POST /jobs/{id}/reservations {stock_recheck_line_id, reserved_quantity}
// Gaps: D·P8b "Attach PO copy" has no API field (CustomerAuthorityDto has no evidence uri) → GapNote. "SHORT · ON PO"
// needs a PO ↔ recheck-line link the API doesn't expose → the badge says SHORT only.
import { useState, type ReactNode } from 'react';
import { IconCheck, IconFilePlus, IconReceipt, IconRefresh, IconSend, IconShieldCheck, IconStack2 } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { useJobWorkspace } from '../job/JobWorkspace';
import { useEmployeesByIds, useItemBridgeByIds, useQuote, useQuotes } from '../api';
import { Badge } from '../../../ui/desktop/Badge';
import { Button, ButtonLink } from '../../../ui/desktop/Button';
import { Drawer } from '../../../ui/desktop/Drawer';
import { EmptyState, ErrorState, StateCard, errorBody } from '../../../ui/desktop/States';
import { FormErrors, GapNote, InlineAlert } from '../../../ui/desktop/Feedback';
import { useToast } from '../../../ui/desktop/Toast';
import { Ic, cx, type TablerIcon } from '../../../ui/desktop/Icon';
import type { Tone } from '../../../lib/tones';
import { enumLabel, formatDayTime, formatINR, formatQty, formatTime } from '../../../lib/format';
import { CompactField, TabCard, TabSkeleton } from './ui';
import {
  useAuthoriseJob, useCreateOrderAllocation, useCustomerAuthorities, useJobAuthorisations, useJobMaterialRequests,
  useJobReleases, useJobReservations, useJobStockRechecks, useOrderAllocations, useQuoteResponses,
  useRecordCustomerAuthority, useReleaseJob, useReserveMaterial, useStockRecheck, useVerifyCustomerAuthority,
  useVerifyOrderAllocation, type CustomerAuthority, type StockRecheck, type StockRecheckLine,
} from './data';

type StepState = 'done' | 'current' | 'pending';
type Step = { title: string; meta: ReactNode; badge?: { tone: Tone; label: string }; done: boolean };

const h2 = 'min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg';
const num = (v: string | null | undefined) => (v == null ? 0 : Number(v) || 0);

export function AuthorisationTab() {
  const { job } = useJobWorkspace();
  const me = useMe();
  const isPurchase = can.purchaseWork(me.role);
  const respQ = useQuoteResponses(job.id);
  const authQ = useCustomerAuthorities(job.id, isPurchase);
  const allocQ = useOrderAllocations(job.id, isPurchase);
  const jaQ = useJobAuthorisations(job.id, isPurchase);
  const recheckQ = useJobStockRechecks(job.id, isPurchase);
  const relQ = useJobReleases(job.id, isPurchase);
  const resQ = useJobReservations(job.id, isPurchase);
  const quotesQ = useQuotes(job.id);
  const quoteQ = useQuote(quotesQ.data?.[0]?.id);

  if (!isPurchase) {
    return <StateCard><EmptyState icon={IconShieldCheck} title="Authorisation is handled by Purchase" body="Customer authority, authorisation, release and reservations are Purchase-only records." /></StateCard>;
  }
  const qs = [respQ, authQ, allocQ, jaQ, recheckQ, relQ, resQ];
  const failed = qs.find((q) => q.isError);
  if (failed) return <StateCard><ErrorState title="Couldn't load the authorisation records" body={errorBody(failed.error)} onRetry={() => qs.forEach((q) => q.refetch())} retrying={qs.some((q) => q.isFetching)} /></StateCard>;
  if (qs.some((q) => q.isPending)) return <TabSkeleton right={420} />;

  const accepted = respQ.data!.find((r) => r.response_type === 'ACCEPTED');
  const latestResp = respQ.data![0];
  const verifiedAuth = authQ.data!.find((a) => a.order_status === 'VERIFIED');
  const latestAuth = authQ.data![0];
  const verifiedAlloc = allocQ.data!.find((a) => a.allocation_status === 'VERIFIED');
  const latestAlloc = allocQ.data![0];
  const currentAuth = jaQ.data!.find((a) => a.is_current && a.authorisation_status === 'AUTHORISED');
  const recheck = recheckQ.data!.find((r) => r.is_current) ?? recheckQ.data![0];
  const release = relQ.data!.find((r) => r.release_status === 'RELEASED');
  const committed = resQ.data!.filter((r) => r.reservation_status === 'COMMITTED');
  const reservable = (recheck?.lines ?? []).filter((l) => num(l.available_store_quantity) > 0);
  const unreserved = reservable.filter((l) => !committed.some((r) => r.stock_recheck_line_id === l.id));
  const shortLines = (recheck?.lines ?? []).filter((l) => num(l.available_store_quantity) < num(l.required_quantity));
  const revision = quoteQ.data?.revisions.find((r) => r.id === (accepted?.quote_revision_id ?? verifiedAlloc?.accepted_quote_revision_id));
  const revLabel = revision && quoteQ.data ? `${quoteQ.data.quote_number} r${revision.revision_no}` : 'the accepted quote';

  const steps: Step[] = [
    {
      title: `Customer response${latestResp ? ` · ${enumLabel(latestResp.response_type)}` : ''}`,
      meta: latestResp ? [formatDayTime(latestResp.responded_at), latestResp.response_channel?.toLowerCase()].filter(Boolean).join(' · ') : 'Recorded by Sales on the Quote tab',
      badge: accepted ? { tone: 'success', label: 'ACCEPTED' } : undefined,
      done: !!accepted,
    },
    {
      title: `Customer authority${(verifiedAuth ?? latestAuth) ? ` · ${enumLabel((verifiedAuth ?? latestAuth)!.order_type)}` : ''}`,
      meta: (verifiedAuth ?? latestAuth) ? authMeta((verifiedAuth ?? latestAuth)!) : 'Customer PO, Job Order or written email',
      badge: verifiedAuth ? { tone: 'success', label: 'VERIFIED' } : undefined,
      done: !!verifiedAuth,
    },
    {
      title: 'Order allocated to job',
      meta: (verifiedAlloc ?? latestAlloc) ? `${formatINR((verifiedAlloc ?? latestAlloc)!.allocated_pre_tax)} against ${revLabel}` : 'Links the authority to the accepted quote',
      badge: verifiedAlloc ? { tone: 'success', label: 'VERIFIED' } : undefined,
      done: !!verifiedAlloc,
    },
    {
      title: 'Job authorised',
      meta: currentAuth ? <AuthorisedMeta id={currentAuth.authorised_by_id} at={currentAuth.authorised_at} /> : 'Purchase authorises the work',
      badge: currentAuth ? { tone: 'success', label: 'AUTHORISED' } : undefined,
      done: !!currentAuth,
    },
    {
      title: 'Stock recheck & release',
      meta: release ? `Released ${formatDayTime(release.released_at)}` : recheck ? `Recheck taken ${formatTime(recheck.checked_at)} · ${shortLines.length ? `${shortLines.length} ${shortLines.length === 1 ? 'line' : 'lines'} short` : 'all lines available'}` : 'Recheck stock, then release the job',
      badge: release ? { tone: 'success', label: 'RELEASED' } : undefined,
      done: !!release,
    },
    {
      title: 'Reserve material',
      meta: committed.length ? `${committed.length} ${committed.length === 1 ? 'line' : 'lines'} reserved` : 'Commits stock to this job',
      badge: release && reservable.length > 0 && unreserved.length === 0 ? { tone: 'success', label: 'RESERVED' } : undefined,
      done: !!release && unreserved.length === 0 && committed.length > 0,
    },
  ];
  const cur = steps.findIndex((s) => !s.done);

  return (
    <div className="flex min-h-[738px] w-full flex-1 items-stretch gap-[16px]">
      <TabCard className="w-[420px] shrink-0">
        <div className="flex w-full items-center overflow-clip"><h2 className={h2}>Progress</h2></div>
        <ol className="flex w-full flex-col">
          {steps.map((s, i) => <StepRow key={i} n={i + 1} step={s} state={s.done ? 'done' : i === cur ? 'current' : 'pending'} last={i === steps.length - 1} />)}
        </ol>
      </TabCard>
      <TabCard className="min-w-px flex-1">
        {cur === 0 && (
          <Panel title="Waiting for the customer's response">
            <p className="text-[14px] leading-[20px] text-fg-2">Sales records the customer&apos;s answer to the released quote. Authorisation starts once it is ACCEPTED.</p>
            <div className="flex"><ButtonLink to={`/p/jobs/${job.id}/quote`} kind="secondary">Open quote</ButtonLink></div>
          </Panel>
        )}
        {cur === 1 && <AuthorityPanel authorities={authQ.data!} suggestedPreTax={revision?.revised_pre_tax} suggestedTax={revision?.tax_total} />}
        {cur === 2 && (
          <AllocationPanel
            verified={authQ.data!.filter((a) => a.order_status === 'VERIFIED')}
            proposed={allocQ.data!.find((a) => a.allocation_status === 'PROPOSED')}
            revisionId={accepted?.quote_revision_id}
            revLabel={revLabel}
            suggested={revision?.revised_pre_tax}
          />
        )}
        {cur === 3 && <AuthorisePanel allocationId={verifiedAlloc!.id} amount={verifiedAlloc!.allocated_pre_tax} revLabel={revLabel} />}
        {(cur === 4 || cur === 5) && <RecheckPanel recheck={recheck} released={!!release} committedLineIds={committed.map((r) => r.stock_recheck_line_id)} />}
        {cur === -1 && (
          <Panel title="Authorised, released and reserved">
            <InlineAlert tone="success" title="Ready for repair">Stock is reserved for this job. Material is issued to the engineer from the Material tab when repair starts.</InlineAlert>
            {recheck && <RecheckTable recheck={recheck} committedLineIds={committed.map((r) => r.stock_recheck_line_id)} />}
          </Panel>
        )}
      </TabCard>
    </div>
  );
}

function authMeta(a: CustomerAuthority) {
  const ref = a.order_type === 'EMAIL_AUTHORISATION' ? a.customer_email_sender : a.customer_order_ref;
  const amt = a.pre_tax_total != null ? `${formatINR(a.pre_tax_total)}${a.tax_total != null ? ' + tax' : ''}` : null;
  return [ref, amt].filter(Boolean).join(' · ') || formatDayTime(a.received_at);
}
function AuthorisedMeta({ id, at }: { id: string; at: string }) {
  const q = useEmployeesByIds([id]);
  return <>{[q.data?.[id] ? `By ${q.data[id]!.full_name}` : null, formatDayTime(at)].filter(Boolean).join(' · ')}</>;
}

function StepRow({ n, step, state, last }: { n: number; step: Step; state: StepState; last: boolean }) {
  return (
    <li className="flex w-full items-start gap-[14px] overflow-clip" aria-current={state === 'current' ? 'step' : undefined}>
      <div className="flex shrink-0 flex-col items-center self-stretch overflow-clip">
        <div className={cx(
          'flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-clip rounded-[14px]',
          state === 'done' ? 'bg-success text-fg-on-accent' : state === 'current' ? 'bg-accent text-fg-on-accent' : 'border border-line-strong bg-subtle text-fg-muted',
        )}>
          {state === 'done' ? <Ic icon={IconCheck} size={16} /> : <span className="text-[14px] font-medium leading-[20px]">{n}</span>}
        </div>
        {!last && <div className={cx('min-h-px w-[2px] flex-1', state === 'done' ? 'bg-success' : 'bg-line')} />}
      </div>
      <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap pb-[18px]">
        <p className={cx(state === 'current' ? 'text-[15px] font-semibold' : 'text-[14px] font-medium', 'leading-[20px]', state === 'pending' ? 'text-fg-muted' : 'text-fg')}>{step.title}</p>
        <p className="truncate text-[12px] leading-[16px] text-fg-2">{step.meta}</p>
      </div>
      {state === 'done' && step.badge && <Badge tone={step.badge.tone} label={step.badge.label} />}
    </li>
  );
}

function Panel({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="flex w-full items-center gap-[10px] overflow-clip"><h2 className={h2}>{title}</h2>{right}</div>
      {children}
    </>
  );
}

// ------------------------------------------------------------------ step 2: customer authority
function AuthorityPanel({ authorities, suggestedPreTax, suggestedTax }: { authorities: CustomerAuthority[]; suggestedPreTax?: string; suggestedTax?: string }) {
  const { job } = useJobWorkspace();
  const verify = useVerifyCustomerAuthority(job.id);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const received = authorities.filter((a) => a.order_status === 'RECEIVED' || a.order_status === 'CLARIFICATION');
  return (
    <Panel title="Customer authority" right={<Button kind={received.length ? 'secondary' : 'primary'} icon={<Ic icon={IconFilePlus} size={18} />} onClick={() => setOpen(true)}>Record authority</Button>}>
      {received.length === 0 ? (
        <p className="text-[14px] leading-[20px] text-fg-2">Record the customer&apos;s PO, signed Job Order or written email. Any one authorises the work.</p>
      ) : (
        <>
          {received.map((a) => (
            <div key={a.id} className="flex w-full items-center gap-[16px] overflow-clip rounded-[16px] bg-subtle px-[16px] py-[12px]">
              <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
                <span className="text-[14px] font-medium leading-[20px] text-fg">{enumLabel(a.order_type)}</span>
                <span className="truncate text-[12px] leading-[16px] text-fg-2">{authMeta(a)} · received {formatDayTime(a.received_at)}</span>
              </div>
              <Badge tone="progress" label={a.order_status} />
              <Button kind="primary" icon={<Ic icon={IconShieldCheck} size={18} />} busy={verify.isPending && verify.variables?.id === a.id} disabled={verify.isPending} onClick={() => verify.mutate({ id: a.id, verification_notes: notes.trim() || undefined })}>Verify</Button>
            </div>
          ))}
          <CompactField label="Verification note" helper="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </>
      )}
      <FormErrors error={verify.error} title="Couldn't verify the authority" />
      <RecordAuthorityDrawer open={open} onClose={() => setOpen(false)} suggestedPreTax={suggestedPreTax} suggestedTax={suggestedTax} />
    </Panel>
  );
}

const AUTH_TYPES: { value: CustomerAuthority['order_type']; label: string; sub: string; icon: TablerIcon }[] = [
  { value: 'CUSTOMER_PO', label: 'Customer PO', sub: 'Purchase order number', icon: IconReceipt },
  { value: 'JOB_ORDER', label: 'Job Order', sub: 'Signed job order ref', icon: IconFilePlus },
  { value: 'EMAIL_AUTHORISATION', label: 'Email', sub: 'Written approval', icon: IconSend },
];

function RecordAuthorityDrawer({ open, onClose, suggestedPreTax, suggestedTax }: { open: boolean; onClose: () => void; suggestedPreTax?: string; suggestedTax?: string }) {
  const { job } = useJobWorkspace();
  const toast = useToast();
  const rec = useRecordCustomerAuthority(job.id);
  const verify = useVerifyCustomerAuthority(job.id);
  const [type, setType] = useState<CustomerAuthority['order_type']>('CUSTOMER_PO');
  const [ref, setRef] = useState('');
  const [sender, setSender] = useState('');
  const [receivedAt, setReceivedAt] = useState('');
  const [pre, setPre] = useState(suggestedPreTax ?? '');
  const [tax, setTax] = useState(suggestedTax ?? '');
  const [terms, setTerms] = useState('');
  const [tried, setTried] = useState(false);
  const busy = rec.isPending || verify.isPending;
  const isEmail = type === 'EMAIL_AUTHORISATION';
  const bad = (v: string) => v.trim() !== '' && !(Number.isFinite(Number(v)) && Number(v) >= 0);
  const missing = isEmail ? !sender.trim() : !ref.trim();

  const save = async (andVerify: boolean) => {
    setTried(true);
    if (missing || bad(pre) || bad(tax)) return;
    const a = await rec.mutateAsync({
      authority_type: type,
      ...(isEmail ? { customer_email_sender: sender.trim(), ...(receivedAt ? { customer_email_received_at: new Date(receivedAt).toISOString() } : {}) } : { customer_order_ref: ref.trim() }),
      ...(pre.trim() ? { pre_tax_total: Number(pre) } : {}),
      ...(tax.trim() ? { tax_total: Number(tax) } : {}),
      ...(terms.trim() ? { payment_terms_snapshot: terms.trim() } : {}),
    });
    if (andVerify) await verify.mutateAsync({ id: a.id });
    toast({ tone: 'success', title: andVerify ? 'Authority recorded and verified' : 'Authority recorded', body: enumLabel(type) });
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      busy={busy}
      bodyGap={16}
      title="Record customer authority"
      subtitle="Any one of these authorises the work — they carry equal weight."
      onSubmit={() => { void save(true).catch(() => undefined); }}
      footer={(
        <>
          <Button kind="secondary" disabled={busy} onClick={() => { void save(false).catch(() => undefined); }}>Save as received</Button>
          <Button kind="primary" type="submit" busy={busy} icon={<Ic icon={IconShieldCheck} size={18} />}>Save &amp; verify</Button>
        </>
      )}
    >
      <div role="radiogroup" aria-label="Authority type" className="flex w-full items-start gap-[10px]">
        {AUTH_TYPES.map((t) => {
          const on = t.value === type;
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setType(t.value)}
              className={cx('flex min-w-px flex-1 flex-col items-start gap-[8px] overflow-clip rounded-[18px] p-[14px] text-left', on ? 'border-2 border-brand-border bg-brand-subtle' : 'border border-line bg-subtle hover:bg-surface')}
            >
              <Ic icon={t.icon} size={22} className={on ? 'text-brand-text' : 'text-fg-2'} />
              <span className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{t.label}</span>
              <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{t.sub}</span>
            </button>
          );
        })}
      </div>
      {isEmail ? (
        <>
          <CompactField label="Sender email" value={sender} onChange={(e) => setSender(e.target.value)} error={tried && !sender.trim() ? 'Enter who sent the approval.' : null} />
          <CompactField label="Received at" type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} helper="Optional" />
        </>
      ) : (
        <CompactField label={type === 'CUSTOMER_PO' ? 'Customer PO number' : 'Job order ref'} value={ref} onChange={(e) => setRef(e.target.value)} error={tried && !ref.trim() ? 'Enter the reference.' : null} />
      )}
      <CompactField label="Pre-tax total" inputMode="decimal" value={pre} onChange={(e) => setPre(e.target.value)} helper="Must match the accepted quote revision" error={tried && bad(pre) ? 'Enter an amount, 0 or more.' : null} />
      <CompactField label="Tax total" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} error={tried && bad(tax) ? 'Enter an amount, 0 or more.' : null} />
      <CompactField label="Payment terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
      <GapNote code="G-B5-1">Attaching the PO copy (Figma &ldquo;Attach PO copy&rdquo;) isn&apos;t possible yet: the customer-authority API has no evidence / file field.</GapNote>
      <FormErrors error={rec.error ?? verify.error} title="The authority wasn't saved" />
    </Drawer>
  );
}

// ------------------------------------------------------------------ step 3: order allocation
function AllocationPanel({ verified, proposed, revisionId, revLabel, suggested }: {
  verified: CustomerAuthority[]; proposed?: { id: string; allocated_pre_tax: string; order_id: string }; revisionId?: string; revLabel: string; suggested?: string;
}) {
  const { job } = useJobWorkspace();
  const create = useCreateOrderAllocation(job.id);
  const verify = useVerifyOrderAllocation(job.id);
  const [order, setOrder] = useState(verified[0]?.id ?? '');
  const [amount, setAmount] = useState(suggested ?? '');
  const [tried, setTried] = useState(false);
  if (proposed) {
    return (
      <Panel title="Verify the order allocation">
        <p className="text-[14px] leading-[20px] text-fg-2">{formatINR(proposed.allocated_pre_tax)} of {authMeta(verified.find((v) => v.id === proposed.order_id) ?? verified[0]!)} is proposed against {revLabel}.</p>
        <FormErrors error={verify.error} title="Couldn't verify the allocation" />
        <div className="flex"><Button kind="primary" icon={<Ic icon={IconShieldCheck} size={18} />} busy={verify.isPending} onClick={() => verify.mutate(proposed.id)}>Verify allocation</Button></div>
      </Panel>
    );
  }
  const badAmount = !(amount.trim() !== '' && Number.isFinite(Number(amount)) && Number(amount) > 0);
  return (
    <Panel title="Allocate the order to this job">
      {!revisionId ? (
        <InlineAlert tone="blocked" title="No accepted quote revision">The customer response must be ACCEPTED on a quote revision before an order can be allocated.</InlineAlert>
      ) : (
        <>
          <div className="flex w-full flex-col items-start gap-[6px]">
            <span className="text-[14px] font-medium leading-[20px] text-fg">Verified authority</span>
            <div className="flex flex-wrap gap-[8px]">
              {verified.map((v) => (
                <button key={v.id} type="button" onClick={() => setOrder(v.id)} className={cx('rounded-t-chip border px-[16px] py-[10px] text-[12px] leading-[16px]', v.id === order ? 'border-brand-border bg-brand-subtle text-fg' : 'border-line bg-subtle text-fg-2 hover:bg-surface')}>
                  {enumLabel(v.order_type)} · {authMeta(v)}
                </button>
              ))}
            </div>
          </div>
          <CompactField label="Allocated pre-tax (₹)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} helper={`Against ${revLabel}`} error={tried && badAmount ? 'Enter the amount above 0.' : null} />
          <FormErrors error={create.error} title="The allocation wasn't saved" />
          <div className="flex">
            <Button kind="primary" busy={create.isPending} onClick={() => { setTried(true); if (!badAmount && order) create.mutate({ order_id: order, quote_revision_ref_id: revisionId, allocated_pre_tax: Number(amount) }); }}>Allocate to job</Button>
          </div>
        </>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ step 4: authorise
function AuthorisePanel({ allocationId, amount, revLabel }: { allocationId: string; amount: string; revLabel: string }) {
  const { job } = useJobWorkspace();
  const m = useAuthoriseJob(job.id);
  return (
    <Panel title="Authorise the job">
      <p className="text-[14px] leading-[20px] text-fg-2">The verified allocation covers {formatINR(amount)} against {revLabel}. Authorising freezes this scope for repair.</p>
      <FormErrors error={m.error} title="The job wasn't authorised" />
      <div className="flex"><Button kind="primary" icon={<Ic icon={IconShieldCheck} size={18} />} busy={m.isPending} onClick={() => m.mutate(allocationId)}>Authorise job</Button></div>
    </Panel>
  );
}

// ------------------------------------------------------------------ steps 5–6: recheck, release, reserve (drawn main state)
function RecheckPanel({ recheck, released, committedLineIds }: { recheck: StockRecheck | undefined; released: boolean; committedLineIds: string[] }) {
  const { job } = useJobWorkspace();
  const toast = useToast();
  const mrQ = useJobMaterialRequests(job.id);
  const doRecheck = useStockRecheck(job.id);
  const doRelease = useReleaseJob(job.id);
  const doReserve = useReserveMaterial(job.id);
  const [note, setNote] = useState('');
  const mr = mrQ.data?.find((m) => m.status === 'PROCESSING') ?? mrQ.data?.[0];
  const itemsQ = useItemBridgeByIds(recheck?.lines.map((l) => l.item_bridge_id) ?? []);
  const toReserve = (recheck?.lines ?? []).filter((l) => num(l.available_store_quantity) > 0 && !committedLineIds.includes(l.id));
  const short = (recheck?.lines ?? []).filter((l) => num(l.available_store_quantity) < num(l.required_quantity));
  const busy = doRecheck.isPending || doRelease.isPending || doReserve.isPending;

  const reserveAll = async () => {
    for (const l of toReserve) {
      await doReserve.mutateAsync({ stock_recheck_line_id: l.id, reserved_quantity: Math.min(num(l.required_quantity), num(l.available_store_quantity)) });
    }
  };
  const release = async (andReserve: boolean) => {
    if (!released) await doRelease.mutateAsync(note.trim());
    if (andReserve) await reserveAll();
    toast({ tone: 'success', title: andReserve ? (released ? 'Material reserved' : 'Released and reserved') : 'Job released', body: andReserve ? `${toReserve.length} ${toReserve.length === 1 ? 'line' : 'lines'} committed to ${job.job_number}.` : 'Reserve stock when it is available.' });
    setNote('');
  };

  if (!recheck) {
    return (
      <Panel title="Stock recheck">
        <p className="text-[14px] leading-[20px] text-fg-2">Take a fresh stock snapshot of the material request before releasing the job.</p>
        {!mr && !mrQ.isPending && <InlineAlert tone="blocked" title="No material request">The recheck runs against the job&apos;s material request.</InlineAlert>}
        <FormErrors error={doRecheck.error} title="The recheck didn't run" />
        <div className="flex"><Button kind="primary" icon={<Ic icon={IconRefresh} size={18} />} busy={doRecheck.isPending} disabled={!mr} onClick={() => mr && doRecheck.mutate(mr.id)}>Recheck stock</Button></div>
      </Panel>
    );
  }
  return (
    <Panel
      title={`Stock recheck · ${formatDayTime(recheck.checked_at)}`}
      right={!released && <Button kind="secondary" icon={<Ic icon={IconRefresh} size={18} />} busy={doRecheck.isPending} disabled={!mr || busy} onClick={() => mr && doRecheck.mutate(mr.id)}>Recheck again</Button>}
    >
      <RecheckTable recheck={recheck} committedLineIds={committedLineIds} />
      {short.map((l) => {
        const it = itemsQ.data?.[l.item_bridge_id];
        return (
          <InlineAlert key={l.id} tone="blocked" title={`Insufficient stock for ${it?.item_code ?? 'this item'}`}>
            Allocatable is {formatQty(l.available_store_quantity ?? '0', l.uom)} of {formatQty(l.required_quantity, l.uom)}. {toReserve.length ? 'Release the job now and reserve what is in store; ' : ''}reserve the rest after its GRN posts.
          </InlineAlert>
        );
      })}
      {!released && <CompactField label="Release note" helper="Optional" value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />}
      <div className="min-h-px w-px flex-1" />
      <FormErrors error={doRelease.error ?? doReserve.error ?? doRecheck.error} title="That didn't go through" />
      <div className="flex w-full items-start justify-end gap-[10px]">
        {!released && <Button kind="secondary" icon={<Ic icon={IconSend} size={18} />} busy={doRelease.isPending && !doReserve.isPending} disabled={busy} onClick={() => { void release(false).catch(() => undefined); }}>Release job</Button>}
        {toReserve.length > 0 && (
          <Button kind="primary" icon={<Ic icon={IconStack2} size={18} />} busy={doReserve.isPending} disabled={busy} onClick={() => { void release(true).catch(() => undefined); }}>
            {released ? 'Reserve' : 'Release & reserve'} {toReserve.length} {toReserve.length === 1 ? 'line' : 'lines'}
          </Button>
        )}
      </div>
    </Panel>
  );
}

function RecheckTable({ recheck, committedLineIds }: { recheck: StockRecheck; committedLineIds: string[] }) {
  const itemsQ = useItemBridgeByIds(recheck.lines.map((l) => l.item_bridge_id));
  const H = ({ w, children, right }: { w?: number; children: ReactNode; right?: boolean }) => (
    <div className={cx('flex items-center overflow-clip', w ? 'shrink-0' : 'min-w-px flex-1', right && 'justify-end')} style={w ? { width: w } : undefined}>
      <span className="whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{children}</span>
    </div>
  );
  const N = ({ w, children }: { w: number; children: ReactNode }) => (
    <div className="flex shrink-0 items-center justify-end overflow-clip" style={{ width: w }}><span className="whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg">{children}</span></div>
  );
  return (
    <div role="table" className="flex w-full flex-col gap-[14px]">
      <div role="row" className="flex w-full items-start gap-[14px] overflow-clip rounded-[18px] bg-subtle px-[14px] py-[10px]">
        <H>Item</H><H w={84} right>Required</H><H w={104} right>Available now</H><H w={76} right>Reserve</H><H w={130}>Status</H>
      </div>
      <div className="flex w-full flex-col gap-[14px]">
        {recheck.lines.map((l: StockRecheckLine) => {
          const it = itemsQ.data?.[l.item_bridge_id];
          const avail = num(l.available_store_quantity);
          const reserveQty = Math.min(num(l.required_quantity), avail);
          const reserved = committedLineIds.includes(l.id);
          const ready = avail >= num(l.required_quantity);
          return (
            <div key={l.id} role="row" className="flex w-full items-center gap-[14px] overflow-clip border-b border-line px-[14px] py-[12px]">
              <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
                <span className="font-mono text-[13px] font-medium leading-[18px] text-fg-2">{it?.item_code ?? '…'}</span>
                <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{it?.item_name ?? 'Loading item…'}</span>
              </div>
              <N w={84}>{formatQty(l.required_quantity, l.uom)}</N>
              <N w={104}>{formatQty(l.available_store_quantity ?? '0', l.uom)}</N>
              <N w={76}>{reserveQty > 0 ? formatQty(reserveQty, l.uom) : '—'}</N>
              <div className="flex w-[130px] shrink-0 items-center overflow-clip">
                <Badge tone={reserved ? 'success' : ready ? 'success' : avail > 0 ? 'progress' : 'blocked'} label={reserved ? 'RESERVED' : ready ? 'READY' : avail > 0 ? 'PARTIAL' : 'SHORT'} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
