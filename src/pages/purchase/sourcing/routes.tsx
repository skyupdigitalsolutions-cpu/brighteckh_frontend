// Sourcing group routes, mounted by App.tsx under /p/sourcing: index = "S0 · RFQ list" (Figma 177:120022).
import { Route } from 'react-router-dom';
import { RfqListPage } from './RfqListPage';

export const SourcingRoutes = <Route index element={<RfqListPage />} />;
