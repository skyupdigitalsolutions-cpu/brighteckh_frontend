// RFQ table — Figma "S0 · RFQ list" table card 177:120040 + row menus 177:120567 … 177:121671.
// Header row 177:120041: bg-subtle, radius 20, px-16 py-12, gap 12; TH 12/16 SemiBold secondary.
// Row 177:120058: px-16 py-12, gap 12, 1px bottom border; hover = surface (kit TR). Cells: RFQ 120 (Data/ID primary) ·
// Job 100 (Data/ID secondary, link) · Item grow (Body strong + 12/16 muted "code · qty") · Responses 130 (Body
// secondary) · Best landed 130 right (Data/Number strong) · Needed by 110 · Status 170 · kebab 36.
// Row menu (177:120567): Open RFQ · Invite supplier · Record offer · Cancel RFQ. "Cancel RFQ" is NOT rendered: the
// API has no cancel endpoint (gap G?-C2-4) — hidden, not disabled.
//
// Data per row comes from GET /rfqs/{id} (the list endpoint returns headers only):
// - Item = first RFQ line (item name via the catalogue map); "+n more" when the RFQ has several lines.
// - Responses = invites with at least one recorded offer / invites. (`invitation_status` is not moved to RESPONDED
//   by the API when an offer is recorded, so the count is taken from the offers themselves.)
// - Best landed = lowest `comparable_landed_cost` among offer lines not marked NONCOMPLIANT (display ranking only).
//   Supplier cost: the column is absent unless can.seeSupplierCost(role).
// - Needed by = earliest `desired_delivery_by` across lines.
import { Link, useNavigate } from 'react-router-dom';
import { IconEye, IconFilePlus, IconUser } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { StatusPill } from '../../../ui/desktop/Badge';
import { RowMenuTrigger, type RowMenuItem } from '../../../ui/desktop/RowMenu';
import { cx } from '../../../ui/desktop/Icon';
import { formatINR, formatQty } from '../../../lib/format';
import type { Rfq, RfqRow } from '../api';
import { formatDayMonth } from './ui';
import { shortId, type ItemName } from './data';

export type RfqTableRow = {
  header: RfqRow;
  detail?: Rfq;
  /** Job the RFQ was raised for, when known (the RFQ itself carries no job id). */
  job?: { id: string; number: string };
};

const W = { rfq: 120, job: 100, resp: 130, best: 130, need: 110, status: 170, menu: 36 };

export const rfqLabel = (r: { rfq_number: string | null; rfq_seq: string }) => r.rfq_number ?? `RFQ #${r.rfq_seq}`;

export function rfqHref(rfqId: string, jobId?: string, extra?: Record<string, string>) {
  const p = new URLSearchParams({ ...(jobId ? { job: jobId } : {}), ...(extra ?? {}) });
  const qs = p.toString();
  return `/p/rfqs/${rfqId}${qs ? `?${qs}` : ''}`;
}

function TH({ w, grow, align, children }: { w?: number; grow?: boolean; align?: 'right'; children?: ReactNode }) {
  return (
    <div role="columnheader" className={cx('flex items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0', align && 'justify-end')} style={grow ? undefined : { width: w }}>
      <span className="whitespace-nowrap text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{children ?? '​'}</span>
    </div>
  );
}
function TD({ w, grow, align, children }: { w?: number; grow?: boolean; align?: 'right'; children: ReactNode }) {
  return (
    <div role="cell" className={cx('flex min-w-0 items-center overflow-clip', grow ? 'min-w-px flex-1' : 'shrink-0', align && 'justify-end')} style={grow ? undefined : { width: w }}>
      {children}
    </div>
  );
}

export function RfqTableHead({ canSeeCost }: { canSeeCost: boolean }) {
  return (
    <div role="row" className="flex w-full shrink-0 items-start gap-[12px] overflow-clip rounded-t-popover bg-subtle px-[16px] py-[12px]">
      <TH w={W.rfq}>RFQ</TH>
      <TH w={W.job}>Job</TH>
      <TH grow>Item</TH>
      <TH w={W.resp}>Responses</TH>
      {canSeeCost && <TH w={W.best} align="right">Best landed</TH>}
      <TH w={W.need}>Needed by</TH>
      <TH w={W.status}>Status</TH>
      <TH w={W.menu} />
    </div>
  );
}

export function bestLanded(detail: Rfq | undefined): string | null {
  if (!detail) return null;
  let best: string | null = null;
  for (const o of detail.offers) {
    for (const l of o.lines) {
      if (l.technical_status === 'NONCOMPLIANT' || l.comparable_landed_cost == null) continue;
      if (best == null || Number(l.comparable_landed_cost) < Number(best)) best = l.comparable_landed_cost;
    }
  }
  return best;
}

export function RfqTableRowView({ row, names, canSeeCost, canAct }: {
  row: RfqTableRow; names: Map<string, ItemName>; canSeeCost: boolean; canAct: boolean;
}) {
  const nav = useNavigate();
  const { header: h, detail: d, job } = row;
  const first = d?.lines[0];
  const item = first ? names.get(first.item_bridge_id) : undefined;
  const responded = d ? d.invites.filter((i) => d.offers.some((o) => o.supplier_invite_id === i.id)).length : null;
  const best = bestLanded(d);
  const needed = d?.lines.map((l) => l.desired_delivery_by).filter((x): x is string => !!x).sort()[0];
  const href = rfqHref(h.id, job?.id);

  const items: RowMenuItem[] = [{ label: 'Open RFQ', icon: IconEye, onSelect: () => nav(href) }];
  if (canAct) {
    items.push({ label: 'Invite supplier', icon: IconUser, onSelect: () => nav(rfqHref(h.id, job?.id, { tab: 'suppliers', action: 'invite' })) });
    items.push({ label: 'Record offer', icon: IconFilePlus, onSelect: () => nav(rfqHref(h.id, job?.id, { tab: 'offers', action: 'record' })) });
  }

  return (
    <Link role="row" to={href} className="flex w-full shrink-0 items-center gap-[12px] overflow-clip border-b border-line px-[16px] py-[12px] transition-colors hover:bg-surface">
      <TD w={W.rfq}><span className="truncate whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-fg">{rfqLabel(h)}</span></TD>
      <TD w={W.job}>
        {job
          ? <span className="truncate whitespace-nowrap font-mono text-[13px] font-medium leading-[18px] text-fg-2">{job.number}</span>
          : <span className="text-[14px] leading-[20px] text-fg-2">—</span>}
      </TD>
      <TD grow>
        <div className="flex min-w-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
          <span className="truncate text-[14px] font-medium leading-[20px] text-fg">
            {first ? (item?.name ?? `Item ${shortId(first.item_bridge_id)}`) : d ? 'No lines' : '…'}
            {d && d.lines.length > 1 ? ` +${d.lines.length - 1} more` : ''}
          </span>
          {first && (
            <span className="truncate text-[12px] leading-[16px] text-fg-muted">
              {[item?.code, formatQty(first.quantity, first.uom)].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </TD>
      <TD w={W.resp}>
        <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{d ? `${responded} / ${d.invites.length} responded` : '…'}</span>
      </TD>
      {canSeeCost && (
        <TD w={W.best} align="right">
          <span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{best ? formatINR(best) : '—'}</span>
        </TD>
      )}
      <TD w={W.need}><span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{formatDayMonth(needed)}</span></TD>
      <TD w={W.status}><StatusPill domain="rfq" value={h.rfq_status} /></TD>
      <TD w={W.menu}><RowMenuTrigger items={items} label={`Actions for ${rfqLabel(h)}`} /></TD>
    </Link>
  );
}
