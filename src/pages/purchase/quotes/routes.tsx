// Quotes routes, mounted by the coordinator under /p/quotes:
//   index      → Q0 quotes list (QuotesList)
//   :quoteId   → Q1 quote detail. Figma draws Q1 (177:125120 / 125280 / 125440 / 125600) INSIDE the job workspace
//                (Jobs nav active, Quote tab), so this route loads the quote and redirects to
//                /p/jobs/{job_id}/quote?q={quoteId}, where JobQuoteTab renders it. Loading / error / not-found states here.
import { Navigate, Route, useParams } from 'react-router-dom';
import { IconFileUnknown } from '@tabler/icons-react';
import { useQuote } from '../api';
import { ButtonLink, EmptyState, ErrorState, PageContent, PageHeader, StateCard, errorBody } from '../../../ui/desktop';
import { apiStatus } from '../../../api/http';
import { QuotesList } from './QuotesList';
import { isUuid } from './api';

function QuoteDetailRedirect() {
  const { quoteId = '' } = useParams();
  const valid = isUuid(quoteId);
  const q = useQuote(valid ? quoteId : undefined);

  if (valid && q.data) return <Navigate to={`/p/jobs/${q.data.job_id}/quote?q=${q.data.id}`} replace />;

  const notFound = !valid || (q.isError && [403, 404].includes(apiStatus(q.error) ?? 0));
  return (
    <>
      <PageHeader title="Quote" meta={notFound ? 'Not found' : q.isError ? undefined : 'Opening…'} />
      <PageContent>
        {q.isPending && valid ? (
          <StateCard><div role="status" aria-label="Loading quote" className="h-[12px] w-[240px] animate-pulse rounded-[6px] bg-disabled" /></StateCard>
        ) : (
          <StateCard>
            {notFound ? (
              <EmptyState
                icon={IconFileUnknown}
                title="Quote not found"
                body="This quote doesn't exist in your company, or the link is wrong."
                action={<ButtonLink to="/p/quotes" kind="secondary">Back to quotes</ButtonLink>}
              />
            ) : (
              <ErrorState title="Couldn't load this quote" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
            )}
          </StateCard>
        )}
      </PageContent>
    </>
  );
}

export const QuotesRoutes = (
  <>
    <Route index element={<QuotesList />} />
    <Route path=":quoteId" element={<QuoteDetailRedirect />} />
  </>
);
