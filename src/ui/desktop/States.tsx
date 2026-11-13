// The four screen states, as drawn for the Inward register (P1):
//   loading 177:102937 → <SkeletonRows/> inside the TableCard (header row stays)        [DataTable.tsx]
//   empty   177:103043 → <EmptyState/> centred in the TableCard (no header row)
//   error   177:103069 → <ErrorState/> centred in the TableCard (no header row)
//   success 177:102734 → the rows
// EmptyState (Figma "Empty state" 5:438 desktop): 520 wide, px-24 py-40, gap 12; 56px neutral-bg circle with a
// 28px icon (secondary); title 18/24 SemiBold; body 14/20 secondary centred; optional CTA only if the role can act.
// ErrorState (177:103093): 64px blocked-bg circle + 30px alert (blocked-fg); title 18/24 SemiBold; body 14/20
// secondary; secondary "Try again" button with 18px refresh. Gap 12.
// QueryView wires a TanStack query to these states.
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import { apiErrorText, apiStatus } from '../../api/http';
import { cx, Ic, type TablerIcon } from './Icon';
import { Button } from './Button';

export function EmptyState({ icon, title, body, action, className }: {
  icon: TablerIcon; title: string; body?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cx('flex w-[520px] max-w-full flex-col items-center gap-[12px] px-[24px] py-[40px] text-center', className)}>
      <div className="flex h-[56px] w-[56px] items-center justify-center overflow-clip rounded-t-card bg-st-neutral-bg">
        <Ic icon={icon} size={28} className="text-fg-2" />
      </div>
      <h2 className="text-[18px] font-semibold leading-[24px] text-fg">{title}</h2>
      {body && <div className="w-full text-[14px] leading-[20px] text-fg-2">{body}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ title, body, onRetry, retrying, className }: {
  title: string; body?: ReactNode; onRetry?: () => void; retrying?: boolean; className?: string;
}) {
  return (
    <div role="alert" className={cx('flex flex-col items-center gap-[12px] text-center', className)}>
      <div className="flex h-[64px] w-[64px] items-center justify-center overflow-clip rounded-[32px] bg-st-blocked-bg">
        <Ic icon={IconAlertTriangle} size={30} className="text-st-blocked-fg" />
      </div>
      <h2 className="text-[18px] font-semibold leading-[24px] text-fg">{title}</h2>
      <div className="max-w-[640px] text-[14px] leading-[20px] text-fg-2">
        {body ?? "The server didn't respond. Check your connection and try again — nothing you entered was lost."}
      </div>
      {onRetry && (
        <Button kind="secondary" busy={retrying} icon={<Ic icon={IconRefresh} size={18} />} onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}

/** Centred state inside a full-height glass-strong card (the table card of the empty / error frames, 1384×656). */
export function StateCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('glass-strong flex min-h-[656px] w-full flex-1 flex-col items-center justify-center gap-[12px] overflow-clip rounded-t-card p-[16px] shadow-glass', className)}>
      {children}
    </div>
  );
}

/** Body text for a failed query: network → Figma copy; 4xx/5xx → the API message. */
export function errorBody(e: unknown): string {
  return apiStatus(e) ? apiErrorText(e) : "The server didn't respond. Check your connection and try again — nothing you entered was lost.";
}

/**
 * Render the 4 states of one query. `loading` / `empty` are what to show in those states;
 * error defaults to <ErrorState> with retry. 404 is treated as `notFound` when given.
 */
export function QueryView<T>({ query, loading, empty, isEmpty, errorTitle, notFound, wrapState = true, children }: {
  query: UseQueryResult<T>;
  loading: ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  errorTitle: string;
  notFound?: ReactNode;
  /** Wrap error/notFound in <StateCard>. */
  wrapState?: boolean;
  children: (data: T) => ReactNode;
}) {
  const wrap = (n: ReactNode) => (wrapState ? <StateCard>{n}</StateCard> : n);
  if (query.isPending) return <>{loading}</>;
  if (query.isError) {
    if (notFound && apiStatus(query.error) === 404) return <>{wrap(notFound)}</>;
    return <>{wrap(<ErrorState title={errorTitle} body={errorBody(query.error)} onRetry={() => query.refetch()} retrying={query.isFetching} />)}</>;
  }
  if (empty && isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
