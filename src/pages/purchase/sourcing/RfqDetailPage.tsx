// RFQ detail — /p/rfqs/:rfqId (?job=<jobId>&tab=lines|suppliers|offers|history&action=invite|record).
// Figma: S1 Lines tab 177:121855 · Suppliers tab 177:121899 · History tab 177:122104 · Invite supplier (drawer)
// 177:121956 · Supplier invited 177:122035 · Record offer (drawer) 177:122122 · Offer recorded 177:122318 · Offer
// marked valid 177:122472 · Mark invalid (drawer) 177:122603 · Offer marked invalid 177:122762; Offers tab =
// "D·P6 · RFQ · invites · offer comparison" 177:103669.
// Header (177:121857): title = rfq_number; meta = job number · first line item · "revision n" (API revision_no).
// Tab bar: Lines · Suppliers · n · Offers · n · History. Result alerts ("Result toast", kit InlineAlert) sit between
// the tab bar and the content, as drawn (success for invite/offer/valid, blocked for invalid).
//
// API facts / deviations:
// - GET /rfqs/{id} has no job id and no shortage sources (G?-C2-2). The job is known only when the user came from a
//   job (?job=…); it is shown only after GET /jobs/{id}/rfqs confirms the RFQ belongs to that job. "Raised from" then
//   shows the job; material request / shortage / stock-check links carry the GapNote.
// - No audit/history endpoint (G?-C2-3): History is built from the RFQ's own timestamps (created, sent, invites,
//   offers, technical checks). Actor names: no employee lookup (G17) → date only.
// - Offer rows: one per offer line of the selected RFQ line, ranked by `comparable_landed_cost` (DB value). Disc. is
//   the ₹ amount `quoted_discount` (Figma "%"). The selected row is highlighted; a PENDING selected row shows
//   Valid / Invalid (Purchase marks validity manually — CLAUDE.md §6). "Best valid" = lowest landed among COMPLIANT.
// - All cost columns are gated on can.seeSupplierCost(role); writes on can.purchaseWork(role) (hidden otherwise).
// - The RFQ status is never moved to COMPARED by the API (no endpoint); it is shown as returned.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { IconCheck, IconFilePlus, IconFileUnknown, IconPlus, IconReceipt, IconUsers, IconX } from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { apiStatus } from '../../../api/http';
import { PageHeader } from '../../../ui/desktop/PageHeader';
import { PageContent } from '../../../ui/desktop/Glass';
import { TabBar, Tab } from '../../../ui/desktop/Tabs';
import { Button, ButtonLink } from '../../../ui/desktop/Button';
import { StatusPill } from '../../../ui/desktop/Badge';
import { Ic } from '../../../ui/desktop/Icon';
import { SkeletonRows } from '../../../ui/desktop/DataTable';
import { EmptyState, ErrorState, StateCard, errorBody } from '../../../ui/desktop/States';
import { FormErrors, GapNote, InlineAlert } from '../../../ui/desktop/Feedback';
import { useToast } from '../../../ui/desktop/Toast';
import { formatDate, formatDayTime, formatINR, formatQty } from '../../../lib/format';
import type { Tone } from '../../../lib/tones';
import {
  useJob, useMarkOfferValidity, useRfq, useRfqs,
  type OfferLine, type Rfq,
} from '../api';
import { useItemNames, useJobMaterialRequests, useMaterialRequests, shortId, type ItemName } from './data';
import { CardHead, Cell, GridHead, GridRow, HCell, ItemTwo, MetaField, Muted, Num, SectionCard, TimelineItem, formatDayMonth } from './ui';
import { InviteSupplierDrawer, MarkInvalidDrawer, RecordOfferDrawer } from './RfqDrawers';
import { rfqLabel } from './RfqTable';

type TabKey = 'lines' | 'suppliers' | 'offers' | 'history';
type Result = { tone: Tone; title: string; body: string };
type Row = { line: OfferLine; supplier: string; validUntil: string | null };

const itemName = (names: Map<string, ItemName>, id: string) => names.get(id)?.name ?? `Item ${shortId(id)}`;
const itemCode = (names: Map<string, ItemName>, id: string) => names.get(id)?.code ?? shortId(id);
const makePart = (l: OfferLine) => [l.offered_make, l.offered_part_number].filter(Boolean).join(' ') || 'Offer';

