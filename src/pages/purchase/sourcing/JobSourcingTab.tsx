// Job workspace → Sourcing tab. Figma "D·P5 · Job · Sourcing · stock check" 177:103554 and
// "J4 · Stock check · new snapshot" 177:116808 (same layout + success "Result toast" 177:116821 under the tab bar).
// Layout (Content gap 20): Context row 177:103567 (chips + spacer + "New snapshot" secondary) → "Stock vs required"
// card 177:103579 → "Shortage sources" card 177:103644 (primary "Create RFQ for n shortage(s)").
// Added (not drawn on D·P5): an "RFQs for this job" card using the S0 table rows — GET /jobs/{id}/rfqs is the only
// way to reach a job's RFQs (G20: no cross-job RFQ list).
//
// API facts:
// - A stock check is a SNAPSHOT: POST /jobs/{id}/stock-checks posts nothing to the ledger. It needs the job's
//   submitted (non-DRAFT) material request; the button is a gated action (disabled + reason) when none exists.
//   `check_context` is left to the server default (MR_RECEIVED) — Figma J4 shows "MANUAL", which is not an enum value.
// - Every snapshot raises new shortage rows; GET /jobs/{id}/shortages returns all of them (newest first). The RFQ
//   drawer pre-selects the OPEN shortages of the current snapshot.
// - Cost columns (WAC landed, Last buy) + the "Costs visible to Purchase only" chip render only when
//   can.seeSupplierCost(role).
// - Item code/name come from the material-request catalogue (data.ts, G?-C2-1).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconClock, IconFileSearch, IconLock, IconPackageOff, IconReceipt, IconRefresh, IconShoppingCart,
} from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { Button } from '../../../ui/desktop/Button';
import { Badge, StatusPill } from '../../../ui/desktop/Badge';
import { Ic } from '../../../ui/desktop/Icon';
import { SkeletonRows } from '../../../ui/desktop/DataTable';
import { EmptyState, ErrorState, errorBody } from '../../../ui/desktop/States';
import { FormErrors, GapNote, InlineAlert } from '../../../ui/desktop/Feedback';
import { enumLabel, formatDayTime, formatINR, formatQty, formatTime } from '../../../lib/format';
import { useJobWorkspace } from '../job/JobWorkspace';
import {
  useRfqs, useRunStockCheck, useShortages, useStockChecks, type StockCheck, type StockCheckLine,
} from '../api';
import { useItemNames, useJobMaterialRequests, useRfqDetails, shortId, type ItemName } from './data';
import {
  CardHead, Cell, ContextChip, GridHead, GridRow, HCell, ItemTwo, Muted, Num, SectionCard,
} from './ui';
import { CreateRfqDrawer, type ShortageChoice } from './CreateRfqDrawer';
import { RfqTableHead, RfqTableRowView, rfqHref, rfqLabel } from './RfqTable';

const isShort = (l: StockCheckLine) => Number(l.shortage_quantity ?? 0) > 0;
const itemOf = (names: Map<string, ItemName>, bridgeId: string) =>
  names.get(bridgeId) ?? { code: shortId(bridgeId), name: `Item ${shortId(bridgeId)}`, uom: '' };

type Result = { title: string; body: string };

