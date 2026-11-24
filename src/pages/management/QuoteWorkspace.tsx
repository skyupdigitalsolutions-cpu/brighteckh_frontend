// MQ1 · Quote (view) — /mg/quotes/:quoteId. Figma 177:140738 (DRAFT) · 177:140884 (RELEASED) · 177:141031 (SENT) ·
// 177:141178 (ACCEPTED) · 177:141325 (REJECTED). Header = the job (number + "equipment · customer · view only"), status
// banner, lines card + Cost & margin + Totals — the Purchase quote view (JobQuoteTab → QuoteBuilder) with canWork false,
// inside the job workspace frame without its tab bar, so the Quotes pill stays active.
// DATA: GET /quotes/{id} (no role guard, company-scoped) → job_id → JobWorkspace(jobId) → JobQuoteTab picks the quote
// from the route's quoteId. Loading / not found / error states here until the quote resolves.
import { useParams } from 'react-router-dom';
import { IconFileUnknown } from '@tabler/icons-react';
import { apiStatus } from '../../api/http';
import { ButtonLink, EmptyState, ErrorState, PageContent, PageHeader, StateCard, errorBody } from '../../ui/desktop';
import { useQuote } from '../purchase/api';
import { JobWorkspace } from '../purchase/job/JobWorkspace';
import { isUuid } from '../purchase/quotes/api';

export function MgQuoteWorkspace() {
  const { quoteId = '' } = useParams();
  const valid = isUuid(quoteId);
  const q = useQuote(valid ? quoteId : undefined);

  if (valid && q.data) return <JobWorkspace jobId={q.data.job_id} />;

  const notFound = !valid || (q.isError && [403, 404].includes(apiStatus(q.error) ?? 0));
  return (
    <>
      <PageHeader title="Quote" meta={notFound ? 'Not found' : q.isError ? undefined : 'Loading…'} />
      <PageContent>
        <StateCard>
          {q.isPending && valid ? (
            <div role="status" aria-label="Loading quote" className="h-[12px] w-[240px] animate-pulse rounded-[6px] bg-disabled" />
          ) : notFound ? (
            <EmptyState
              icon={IconFileUnknown}
              title="Quote not found"
              body="This quote doesn't exist in your company, or the link is wrong."
              action={<ButtonLink to="/mg/quotes" kind="secondary">Back to quotes</ButtonLink>}
            />
          ) : (
            <ErrorState title="Couldn't load this quote" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
          )}
        </StateCard>
      </PageContent>
    </>
  );
}