function offerRows(rfq: Rfq, rfqLineId: string): Row[] {
  const out: Row[] = [];
  for (const o of rfq.offers) {
    const supplier = rfq.invites.find((i) => i.id === o.supplier_invite_id)?.supplier_name_snapshot ?? 'Supplier';
    for (const l of o.lines) if (l.rfq_line_id === rfqLineId) out.push({ line: l, supplier, validUntil: o.validity_until });
  }
  return out.sort((a, b) => Number(a.line.comparable_landed_cost ?? Infinity) - Number(b.line.comparable_landed_cost ?? Infinity));
}

export function RfqDetailPage() {
  const { rfqId = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const toast = useToast();
  const { me } = useAuth();
  const role = me?.role;
  const canSeeCost = !!role && can.seeSupplierCost(role);
  const canAct = !!role && can.purchaseWork(role);

  const rfqQ = useRfq(rfqId);
  const jobParam = sp.get('job') ?? undefined;
  const jobRfqs = useRfqs(jobParam);
  const jobLinked = !!jobParam && !!jobRfqs.data?.some((r) => r.id === rfqId);
  const jobQ = useJob(jobLinked ? jobParam : undefined);
  const jobId = jobLinked ? jobParam : undefined;
  const jobMrs = useJobMaterialRequests(jobId);
  const anyMrs = useMaterialRequests();
  const names = useItemNames(jobMrs.submitted?.id ?? jobMrs.forJob[0]?.id ?? anyMrs.data?.[0]?.id).map;

  const tab = (['lines', 'suppliers', 'offers', 'history'].includes(sp.get('tab') ?? '') ? sp.get('tab') : 'lines') as TabKey;
  const setTab = (t: TabKey) => setSp((p) => { const n = new URLSearchParams(p); n.set('tab', t); n.delete('action'); n.delete('created'); return n; }, { replace: true });

  const [result, setResult] = useState<Result | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [invalidLine, setInvalidLine] = useState<{ line: OfferLine; title: string } | null>(null);
  const [lineIdx, setLineIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const markValid = useMarkOfferValidity(rfqId, jobId);

  // Deep links from the row menu (?action=invite|record) and from RFQ creation (?created=RFQ-…).
  useEffect(() => {
    if (!rfqQ.data || !canAct) return;
    const a = sp.get('action');
    if (a === 'invite') setInviteOpen(true);
    if (a === 'record') setRecordOpen(true);
    const created = sp.get('created');
    if (created) setResult({ tone: 'success', title: 'RFQ created', body: `${created} is a DRAFT. Invite suppliers to send it.` });
    if (a || created) setSp((p) => { const n = new URLSearchParams(p); n.delete('action'); n.delete('created'); return n; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqQ.data, canAct]);

  const rfq = rfqQ.data;
  const curLine = rfq?.lines[Math.min(lineIdx, Math.max(0, (rfq?.lines.length ?? 1) - 1))];
  const rows = useMemo(() => (rfq && curLine ? offerRows(rfq, curLine.id) : []), [rfq, curLine]);
  const defaultSel = rows.find((r) => r.line.technical_status === 'PENDING')?.line.id ?? null;
  const sel = selected && rows.some((r) => r.line.id === selected) ? selected : defaultSel;

  // ---------------------------------------------------------------- page-level states
  if (rfqQ.isPending) {
    return (
      <>
        <header className="flex w-full items-center gap-[16px] px-[20px]" role="status" aria-label="Loading RFQ">
          <div className="flex flex-1 flex-col gap-[4px]">
            <div className="my-[6px] h-[16px] w-[140px] animate-pulse rounded-[6px] bg-disabled" />
            <div className="my-[4px] h-[12px] w-[320px] animate-pulse rounded-[6px] bg-disabled" />
          </div>
        </header>
        <PageContent>
          <TabBar label="RFQ sections">{(['Lines', 'Suppliers', 'Offers', 'History'] as const).map((l, i) => <Tab key={l} active={i === 0} onClick={() => {}} label={l} />)}</TabBar>
          <SectionCard pad={24}><div className="w-full"><SkeletonRows rows={4} widths={[260, 120, 160, 120]} /></div></SectionCard>
        </PageContent>
      </>
    );
  }
  if (rfqQ.isError || !rfq) {
    const nf = apiStatus(rfqQ.error) === 404 || apiStatus(rfqQ.error) === 400;
    return (
      <>
        <PageHeader title="RFQ" meta={nf ? 'Not found' : undefined} />
        <PageContent>
          <StateCard>
            {nf ? (
              <EmptyState
                icon={IconFileUnknown}
                title="RFQ not found"
                body="This RFQ doesn't exist in your company, or the link is wrong."
                action={<ButtonLink to="/p/sourcing" kind="secondary">Back to sourcing</ButtonLink>}
              />
            ) : (
              <ErrorState title="Couldn't load this RFQ" body={errorBody(rfqQ.error)} onRetry={() => rfqQ.refetch()} retrying={rfqQ.isFetching} />
            )}
          </StateCard>
        </PageContent>
      </>
    );
  }

  const label = rfqLabel(rfq);
  const first = rfq.lines[0];
  const meta = [jobQ.data?.job_number, first && itemName(names, first.item_bridge_id), `revision ${rfq.revision_no}`].filter(Boolean).join(' · ');
  const offerLineCount = rfq.offers.reduce((n, o) => n + o.lines.length, 0);
  const subtitle = [label, first && itemName(names, first.item_bridge_id)].filter(Boolean).join(' · ');
  const unknownItems = rfq.lines.some((l) => !names.has(l.item_bridge_id));

  const bestValid = (exclude?: string, include?: OfferLine) => {
    const cands = rows
      .map((r) => (include && r.line.id === include.id ? { ...r, line: include } : r))
      .filter((r) => r.line.id !== exclude && r.line.technical_status === 'COMPLIANT' && r.line.comparable_landed_cost != null);
    return cands.sort((a, b) => Number(a.line.comparable_landed_cost) - Number(b.line.comparable_landed_cost))[0];
  };

  const doValid = (r: Row) => {
    setResult(null);
    markValid.mutate({ offerLineId: r.line.id, body: { valid: true } }, {
      onSuccess: (l) => {
        const best = bestValid(undefined, l);
        const isBest = best?.line.id === l.id;
        setResult({
          tone: 'success',
          title: 'Marked compliant',
          body: isBest && canSeeCost
            ? `${makePart(l)} is now the best valid offer at ${formatINR(l.comparable_landed_cost)} landed.`
            : `${r.supplier} · ${makePart(l)} marked compliant.`,
        });
      },
    });
  };

  // ---------------------------------------------------------------- tabs content
  const linesTab = (
    <>
      {rfq.lines.length === 0 && (
        <SectionCard pad={24}><div className="flex w-full justify-center"><EmptyState icon={IconFileUnknown} title="No lines" body="This RFQ has no lines." /></div></SectionCard>
      )}
      {rfq.lines.map((l) => (
        <SectionCard key={l.id} pad={24}>
          <CardHead title={`Line ${l.line_no} · ${itemName(names, l.item_bridge_id)}`} right={<StatusPill domain="rfq" value={rfq.rfq_status} />} />
          <div className="flex w-full flex-wrap items-start gap-[44px] overflow-clip">
            <MetaField label="Item" mono gap={3}>{itemCode(names, l.item_bridge_id)}</MetaField>
            <MetaField label="Quantity" mono gap={3}>{formatQty(l.quantity, l.uom)}</MetaField>
            <MetaField label="Preferred" gap={3}>{l.manufacturer_preference ?? '—'}</MetaField>
            <MetaField label="Needed by" gap={3}>{formatDate(l.desired_delivery_by)}</MetaField>
            {l.preference_reason && <MetaField label="Preference reason" gap={3}>{l.preference_reason}</MetaField>}
          </div>
          <p className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">Technical specification</p>
          <p className="w-full text-[14px] leading-[20px] text-fg-2">{l.technical_specification}</p>
        </SectionCard>
      ))}
      {unknownItems && <GapNote code="G?-C2-1">Some items show the catalogue id only: there is no item lookup by item_bridge_id.</GapNote>}
      <SectionCard pad={24}>
        <CardHead title="Raised from" />
        <div className="flex w-full flex-wrap items-start gap-[44px] overflow-clip">
          {jobQ.data ? (
            <Link to={`/p/jobs/${jobQ.data.id}/sourcing`} className="flex shrink-0 flex-col items-start gap-[3px] overflow-clip whitespace-nowrap text-left hover:underline">
              <span className="text-[12px] leading-[16px] text-fg-2">Job</span>
              <span className="font-mono text-[13px] font-medium leading-[18px] text-fg">{jobQ.data.job_number}</span>
            </Link>
          ) : (
            <MetaField label="Job" mono gap={3}>—</MetaField>
          )}
          {rfq.notes && <MetaField label="Notes" gap={3}>{rfq.notes}</MetaField>}
        </div>
        <GapNote code="G?-C2-2">
          GET /rfqs/{'{id}'} returns no job, material request, shortage source or stock-check link.
          {jobQ.data ? ' The job is known because you opened this RFQ from its Sourcing tab.' : ' Open the RFQ from a job\'s Sourcing tab to see the job.'}
        </GapNote>
      </SectionCard>
    </>
  );

  const suppliersTab = (
    <SectionCard pad={24} fill>
      <CardHead
        title="Invited suppliers"
        right={canAct ? <Button kind="primary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setInviteOpen(true)}>Invite supplier</Button> : undefined}
      />
      {rfq.invites.length === 0 ? (
        <div className="flex w-full justify-center">
          <EmptyState icon={IconUsers} title="No suppliers invited" body="Invite suppliers to quote. The first invite moves the RFQ from DRAFT to SENT." />
        </div>
      ) : (
        <div role="table" className="flex w-full flex-col gap-[16px]">
          <div role="row" className="flex w-full items-start gap-[12px] overflow-clip rounded-[20px] bg-subtle px-[16px] py-[12px]">
            <HCell grow>Supplier</HCell><HCell w={320}>Contact</HCell><HCell w={140}>Invited</HCell><HCell w={150}>Status</HCell><HCell w={90}>Offers</HCell>
          </div>
          <div className="flex w-full flex-col">
            {rfq.invites.map((i) => {
              const n = rfq.offers.filter((o) => o.supplier_invite_id === i.id).length;
              return (
                <div key={i.id} role="row" className="flex w-full items-center gap-[12px] overflow-clip border-b border-line px-[16px] py-[14px]">
                  <Cell grow><span className="truncate whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{i.supplier_name_snapshot}</span></Cell>
                  <Cell w={320}><span className="truncate whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{i.supplier_contact_snapshot ?? '—'}</span></Cell>
                  <Cell w={140}><Muted>{formatDayTime(i.created_at)}</Muted></Cell>
                  <Cell w={150}><StatusPill domain="invite" value={i.invitation_status} /></Cell>
                  <Cell w={90}><span className="whitespace-nowrap text-[14px] leading-[20px] text-fg">{n === 0 ? '—' : n === 1 ? '1 offer' : `${n} offers`}</span></Cell>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );

  const noncompliant = rows.filter((r) => r.line.technical_status === 'NONCOMPLIANT');
  const best = bestValid();
  const footerNote = [
    noncompliant.length ? `Non-compliant: ${noncompliant.map((r) => `${makePart(r.line)}${r.line.technical_reason ? ` — ${r.line.technical_reason}` : ''}`).join('; ')}.` : '',
    best && canSeeCost ? `Best valid: ${best.supplier} ${formatINR(best.line.comparable_landed_cost)}.` : '',
  ].filter(Boolean).join(' ');

  const offersTab = (
    <>
      <div className="flex w-full items-start gap-[16px] overflow-clip">
        <SectionCard className="min-w-px flex-1">
          <CardHead title={label} right={<StatusPill domain="rfq" value={rfq.rfq_status} />} />
          {curLine && (
            <div className="flex w-full items-start gap-[32px] overflow-clip whitespace-nowrap">
              <MetaField label={`Line ${curLine.line_no}`}>{formatQty(curLine.quantity, curLine.uom)} · {itemName(names, curLine.item_bridge_id)}</MetaField>
              <div className="min-w-0 max-w-[260px]"><MetaField label="Spec"><span className="block truncate">{curLine.technical_specification}</span></MetaField></div>
              <MetaField label="Preferred">{curLine.manufacturer_preference ?? '—'}</MetaField>
              <MetaField label="Needed by">{formatDate(curLine.desired_delivery_by)}</MetaField>
            </div>
          )}
        </SectionCard>
        <SectionCard className="w-[380px] shrink-0">
          <CardHead
            title="Suppliers"
            right={canAct ? <Button kind="ghost" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setInviteOpen(true)}>Invite</Button> : undefined}
          />
          {rfq.invites.length === 0 && <Muted>No suppliers invited yet.</Muted>}
          {rfq.invites.map((i) => (
            <div key={i.id} className="flex w-full items-center gap-[8px] overflow-clip">
              <span className="min-w-px flex-1 truncate text-[14px] leading-[20px] text-fg">{i.supplier_name_snapshot}</span>
              <StatusPill domain="invite" value={i.invitation_status} />
            </div>
          ))}
        </SectionCard>
      </div>

      <SectionCard fill>
        <CardHead
          title={`Compare offers · line ${curLine?.line_no ?? 1}`}
          right={<span className="shrink-0 whitespace-nowrap text-[12px] leading-[16px] text-fg-2">Ranked by landed cost</span>}
        />
        {rfq.lines.length > 1 && (
          <div className="flex flex-wrap gap-[8px]">
            {rfq.lines.map((l, i) => (
              <button
                key={l.id}
                type="button"
                onClick={() => { setLineIdx(i); setSelected(null); }}
                className={i === lineIdx
                  ? 'rounded-t-chip border border-brand-border bg-brand-subtle px-[16px] py-[10px] text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-fg'
                  : 'rounded-t-chip border border-line bg-subtle px-[16px] py-[10px] text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-fg-2 hover:bg-surface'}
              >
                LINE {l.line_no}
              </button>
            ))}
          </div>
        )}
        {rows.length === 0 ? (
          <div className="flex w-full justify-center">
            <EmptyState
              icon={IconFilePlus}
              title="No offers yet"
              body={rfq.invites.length ? 'Record each supplier quote as it arrives.' : 'Invite suppliers first, then record their quotes here.'}
            />
          </div>
        ) : (
          <div role="table" className="flex w-full flex-col gap-[14px]">
            <GridHead gap={12}>
              <HCell grow>Supplier</HCell>
              <HCell w={96}>Condition</HCell>
              {canSeeCost && <HCell w={104} align="right">Unit price</HCell>}
              {canSeeCost && <HCell w={84} align="right">Disc.</HCell>}
              {canSeeCost && <HCell w={84} align="right">Freight</HCell>}
              {canSeeCost && <HCell w={110} align="right">Landed</HCell>}
              <HCell w={44} align="right">Days</HCell>
              <HCell w={80}>Valid until</HCell>
              <HCell w={200}>Technical</HCell>
            </GridHead>
            <div className="flex w-full flex-col">
              {rows.map((r) => {
                const l = r.line;
                const isSel = l.id === sel;
                return (
                  <GridRow key={l.id} gap={12} highlight={isSel} onClick={() => setSelected(l.id)}>
                    <Cell grow><ItemTwo code={r.supplier} name={makePart(l)} /></Cell>
                    <Cell w={96}><Muted>{l.product_condition}</Muted></Cell>
                    {canSeeCost && <Cell w={104} align="right"><Num strong>{formatINR(l.quoted_unit_price)}</Num></Cell>}
                    {canSeeCost && <Cell w={84} align="right"><Num>{formatINR(l.quoted_discount)}</Num></Cell>}
                    {canSeeCost && <Cell w={84} align="right"><Num>{formatINR(l.freight_packing_nonrecoverable)}</Num></Cell>}
                    {canSeeCost && <Cell w={110} align="right"><Num strong>{formatINR(l.comparable_landed_cost)}</Num></Cell>}
                    <Cell w={44} align="right"><Num>{l.delivery_days ?? '—'}</Num></Cell>
                    <Cell w={80}><Muted>{formatDayMonth(r.validUntil)}</Muted></Cell>
                    <Cell w={200}>
                      {isSel && canAct && l.technical_status === 'PENDING' ? (
                        <div className="flex items-start gap-[6px] overflow-clip" onClick={(e) => e.stopPropagation()}>
                          <Button kind="secondary" icon={<Ic icon={IconCheck} size={18} />} busy={markValid.isPending} onClick={() => doValid(r)}>Valid</Button>
                          <Button kind="ghost" icon={<Ic icon={IconX} size={18} />} onClick={() => setInvalidLine({ line: l, title: `${r.supplier} · ${makePart(l)}` })}>Invalid</Button>
                        </div>
                      ) : (
                        <StatusPill domain="offerTechnical" value={l.technical_status} />
                      )}
                    </Cell>
                  </GridRow>
                );
              })}
            </div>
            <FormErrors error={markValid.error} />
          </div>
        )}
        <div className="flex w-full items-center gap-[10px] overflow-clip">
          <p className="min-w-px flex-1 text-[12px] leading-[16px] text-fg-2">{footerNote}</p>
          {canAct && (
            <Button kind="secondary" icon={<Ic icon={IconFilePlus} size={18} />} onClick={() => setRecordOpen(true)}>Record offer</Button>
          )}
          {canAct && jobId && (
            <ButtonLink to={`/p/jobs/${jobId}/quote`} kind="primary" icon={<Ic icon={IconReceipt} size={18} />}>Build customer quote</ButtonLink>
          )}
        </div>
      </SectionCard>
    </>
  );

  type Ev = { at: string; title: string; detail?: string };
  const events: Ev[] = [{ at: rfq.created_at, title: `RFQ created · ${rfq.lines.length === 1 ? '1 line' : `${rfq.lines.length} lines`}` }];
  if (rfq.sent_at) events.push({ at: rfq.sent_at, title: 'RFQ sent' });
  for (const i of rfq.invites) events.push({ at: i.created_at, title: `Supplier invited · ${i.supplier_name_snapshot}` });
  for (const o of rfq.offers) {
    const s = rfq.invites.find((i) => i.id === o.supplier_invite_id)?.supplier_name_snapshot ?? 'Supplier';
    events.push({ at: o.created_at, title: `Offer recorded · ${s}${o.version_no > 1 ? ` (v${o.version_no})` : ''}` });
    for (const l of o.lines) {
      if (l.technical_checked_at && l.technical_status !== 'PENDING') {
        events.push({
          at: l.technical_checked_at,
          title: `${l.technical_status === 'COMPLIANT' ? 'Marked compliant' : 'Marked non-compliant'} · ${s} ${makePart(l)}`,
          detail: l.technical_reason ?? undefined,
        });
      }
    }
  }
  events.sort((a, b) => b.at.localeCompare(a.at));

  const historyTab = (
    <SectionCard pad={24} fill>
      <CardHead title="History" />
      <div className="flex w-full flex-col">
        {events.map((e, i) => <TimelineItem key={`${e.at}-${i}`} title={e.title} meta={formatDayTime(e.at)} detail={e.detail} last={i === events.length - 1} />)}
      </div>
      <GapNote code="G?-C2-3">No RFQ audit/history endpoint: this timeline is rebuilt from the RFQ's own timestamps, and actor names are not readable (G17).</GapNote>
    </SectionCard>
  );

  return (
    <>
      <PageHeader title={label} meta={meta} />
      <PageContent>
        <TabBar label="RFQ sections">
          <Tab active={tab === 'lines'} onClick={() => setTab('lines')} label="Lines" />
          <Tab active={tab === 'suppliers'} onClick={() => setTab('suppliers')} label="Suppliers" count={rfq.invites.length} />
          <Tab active={tab === 'offers'} onClick={() => setTab('offers')} label="Offers" count={offerLineCount} />
          <Tab active={tab === 'history'} onClick={() => setTab('history')} label="History" />
        </TabBar>
        {result && <InlineAlert tone={result.tone} title={result.title}>{result.body}</InlineAlert>}
        {tab === 'lines' && linesTab}
        {tab === 'suppliers' && suppliersTab}
        {tab === 'offers' && offersTab}
        {tab === 'history' && historyTab}
      </PageContent>

      {canAct && (
        <>
          <InviteSupplierDrawer
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            rfq={rfq}
            subtitle={subtitle}
            jobId={jobId}
            onDone={(inv) => {
              setInviteOpen(false);
              setResult({ tone: 'success', title: 'Invite sent', body: `${inv.supplier_name_snapshot} has ${label}. You'll see their offer here.` });
              toast({ tone: 'success', title: 'Invite sent' });
            }}
          />
          <RecordOfferDrawer
            open={recordOpen}
            onClose={() => setRecordOpen(false)}
            rfq={rfq}
            names={names}
            jobId={jobId}
            onDone={(o, supplier) => {
              setRecordOpen(false);
              setTab('offers');
              const landed = o.lines.map((l) => l.comparable_landed_cost).filter(Boolean);
              setResult({
                tone: 'success',
                title: 'Offer recorded',
                body: `${supplier}${canSeeCost && landed.length === 1 ? ` · landed ${formatINR(landed[0])}` : ''} · mark it valid after a technical check.`,
              });
            }}
          />
          <MarkInvalidDrawer
            open={!!invalidLine}
            onClose={() => setInvalidLine(null)}
            rfqId={rfq.id}
            jobId={jobId}
            line={invalidLine?.line ?? null}
            title={invalidLine?.title ?? ''}
            onDone={(l) => {
              setInvalidLine(null);
              const b = bestValid(l.id);
              setResult({
                tone: 'blocked',
                title: 'Marked non-compliant',
                body: `Reason saved.${b ? ` ${b.supplier} is now the best valid offer.` : ''}`,
              });
            }}
          />
        </>
      )}
    </>
  );
}
