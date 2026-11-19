// Shared BR-11 Sales & Supply pieces.
// - SupplyTabs: Purchase "Sales & Supply" sub-tabs (PQ0 238:41847 "Tab bar": 1384×50, tabs Quotes to price · Orders ·
//   Outwards from x 25) = the Sales SS0 tab-bar treatment (glass-strong, radius 28, px-24 py-6, gap 32) with kit TabLinks.
// - Badges: use the kit <StatusPill domain value> with the BR-11 domains in src/lib/tones.ts (supplyQuoteStage,
//   supplyOrder, supplyReservation, …). Label = exact API enum with underscores as spaces.
import { TabLink } from '../../ui/desktop';

export function SupplyTabs() {
  return (
    <nav aria-label="Sales & Supply" className="glass-strong flex w-full items-start gap-[32px] overflow-x-auto overflow-y-clip rounded-t-card px-[24px] py-[6px]">
      <TabLink to="/p/supply/quotes" label="Quotes to price" />
      <TabLink to="/p/supply/orders" label="Orders" />
      <TabLink to="/p/supply/outwards" label="Outwards" />
    </nav>
  );
}
