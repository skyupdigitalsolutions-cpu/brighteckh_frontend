// Jobs group routes (mounted by App.tsx under /p/jobs): index = J0 Jobs list (Figma 177:111151).
// The job workspace "overview" tab is exported separately: JobOverviewTab (./JobOverviewTab).
import { Route } from 'react-router-dom';
import { JobsListPage } from './JobsListPage';

export const JobsListRoutes = <Route index element={<JobsListPage />} />;
