// Requests group routes (mounted by App.tsx under /p/requests): index = material-request inbox (Figma 03d 177:117991).
import { Route } from 'react-router-dom';
import { RequestsPage } from './RequestsPage';

export const RequestsRoutes = <Route index element={<RequestsPage />} />;
