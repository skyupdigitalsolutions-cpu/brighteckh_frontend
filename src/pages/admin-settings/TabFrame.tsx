// Shared tab scaffolding: loading (293:61395 — toolbar + titled skeleton cards) and error (293:61772 — toolbar +
// error card with Retry) around a loaded tab. The loaded tab renders its own toolbar (Save / Discard need its form).
import type { ReactNode } from 'react';
import { ErrorState, StateCard, errorBody } from '../../ui/desktop';
import { useCompanySettings, type CompanySettings, type SettingsTab } from './api';
import { CardsSkeleton, SettingsToolbar } from './local';
import { useSettingsCtx } from './SettingsLayout';

export function TabFrame({ tab, titles, errorTitle, children }: {
  tab: SettingsTab; titles: string[]; errorTitle: string; children: (data: CompanySettings) => ReactNode;
}) {
  const { companyId, setCompanyId, companies } = useSettingsCtx();
  const q = useCompanySettings(companyId || null);
  if (q.isSuccess) return <>{children(q.data)}</>;
  return (
    <>
      <SettingsToolbar
        companies={companies}
        companyId={companyId}
        onCompany={setCompanyId}
        saved={null}
        onSave={() => {}}
        canSave={false}
        dirty={false}
        key={tab}
      />
      {q.isError ? (
        <StateCard>
          <ErrorState title={errorTitle} body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
        </StateCard>
      ) : <CardsSkeleton titles={titles} />}
    </>
  );
}
