// RFQ tables — Figma "S0 · RFQ list" table card 177:120040 + row menus 177:120567 … 177:121671.
// Header row 177:120041: bg-subtle, radius 20, px-16 py-12, gap 12; TH 12/16 SemiBold secondary.
// Row 177:120058: px-16 py-12, gap 12, 1px bottom border; hover = surface; menu open = surface tint (RowMenuTrigger
// onOpenChange). Row menu (177:120567): Open RFQ · Invite supplier · Record offer · Cancel RFQ. "Cancel RFQ" is NOT
// rendered: the API has no cancel endpoint (C2-4) — hidden, not disabled.
//
// Two row views:
// - RfqListRowView (S0 /p/sourcing) — one GET /rfqs row, no extra requests. The list endpoint returns counts and no
//   prices or lines, so (API wins) Figma's Item / Best landed / Needed by cells become Customer (+ "n lines") ·
//   Responses ("n offers · m invited") · Sent. Figma: RFQ 120 · Job 100 · Item grow · Responses 130 · Best landed 130
//   · Needed by 110 · Status 170 · kebab 36.
// - RfqTableRowView (job Sourcing tab) — the job's RFQs (GET /jobs/{id}/rfqs) + GET /rfqs/{id} per RFQ, as drawn:
//   Item = first RFQ line (item_name/item_code from the API) + "+n more"; Responses = invites with ≥1 recorded offer /
//   invites; Best landed = lowest `comparable_landed_cost` among offer lines not NONCOMPLIANT (only when
//   can.seeSupplierCost(role)); Needed by = earliest `desired_delivery_by`.
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconEye, IconFilePlus, IconUser } from '@tabler/icons-react';
import { StatusPill } from '../../../ui/desktop/Badge';
import { RowMenuTrigger, type RowMenuItem } from '../../../ui/desktop/RowMenu';
import { cx } from '../../../ui/desktop/Icon';
import { formatINR, formatQty } from '../../../lib/format';
import type { Rfq, RfqListRow, RfqRow } from '../api';
import { formatDayMonth } from './ui';
import { shortId } from './data';

export type RfqTableRow = {
  header: RfqRow;
  detail?: Rfq;
  /** Job the RFQ was raised for (the job Sourcing tab knows it). */
  job?: { id: string; number: string };
};

const W = { rfq: 120, job: 100, resp: 130, best: 130, need: 110, status: 170, menu: 36 };

export const rfqLabel = (r: { rfq_number: string | null; rfq_seq: string }) => r.rfq_number ?? `RFQ #${r.rfq_seq}`;

/** /p/rfqs/{id} (+ tab / action / created). The RFQ detail reads its job from GET /rfqs/{id}. */
export function rfqHref(rfqId: string, extra?: Record<string, string>) {
  const qs = new URLSearchParams(extra ?? {}).toString();
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
const headCls = 'flex w-full shrink-0 items-start gap-[12px] overflow-clip rounded-t-popover bg-subtle px-[16px] py-[12px]';
const rowCls = 'flex w-full shrink-0 items-center gap-[12px] overflow-clip border-b border-line px-[16px] py-[12px] transition-colors hover:bg-surface';
const Id = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <span className={cx('truncate whitespace-nowrap font-mono text-[13px] font-medium leading-[18px]', muted ? 'text-fg-2' : 'text-fg')}>{children}</span>
);
const Body2 = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{children}</span>;

function menuItems(id: string, canAct: boolean, nav: (to: string) => void): RowMenuItem[] {
  const items: RowMenuItem[] = [{ label: 'Open RFQ', icon: IconEye, onSelect: () => nav(rfqHref(id)) }];
  if (canAct) {
    items.push({ label: 'Invite supplier', icon: IconUser, onSelect: () => nav(rfqHref(id, { tab: 'suppliers', action: 'invite' })) });
    items.push({ label: 'Record offer', icon: IconFilePlus, onSelect: () => nav(rfqHref(id, { tab: 'offers', action: 'record' })) });
  }
  return items;
}

// ---------------------------------------------------------------- S0 list (GET /rfqs)
const LW = { rfq: 120, job: 100, resp: 160, sent: 110, status: 170, menu: 36 };

