// BR-02 JIN detail. Mount under /p/inward → /p/inward/:jinId.
// CreateJinDrawer (the "New JIN" drawer) is exported from ./CreateJinDrawer for the inward register.
import { Route } from 'react-router-dom';
import { JinDetailPage } from './JinDetailPage';

export const JinDetailRoutes = <Route path=":jinId" element={<JinDetailPage />} />;

export { CreateJinDrawer } from './CreateJinDrawer';
