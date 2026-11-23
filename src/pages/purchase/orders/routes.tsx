// Orders group routes (mounted by App.tsx under /p/orders): index = supplier PO register O0 (Figma 03g 177:125758),
// :id = PO page O1.
import { Route } from 'react-router-dom';
import { OrdersPage } from './OrdersPage';
import { OrderDetail } from './OrderDetail';

export const OrdersRoutes = (
  <>
    <Route index element={<OrdersPage />} />
    <Route path=":id" element={<OrderDetail />} />
  </>
);