export function RfqListHead() {
  return (
    <div role="row" className={headCls}>
      <TH w={LW.rfq}>RFQ</TH>
      <TH w={LW.job}>Job</TH>
      <TH grow>Customer</TH>
      <TH w={LW.resp}>Responses</TH>
      <TH w={LW.sent}>Sent</TH>
      <TH w={LW.status}>Status</TH>
      <TH w={LW.menu} />
    </div>
  );
}

export function RfqListRowView({ row: r, canAct }: { row: RfqListRow; canAct: boolean }) {
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const label = rfqLabel(r);
  return (
    <Link role="row" to={rfqHref(r.id)} className={cx(rowCls, menuOpen && 'bg-surface')}>
      <TD w={LW.rfq}><Id>{label}</Id></TD>
      <TD w={LW.job}>{r.job_number ? <Id muted>{r.job_number}</Id> : <Body2>—</Body2>}</TD>
      <TD grow>
        <div className="flex min-w-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
          <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{r.customer_name ?? '—'}</span>
          <span className="truncate text-[12px] leading-[16px] text-fg-muted">{r.lines_count === 1 ? '1 line' : `${r.lines_count} lines`}</span>
        </div>
      </TD>
      <TD w={LW.resp}>
        <Body2>{`${r.offers_count === 1 ? '1 offer' : `${r.offers_count} offers`} · ${r.invites_count} invited`}</Body2>
      </TD>
      <TD w={LW.sent}><Body2>{formatDayMonth(r.sent_at)}</Body2></TD>
      <TD w={LW.status}><StatusPill domain="rfq" value={r.rfq_status} /></TD>
      <TD w={LW.menu}><RowMenuTrigger items={menuItems(r.id, canAct, nav)} label={`Actions for ${label}`} onOpenChange={setMenuOpen} /></TD>
    </Link>
  );
}

// ---------------------------------------------------------------- job Sourcing tab (header + detail per RFQ)
export function RfqTableHead({ canSeeCost }: { canSeeCost: boolean }) {
  return (
    <div role="row" className={headCls}>
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

export function RfqTableRowView({ row, canSeeCost, canAct }: { row: RfqTableRow; canSeeCost: boolean; canAct: boolean }) {
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { header: h, detail: d, job } = row;
  const first = d?.lines[0];
  const responded = d ? d.invites.filter((i) => d.offers.some((o) => o.supplier_invite_id === i.id)).length : null;
  const best = bestLanded(d);
  const needed = d?.lines.map((l) => l.desired_delivery_by).filter((x): x is string => !!x).sort()[0];

  return (
    <Link role="row" to={rfqHref(h.id)} className={cx(rowCls, menuOpen && 'bg-surface')}>
      <TD w={W.rfq}><Id>{rfqLabel(h)}</Id></TD>
      <TD w={W.job}>{job ? <Id muted>{job.number}</Id> : <Body2>—</Body2>}</TD>
      <TD grow>
        <div className="flex min-w-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
          <span className="truncate text-[14px] font-medium leading-[20px] text-fg">
            {first ? (first.item_name ?? `Item ${shortId(first.item_bridge_id)}`) : d ? 'No lines' : '…'}
            {d && d.lines.length > 1 ? ` +${d.lines.length - 1} more` : ''}
          </span>
          {first && (
            <span className="truncate text-[12px] leading-[16px] text-fg-muted">
              {[first.item_code, formatQty(first.quantity, first.uom)].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </TD>
      <TD w={W.resp}><Body2>{d ? `${responded} / ${d.invites.length} responded` : '…'}</Body2></TD>
      {canSeeCost && (
        <TD w={W.best} align="right">
          <span className="whitespace-nowrap font-mono text-[14px] font-semibold leading-[20px] text-fg">{best ? formatINR(best) : '—'}</span>
        </TD>
      )}
      <TD w={W.need}><Body2>{formatDayMonth(needed)}</Body2></TD>
      <TD w={W.status}><StatusPill domain="rfq" value={h.rfq_status} /></TD>
      <TD w={W.menu}><RowMenuTrigger items={menuItems(h.id, canAct, nav)} label={`Actions for ${rfqLabel(h)}`} onOpenChange={setMenuOpen} /></TD>
    </Link>
  );
}
