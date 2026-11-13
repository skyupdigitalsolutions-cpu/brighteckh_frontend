// RFQ detail route, mounted by App.tsx under /p/rfqs → /p/rfqs/:rfqId (Figma S1 frames + D·P6 177:103669).
import { Route } from 'react-router-dom';
import { RfqDetailPage } from './RfqDetailPage';

export const RfqRoutes = <Route path=":rfqId" element={<RfqDetailPage />} />;
