// Local pieces for the JIN detail screens (BR-02 intake). Not in the shared desktop kit, so they live here.
// (The 480 P2a/P2b drawer is now the kit `Drawer variant="side"`.)
// - MetaItem: JIN header "Meta grid" cell (177:108522): 12/16 secondary label, gap 2, value 14/20 Medium or
//   Data/ID 13/18 mono.
// - isUuid: route-param check for /p/inward/:jinId (business rules stay in the DB).
import type { ReactNode } from 'react';
import { cx } from '../../../../ui/desktop';

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
export const shortId = (id: string) => id.slice(0, 8);

export function MetaItem({ label, value, mono, title }: { label: string; value: ReactNode; mono?: boolean; title?: string }) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap" title={title}>
      <p className="text-[12px] leading-[16px] text-fg-2">{label}</p>
      <p className={cx('text-fg', mono ? 'font-mono text-[13px] font-medium leading-[18px]' : 'text-[14px] font-medium leading-[20px]')}>{value}</p>
    </div>
  );
}

const dmf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
/** ISO date -> "06 Nov" (IST), as in the JIN header "Customer DC" cell. */
export const formatDayMonth = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dmf.format(d);
};
