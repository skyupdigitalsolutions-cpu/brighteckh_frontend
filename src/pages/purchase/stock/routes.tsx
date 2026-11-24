// Stock group routes (mounted by App.tsx under /p/stock): index = Availability (I1, ?item=<id>), journal (I2), items (M1 +
// item drawer), assemblies (M2 list) and assemblies/:id (D·M2 assembly page). All reads are PURCHASE only.
import { Route } from 'react-router-dom';
import { AvailabilityTab } from './AvailabilityTab';
import { JournalTab } from './JournalTab';
import { ItemsTab } from './ItemsTab';
import { AssembliesTab } from './AssembliesTab';
import { AssemblyDetail } from './AssemblyDetail';

export const StockRoutes = (
  <>
    <Route index element={<AvailabilityTab />} />
    <Route path="journal" element={<JournalTab />} />
    <Route path="items" element={<ItemsTab />} />
    <Route path="assemblies" element={<AssembliesTab />} />
    <Route path="assemblies/:id" element={<AssemblyDetail />} />
  </>
);
