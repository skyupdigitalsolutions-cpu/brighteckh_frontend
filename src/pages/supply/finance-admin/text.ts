// Stage D display helpers (non-component exports kept out of the .tsx files for react-refresh).
import { enumLabel, formatQty } from '../../../lib/format';
import type { OrderRow } from '../api';

/** "FIXED AMOUNT" · "PERCENTAGE · 20 %" · "FULL" (FA0 Advance column, FA1 subtitle). */
export function advanceText(r: Pick<OrderRow, 'advance_kind' | 'advance_required_percent'>) {
  if (!r.advance_kind) return '—';
  const k = enumLabel(r.advance_kind);
  return r.advance_kind === 'PERCENTAGE' && r.advance_required_percent ? `${k} · ${formatQty(r.advance_required_percent)} %` : k;
}
