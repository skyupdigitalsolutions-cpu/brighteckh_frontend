// I1 · Stock · Availability (/p/stock, ?item=<id>) — Figma D·I1 177:105342; 03h 177:129117: picker open 177:129118,
// "IGBT · insufficient stock" 177:129199, "Bearing 6205" 177:129265, "Refreshed" 177:129328 (Refresh 177:105359).
// Layout: item picker bar; left gradient card "Allocatable now" big number + UoM, breakdown line, Refresh at the bottom;
// right card "By location role": 7 role badges, proportional bar, qty + UoM.
//
// DATA: GET /inventory/availability?company_id=<own>&item_id= (allocatable = fdn_allocatable; balances per location) +
// GET /stock/items/{id} for the code / name / UoM. Breakdown "Main store N − reserved R": reserved = MAIN_STORE − allocatable,
// which is exact (fdn_allocatable = MAIN_STORE on hand − ACTIVE reservations). Figma's "− holds 2" and "1 NOS in transit on
// PO-00044" have no source → GapNotes GAP-STK-1 / GAP-STK-2. Loading / empty / error states are the kit's (not drawn).
import { useSearchParams } from 'react-router-dom';
import { IconPackage, IconRefresh } from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthProvider';
import {
  Badge, Button, EmptyState, ErrorState, GapNote, Ic, LookupPicker, PageContent, StateCard, StatusPill, errorBody,
} from '../../../ui/desktop';
import { toneOf } from '../../../lib/tones';
import { enumLabel } from '../../../lib/format';
import { LOCATION_ROLES, useAvailability, useStockItem, type LocationRole } from './api';
import { StockHeader, StockTabs } from './shared';
import { approvedItemSource, num, qtyText } from './stockUtils';

const BAR: Record<string, string> = {
  success: 'bg-success', progress: 'bg-st-progress-fg', blocked: 'bg-danger', neutral: 'bg-fg-muted',
};

export function AvailabilityTab() {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const itemId = params.get('item');
  const setItem = (id: string | null) => setParams(id ? { item: id } : {}, { replace: true });

  const availQ = useAvailability(me?.company_id, itemId);
  const itemQ = useStockItem(itemId);
  const uom = itemQ.data?.base_uom ?? '';
  const refresh = () => { void availQ.refetch(); void itemQ.refetch(); };

  const byRole = new Map<LocationRole, number>();
  for (const b of availQ.data?.balances ?? []) byRole.set(b.role as LocationRole, (byRole.get(b.role as LocationRole) ?? 0) + num(b.qty_on_hand));
  const max = Math.max(1, ...byRole.values());
  const main = byRole.get('MAIN_STORE') ?? 0;
  const allocatable = num(availQ.data?.allocatable);
  const reserved = Math.max(0, main - allocatable);
  const inTransit = byRole.get('IN_TRANSIT') ?? 0;

  return (
    <>
      <StockHeader meta="Live stock by location. Allocatable = what a job can still reserve." />
      <PageContent className="flex-1">
        <StockTabs />
        <div className="glass w-full rounded-t-card px-[16px] py-[10px]">
          <LookupPicker
            label="Item"
            placeholder="Search approved items"
            value={itemId}
            onChange={(id) => setItem(id)}
            source={approvedItemSource}
            clearable
          />
        </div>

        {!itemId ? (
          <StateCard>
            <EmptyState icon={IconPackage} title="Pick an item to see its stock" body="Allocatable stock and every location balance for one approved item." />
          </StateCard>
        ) : availQ.isError ? (
          <StateCard>
            <ErrorState title="Couldn't load availability" body={errorBody(availQ.error)} onRetry={refresh} retrying={availQ.isFetching} />
          </StateCard>
        ) : (
          <div className="flex min-h-[520px] w-full flex-1 items-stretch gap-[16px]">
            <section className="flex w-[280px] shrink-0 flex-col gap-[12px] rounded-[24px] bg-gradient-to-br from-brand-subtle to-company-subtle p-[20px]">
              <p className="text-[14px] leading-[20px] text-fg-2">Allocatable now</p>
              <p className="font-mono text-[44px] font-semibold leading-[52px] text-fg" aria-live="polite">
                {availQ.isPending ? '…' : `${qtyText(allocatable)} ${uom}`}
              </p>
              {!availQ.isPending && (
                <p className="text-[12px] leading-[16px] text-fg-2">
                  Main store {qtyText(main)} − reserved {qtyText(reserved)}
                </p>
              )}
              {itemQ.data && (
                <div className="flex flex-col gap-[6px]">
                  <span className="font-mono text-[13px] font-medium leading-[18px] text-fg">{itemQ.data.item_code}</span>
                  <span className="text-[14px] leading-[20px] text-fg">{itemQ.data.standard_name}</span>
                  <StatusPill domain="itemStatus" value={itemQ.data.status} />
                </div>
              )}
              <div className="mt-auto">
                <Button kind="secondary" icon={<Ic icon={IconRefresh} size={18} />} onClick={refresh} busy={availQ.isFetching}>Refresh</Button>
              </div>
            </section>

            <section className="glass-strong flex min-w-px flex-1 flex-col gap-[14px] rounded-[24px] p-[20px]">
              <h2 className="text-[15px] font-semibold leading-[20px] text-fg">By location role</h2>
              {LOCATION_ROLES.map((role) => {
                const q = byRole.get(role) ?? 0;
                const tone = toneOf('locationRole', role);
                return (
                  <div key={role} className="flex w-full items-center gap-[16px]">
                    <span className="w-[130px] shrink-0"><Badge tone={tone} label={enumLabel(role)} /></span>
                    <div className="h-[6px] min-w-px flex-1 overflow-hidden rounded-full bg-subtle" aria-hidden>
                      <div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${availQ.isPending ? 0 : Math.max(q > 0 ? 2 : 0.6, (q / max) * 100)}%` }} />
                    </div>
                    <span className="w-[90px] shrink-0 text-right font-mono text-[13px] font-semibold leading-[18px] text-fg">
                      {availQ.isPending ? '…' : `${qtyText(q)} ${uom}`}
                    </span>
                  </div>
                );
              })}
              <div className="mt-auto flex w-full flex-col gap-[8px]">
                <GapNote code="GAP-STK-1">Holds: the ledger has no hold concept, so allocatable is main store minus reservations only.</GapNote>
                {inTransit > 0 && (
                  <GapNote code="GAP-STK-2">In-transit stock carries no purchase-order link, so the PO it is arriving on can&apos;t be shown.</GapNote>
                )}
              </div>
            </section>
          </div>
        )}
      </PageContent>
    </>
  );
}
