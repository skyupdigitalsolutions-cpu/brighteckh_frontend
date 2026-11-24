// M2 · Assembly page (/p/stock/assemblies/:id) — Figma D·M2 177:105242 (+ 177:135365 "BOM line added", 177:135475 "BOM
// revision 3 (draft)"). Header: assembly code + "name · BOM revision n"; card: name, status badge, facts (Assembly code,
// Make / model, BOM revision, Lines); "Bill of materials" table: Item code 130 (mono) · Item flex · Qty per 80 → · UoM 70 ·
// Item status 150; warning strip "n line uses a DRAFT item — it can't be requested until approved."
//
// DATA: GET /stock/assemblies/{id}?revision= (PURCHASE). Deviations from Figma (see the report):
// - Read-only pill: "New BOM revision" and "Add line" are not shown. A Revision menu (not drawn) switches between the
//   revisions that have lines.
// - BOM revisions have no draft / released status and no "new revision" endpoint (GapNote GAP-STK-5); Make / model shows OEM
//   compatibility (GAP-STK-4).
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconAlertTriangle, IconListDetails } from '@tabler/icons-react';
import {
  EmptyState, ErrorState, FilterMenu, GapNote, Ic, PageContent, SkeletonRows, StateCard, StatusPill, TD, TH, TR,
  TableCard, errorBody,
} from '../../../ui/desktop';
import { enumLabel, formatQty } from '../../../lib/format';
import { Fact, TabCard } from '../jobtabs/ui';
import { useStockAssembly } from './api';
import { StockHeader, StockTabs } from './shared';

const COLS = { code: 130, qty: 80, uom: 70, status: 150 } as const;

export function AssemblyDetail() {
  const { id } = useParams<{ id: string }>();
  const [revision, setRevision] = useState<number | undefined>(undefined);
  const q = useStockAssembly(id, revision);
  const a = q.data;
  const blocked = a?.bom.filter((l) => !l.item_requestable) ?? [];
  const blockedStatuses = [...new Set(blocked.map((l) => enumLabel(l.item_status)))].join(' / ');
  const revOptions = (a?.bom_revisions ?? []).map((r) => ({ value: String(r), label: `Revision ${r}${r === a?.latest_bom_revision ? ' (latest)' : ''}` }));

  return (
    <>
      <StockHeader
        title={<span className="font-mono">{a?.assembly_code ?? 'Assembly'}</span>}
        meta={a ? `${a.standard_name}${a.bom_revision !== null ? ` · BOM revision ${a.bom_revision}` : ' · no BOM yet'}` : q.isError ? 'Assembly' : 'Loading…'}
        action={<Link to="/p/stock/assemblies" className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg-2 hover:text-fg">← All assemblies</Link>}
      />
      <PageContent className="flex-1">
        <StockTabs />
        {q.isPending ? <StateCard><SkeletonRows rows={6} /></StateCard> : q.isError || !a ? (
          <StateCard>
            <ErrorState title="Couldn't load this assembly" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
          </StateCard>
        ) : (
          <>
            <TabCard>
              <div className="flex w-full items-center gap-[12px]">
                <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold leading-[24px] text-fg">{a.standard_name}</h2>
                <StatusPill domain="itemStatus" value={a.status} />
                {revOptions.length > 1 && (
                  <FilterMenu value={String(a.bom_revision ?? '')} options={revOptions} allValue={String(a.latest_bom_revision ?? '')} align="end"
                    onChange={(v) => setRevision(Number(v))} />
                )}
              </div>
              <div className="flex flex-wrap gap-x-[32px] gap-y-[12px]">
                <Fact label="Assembly code">{a.assembly_code}</Fact>
                <Fact label="Make / model" mono={false}>{a.oem_compatibility ?? '—'}</Fact>
                <Fact label="BOM revision">{a.bom_revision ?? '—'}</Fact>
                <Fact label="Lines">{a.bom.length}</Fact>
                <Fact label="Type" mono={false}>{enumLabel(a.assembly_type)}</Fact>
                <Fact label="BOM status" mono={false}>{enumLabel(a.bom_status)}</Fact>
                <Fact label="Repairable · Saleable" mono={false}>{a.repairable ? 'Yes' : 'No'} · {a.saleable ? 'Yes' : 'No'}</Fact>
              </div>
            </TabCard>

            <TableCard fill>
              <h2 className="px-[4px] pb-[8px] text-[17px] font-semibold leading-[24px] text-fg">Bill of materials</h2>
              <div role="row" className="flex w-full shrink-0 items-start gap-[12px] overflow-clip rounded-t-popover bg-subtle px-[16px] py-[12px]">
                <TH w={COLS.code}>Item code</TH>
                <TH grow>Item</TH>
                <TH w={COLS.qty} align="right">Qty per</TH>
                <TH w={COLS.uom}>UoM</TH>
                <TH w={COLS.status}>Item status</TH>
              </div>
              {a.bom.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState icon={IconListDetails} title={a.bom_revisions.length ? `Revision ${a.bom_revision} has no lines` : 'No BOM lines yet'}
                    body={a.bom_revisions.length ? undefined : 'BOM lines are added in the Assembly Master.'} />
                </div>
              ) : (
                <div className={q.isPlaceholderData ? 'flex w-full flex-col opacity-60' : 'flex w-full flex-col'}>
                  {a.bom.map((l) => (
                    <TR key={l.id} to={`/p/stock?item=${l.item_id}`} className="gap-[12px]">
                      <TD w={COLS.code} kind="id">{l.item_code}</TD>
                      <TD grow kind="strong">{l.item_name}</TD>
                      <TD w={COLS.qty} align="right" kind="number">{formatQty(l.qty_per)}</TD>
                      <TD w={COLS.uom} kind="text">{l.uom}</TD>
                      <TD w={COLS.status}><StatusPill domain="itemStatus" value={l.item_status} /></TD>
                    </TR>
                  ))}
                </div>
              )}
              <div className="mt-[12px] flex w-full flex-col gap-[8px]">
                {blocked.length > 0 && (
                  <p role="status" className="flex w-full items-center gap-[8px] rounded-t-md bg-warn-bg px-[12px] py-[10px] text-[12px] leading-[16px] text-warn-fg">
                    <Ic icon={IconAlertTriangle} size={16} />
                    {`${blocked.length} line${blocked.length === 1 ? ' uses' : 's use'} a ${blockedStatuses} item — it can't be requested until approved.`}
                  </p>
                )}
                <GapNote code="GAP-STK-5">BOM revisions have no draft / released status and there is no &ldquo;new revision&rdquo; action: a revision is just the number its lines were added under.</GapNote>
              </div>
            </TableCard>
          </>
        )}
      </PageContent>
    </>
  );
}
