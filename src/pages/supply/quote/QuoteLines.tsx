// Quote line tables shared by SQS1 (Sales view) and PQ1 (Purchase builder).
// Sales (239:46840, gap 10): Item flex · Condition 100 · Qty 70 → · Unit price 120 → (Data/Number strong) ·
//   List price 110 → (Data/Number) · Line total 120 → (strong). Rows px-16 py-10.
// Builder (238:45599, gap 10): "Item · stock (indicative)" flex (name 14/20 Medium + 12/16 "n NOS allocatable ·
//   indicative", blocked-fg when 0) · Cond. 80 · Qty 60 → · Unit price 110 → (16px lock when issued) · List price 100 →
//   · Line total 112 →. The frame's Supplier cost 110 / Margin 72 columns are omitted (no API source — see GapNote).
import { IconLock } from '@tabler/icons-react';
import { formatPaise, formatQty } from '../../../lib/format';
import { Ic, cx } from '../../../ui/desktop';
import type { QuoteRevision } from '../api';
import { ConditionBadge, MiniHead, MiniRow, type Col } from './local';
import { cellText, itemLabel, useItems } from './data';

type Line = QuoteRevision['lines'][number];
const money = (v: string | null | undefined) => (v == null ? '—' : formatPaise(v));

const SALES_COLS: Col[] = [{ grow: true }, { w: 100 }, { w: 70, right: true }, { w: 120, right: true }, { w: 110, right: true }, { w: 120, right: true }];

export function SalesLinesTable({ lines }: { lines: Line[] }) {
  const items = useItems(lines.map((l) => l.item_id));
  return (
    <div className="flex w-full flex-col">
      <MiniHead gap={10} cols={SALES_COLS} labels={['Item', 'Condition', 'Qty', 'Unit price', 'List price', 'Line total']} />
      {lines.length === 0 && <p className="px-[16px] py-[12px] text-[14px] leading-[20px] text-fg-2">No lines on this revision yet.</p>}
      {lines.map((l) => (
        <MiniRow
          key={l.id}
          gap={10}
          cols={SALES_COLS}
          cells={[
            <span className={cellText.strong} title={l.description_snapshot}>
              {itemLabel(items.map[l.item_id]?.item_code, l.description_snapshot)}{l.alternative_label ? ` · ${l.alternative_label}` : ''}
            </span>,
            <ConditionBadge value={l.product_condition} />,
            <span className={cellText.num}>{formatQty(l.qty, l.uom)}</span>,
            <span className={cellText.numStrong}>{money(l.unit_price_paise)}</span>,
            <span className={cellText.num}>{money(l.list_unit_price_paise)}</span>,
            <span className={cellText.numStrong}>{money(l.line_total_paise)}</span>,
          ]}
        />
      ))}
    </div>
  );
}

const BUILDER_COLS: Col[] = [{ grow: true }, { w: 80 }, { w: 60, right: true }, { w: 110, right: true }, { w: 100, right: true }, { w: 112, right: true }];

export function BuilderLinesTable({ lines, locked }: { lines: Line[]; locked: boolean }) {
  const items = useItems(lines.map((l) => l.item_id));
  return (
    <div className="flex w-full flex-col">
      <MiniHead gap={10} cols={BUILDER_COLS} labels={['Item · stock (indicative)', 'Cond.', 'Qty', 'Unit price', 'List price', 'Line total']} />
      {lines.length === 0 && <p className="px-[16px] py-[12px] text-[14px] leading-[20px] text-fg-2">No lines yet. Add the catalogue items the customer asked for.</p>}
      {lines.map((l) => {
        const zero = /^0*(\.0*)?$/.test(l.ledger_allocatable_qty);
        return (
          <MiniRow
            key={l.id}
            gap={10}
            cols={BUILDER_COLS}
            cells={[
              <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip py-[9px]">
                <p className="line-clamp-2 text-[14px] font-medium leading-[20px] text-fg">
                  {itemLabel(items.map[l.item_id]?.item_code, l.description_snapshot)}{l.alternative_label ? ` · ${l.alternative_label}` : ''}
                </p>
                <p className={cx('whitespace-nowrap text-[12px] leading-[16px]', zero ? 'text-st-blocked-fg' : 'text-fg-2')}>
                  {formatQty(l.ledger_allocatable_qty, l.uom)} allocatable · indicative
                </p>
              </div>,
              <ConditionBadge value={l.product_condition} />,
              <span className={cellText.num}>{formatQty(l.qty, l.uom)}</span>,
              <span className={cx(cellText.numStrong, 'flex items-center gap-[4px]')}>
                {locked && <Ic icon={IconLock} size={14} className="text-fg-2" />}{money(l.unit_price_paise)}
              </span>,
              <span className={cellText.num}>{money(l.list_unit_price_paise)}</span>,
              <span className={cellText.numStrong}>{money(l.line_total_paise)}</span>,
            ]}
          />
        );
      })}
    </div>
  );
}