export function JobSourcingTab() {
  const { job } = useJobWorkspace();
  const nav = useNavigate();
  const { me } = useAuth();
  const role = me?.role;
  const canSeeCost = !!role && can.seeSupplierCost(role);
  const canAct = !!role && can.purchaseWork(role);

  const checksQ = useStockChecks(job.id);
  const shortagesQ = useShortages(job.id);
  const rfqsQ = useRfqs(job.id);
  const mrs = useJobMaterialRequests(job.id);
  const run = useRunStockCheck(job.id);

  const checks = checksQ.data ?? [];
  const current: StockCheck | undefined = checks.find((c) => c.is_current) ?? checks[0];
  const names = useItemNames(current?.material_request_id ?? mrs.submitted?.id ?? mrs.forJob[0]?.id).map;
  const mr = mrs.forJob.find((m) => m.id === current?.material_request_id) ?? mrs.submitted;

  const lineById = useMemo(() => {
    const m = new Map<string, { line: StockCheckLine; checkId: string }>();
    for (const c of checks) for (const l of c.lines) m.set(l.id, { line: l, checkId: c.id });
    return m;
  }, [checks]);

  const shortages = shortagesQ.data ?? [];
  const currentOpen = shortages.filter((s) => s.shortage_status === 'OPEN' && lineById.get(s.stock_check_line_id)?.checkId === current?.id);
  const openChoices: ShortageChoice[] = shortages
    .filter((s) => s.shortage_status === 'OPEN')
    .map((s) => {
      const l = lineById.get(s.stock_check_line_id)?.line;
      const it = l ? itemOf(names, l.item_bridge_id) : { code: shortId(s.id), name: 'Item', uom: '' };
      return { id: s.id, code: it.code, name: it.name, qty: s.shortage_quantity, uom: l?.uom_snapshot ?? '' };
    });

  const [result, setResult] = useState<Result | null>(null);
  const [rfqOpen, setRfqOpen] = useState(false);
  const unknownItems = (current?.lines ?? []).some((l) => !names.has(l.item_bridge_id));

  const snapshot = () => {
    if (!mrs.submitted) return;
    setResult(null);
    run.mutate({ material_request_id: mrs.submitted.id }, {
      onSuccess: (c) => {
        const short = c.lines.filter(isShort);
        setResult({
          title: 'New snapshot taken',
          body: short.length === 0
            ? `Stock re-read at ${formatTime(c.checked_at)}. No shortages.`
            : `Stock re-read at ${formatTime(c.checked_at)}. ${short.length === 1 ? 'Still 1 shortage' : `Still ${short.length} shortages`}: ${short.map((l) => itemOf(names, l.item_bridge_id).code).join(', ')}.`,
        });
      },
    });
  };

  const gateReason = mrs.query.isPending ? null
    : !mrs.submitted ? (mrs.forJob.length ? 'The material request is still a draft — the engineer must submit it first.' : 'No material request on this job yet.')
      : null;

  // ---------------------------------------------------------------- context row
  const context = (
    <div className="flex w-full flex-wrap items-center gap-[10px] overflow-clip">
      {current && (
        <ContextChip icon={IconClock}>Snapshot {formatDayTime(current.checked_at)} · {current.check_context}</ContextChip>
      )}
      {mr && (
        <ContextChip icon={IconReceipt}>{mr.request_number} · v{mr.current_version_no} · {enumLabel(mr.status)}</ContextChip>
      )}
      {canSeeCost && <ContextChip icon={IconLock} warn>Costs visible to Purchase only</ContextChip>}
      <div className="h-px min-w-px flex-1" />
      {canAct && (
        <div className="flex items-center gap-[10px]">
          {gateReason && <span className="text-[12px] leading-[16px] text-st-blocked-fg">{gateReason}</span>}
          <Button kind="secondary" icon={<Ic icon={IconRefresh} size={18} />} busy={run.isPending} disabled={!mrs.submitted} onClick={snapshot}>
            {current ? 'New snapshot' : 'Run stock check'}
          </Button>
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------- stock vs required
  const shortCount = current ? current.lines.filter(isShort).length : 0;
  const stockCard = (
    <SectionCard>
      <CardHead
        title="Stock vs required"
        right={current ? (shortCount > 0
          ? <Badge tone="blocked" label={shortCount === 1 ? '1 SHORTAGE' : `${shortCount} SHORTAGES`} />
          : <Badge tone="success" label="NO SHORTAGE" />) : undefined}
      />
      {checksQ.isPending ? (
        <div className="w-full"><SkeletonRows rows={3} widths={[260, 90, 90, 90, 90, 100, 90]} /></div>
      ) : checksQ.isError ? (
        <div className="flex w-full justify-center py-[24px]">
          <ErrorState title="Couldn't load stock checks" body={errorBody(checksQ.error)} onRetry={() => checksQ.refetch()} retrying={checksQ.isFetching} />
        </div>
      ) : !current ? (
        <div className="flex w-full justify-center">
          <EmptyState
            icon={IconFileSearch}
            title="No stock check yet"
            body={canAct
              ? (gateReason ?? 'Run a stock check to compare the material request against store stock. It is a snapshot — nothing is reserved or posted.')
              : 'Purchase has not run a stock check for this job.'}
          />
        </div>
      ) : (
        <div role="table" className="flex w-full flex-col gap-[14px]">
          <GridHead>
            <HCell grow>Item</HCell>
            <HCell w={90} align="right">Required</HCell>
            <HCell w={90} align="right">On hand</HCell>
            <HCell w={90} align="right">Reserved</HCell>
            <HCell w={90} align="right">Eng. held</HCell>
            <HCell w={100} align="right">Available</HCell>
            <HCell w={90} align="right">Shortage</HCell>
            {canSeeCost && <HCell w={120} align="right">WAC landed</HCell>}
            {canSeeCost && <HCell w={110} align="right">Last buy</HCell>}
          </GridHead>
          <div className="flex w-full flex-col">
            {current.lines.map((l) => {
              const it = itemOf(names, l.item_bridge_id);
              const u = l.uom_snapshot;
              return (
                <GridRow key={l.id} highlight={isShort(l)}>
                  <Cell grow><ItemTwo code={it.code} name={it.name} /></Cell>
                  <Cell w={90} align="right"><Num>{formatQty(l.required_quantity, u)}</Num></Cell>
                  <Cell w={90} align="right"><Num>{formatQty(l.store_on_hand, u)}</Num></Cell>
                  <Cell w={90} align="right"><Num>{formatQty(l.store_reserved, u)}</Num></Cell>
                  <Cell w={90} align="right"><Num>{formatQty(l.engineer_held, u)}</Num></Cell>
                  <Cell w={100} align="right"><Num>{formatQty(l.available_to_allocate, u)}</Num></Cell>
                  <Cell w={90} align="right">
                    {isShort(l)
                      ? <Badge tone="blocked" label={formatQty(l.shortage_quantity, u)} />
                      : <Badge tone="success" label="0" />}
                  </Cell>
                  {canSeeCost && <Cell w={120} align="right"><Num strong>{l.wac_landed_unit_cost ? formatINR(l.wac_landed_unit_cost) : '—'}</Num></Cell>}
                  {canSeeCost && <Cell w={110} align="right"><Num strong>{l.latest_purchase_unit_cost ? formatINR(l.latest_purchase_unit_cost) : '—'}</Num></Cell>}
                </GridRow>
              );
            })}
          </div>
          {unknownItems && (
            <GapNote code="G?-C2-1">Some lines show the catalogue id only: there is no item lookup by item_bridge_id, and this item is not in the approved catalogue list.</GapNote>
          )}
        </div>
      )}
    </SectionCard>
  );

  // ---------------------------------------------------------------- shortage sources
  const shortageCard = (
    <SectionCard>
      <CardHead
        title="Shortage sources"
        right={canAct && openChoices.length > 0 ? (
          <Button kind="primary" icon={<Ic icon={IconShoppingCart} size={18} />} onClick={() => setRfqOpen(true)}>
            {(currentOpen.length || openChoices.length) === 1 ? 'Create RFQ for 1 shortage' : `Create RFQ for ${currentOpen.length || openChoices.length} shortages`}
          </Button>
        ) : undefined}
      />
      {shortagesQ.isPending ? (
        <div className="w-full"><SkeletonRows rows={2} widths={[260, 140, 160, 160]} /></div>
      ) : shortagesQ.isError ? (
        <div className="flex w-full justify-center py-[24px]">
          <ErrorState title="Couldn't load shortages" body={errorBody(shortagesQ.error)} onRetry={() => shortagesQ.refetch()} retrying={shortagesQ.isFetching} />
        </div>
      ) : shortages.length === 0 ? (
        <div className="flex w-full justify-center">
          <EmptyState icon={IconPackageOff} title="No shortages" body={current ? 'Every line of the current snapshot is covered by store stock.' : 'Shortages appear after a stock check.'} />
        </div>
      ) : (
        <div role="table" className="flex w-full flex-col gap-[14px]">
          <GridHead>
            <HCell grow>Item</HCell>
            <HCell w={140} align="right">Shortage qty</HCell>
            <HCell w={160}>Status</HCell>
            <HCell w={160}>Raised</HCell>
          </GridHead>
          <div className="flex w-full flex-col">
            {shortages.map((s) => {
              const l = lineById.get(s.stock_check_line_id)?.line;
              const it = l ? itemOf(names, l.item_bridge_id) : { code: shortId(s.id), name: 'Item', uom: '' };
              return (
                <GridRow key={s.id}>
                  <Cell grow><ItemTwo code={it.code} name={it.name} /></Cell>
                  <Cell w={140} align="right"><Num>{formatQty(s.shortage_quantity, l?.uom_snapshot)}</Num></Cell>
                  <Cell w={160}><StatusPill domain="shortage" value={s.shortage_status} /></Cell>
                  <Cell w={160}><Muted>{formatDayTime(s.created_at)}</Muted></Cell>
                </GridRow>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );

  // ---------------------------------------------------------------- RFQs for this job
  const details = useRfqDetails(rfqsQ.data);
  const rfqCard = (
    <SectionCard fill>
      <CardHead title="RFQs for this job" />
      {rfqsQ.isPending ? (
        <div className="w-full"><SkeletonRows rows={2} widths={[120, 100, 260, 130, 130, 110, 170]} /></div>
      ) : rfqsQ.isError ? (
        <div className="flex w-full justify-center py-[24px]">
          <ErrorState title="Couldn't load RFQs" body={errorBody(rfqsQ.error)} onRetry={() => rfqsQ.refetch()} retrying={rfqsQ.isFetching} />
        </div>
      ) : (rfqsQ.data ?? []).length === 0 ? (
        <div className="flex w-full justify-center">
          <EmptyState icon={IconShoppingCart} title="No RFQ yet" body="Create an RFQ from the open shortages above. Each RFQ belongs to this job only." />
        </div>
      ) : (
        <div role="table" className="flex w-full flex-col">
          <RfqTableHead canSeeCost={canSeeCost} />
          {(rfqsQ.data ?? []).map((h, i) => (
            <RfqTableRowView
              key={h.id}
              row={{ header: h, detail: details[i]?.data, job: { id: job.id, number: job.job_number } }}
              names={names}
              canSeeCost={canSeeCost}
              canAct={canAct}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );

  return (
    <>
      {result && <InlineAlert tone="success" title={result.title}>{result.body}</InlineAlert>}
      <FormErrors error={run.error} title="The stock check was not recorded" />
      {context}
      {stockCard}
      {shortageCard}
      {rfqCard}
      {canAct && (
        <CreateRfqDrawer
          open={rfqOpen}
          onClose={() => setRfqOpen(false)}
          jobId={job.id}
          jobNumber={job.job_number}
          shortages={openChoices}
          preselected={(currentOpen.length ? currentOpen : openChoices).map((s) => s.id)}
          onCreated={(r) => {
            setRfqOpen(false);
            nav(rfqHref(r.id, job.id, { tab: 'suppliers', created: rfqLabel(r) }));
          }}
        />
      )}
    </>
  );
}
