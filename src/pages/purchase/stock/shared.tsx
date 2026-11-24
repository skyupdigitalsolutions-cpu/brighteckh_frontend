// Stock pill shared pieces: page header + the merged 4-tab bar (Figma sections 13 177:105341 / 12 177:104932: tab
// instances Availability · Journal · Items · Assemblies on D·I1 / D·I2 / D·M1 / D·M2). Non-component helpers: ./stockUtils.
import type { ReactNode } from 'react';
import { PageHeader, TabBar, TabLink } from '../../../ui/desktop';

export function StockHeader({ title = 'Stock', meta, action }: { title?: ReactNode; meta: ReactNode; action?: ReactNode }) {
  return <PageHeader title={title} meta={meta} action={action} />;
}

export function StockTabs() {
  return (
    <TabBar shadow label="Stock sections">
      <TabLink to="/p/stock" end label="Availability" />
      <TabLink to="/p/stock/journal" label="Journal" />
      <TabLink to="/p/stock/items" label="Items" />
      <TabLink to="/p/stock/assemblies" label="Assemblies" />
    </TabBar>
  );
}
