// Inward register routes (mounted by App.tsx under /p/inward): index = D·P1 Inward register (Figma 177:102734).
// The JIN detail (/p/inward/:jinId) is owned by the detail group.
import { Route } from 'react-router-dom';
import { InwardRegisterPage } from './InwardRegisterPage';

export const InwardRegisterRoutes = <Route index element={<InwardRegisterPage />} />;
