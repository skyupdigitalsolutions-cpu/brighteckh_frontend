// Job workspace → Quote tab (/p/jobs/:jobId/quote). Figma D·P7 177:103803 + J5 states + Q1 states (see QuoteBuilder).
// Data: GET /jobs/{id}/quotes (headers, newest first) → GET /quotes/{id} (revisions + lines) + GET /jobs/{id}/quote-responses.
// ?q=<quoteId> picks the quote (Q1 links land here via /p/quotes/:quoteId); ?revise=1 opens "Create revision".
// Four states: loading (skeleton in the lines card), error (StateCard + retry), empty (no quote yet → Start quote),
// success (builder / locked view).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconFileInvoice, IconFileUnknown } from '@tabler/icons-react';
import { useQuote, useQuotes } from '../api';
import { useJobWorkspace } from '../job/JobWorkspace';
import { useAuth } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { Button, EmptyState, ErrorState, Ic, SkeletonRows, StateCard, Tab, TabBar, errorBody } from '../../../ui/desktop';
import { apiStatus } from '../../../api/http';
import { IconPlus } from '@tabler/icons-react';
import { QuoteBuilder, type Flash } from './QuoteBuilder';
import { rememberQuote, useQuoteResponses, type QuoteResponse } from './api';

function QuoteSkeleton() {
  return (
    <div className="flex min-h-[738px] w-full items-stretch gap-[16px]" role="status" aria-label="Loading quote">
      <div className="glass-strong flex min-w-px flex-1 flex-col gap-[14px] rounded-[24px] p-[20px]">
        <div className="my-[6px] h-[12px] w-[200px] animate-pulse rounded-[6px] bg-disabled" />
        <SkeletonRows rows={5} widths={[110, 260, 30, 30, 100, 80]} />
      </div>
      <div className="glass-strong flex w-[380px] shrink-0 flex-col gap-[14px] rounded-[24px] p-[20px]">
        {[120, 300, 300, 300, 300].map((w, i) => <div key={i} className="h-[12px] animate-pulse rounded-[6px] bg-disabled" style={{ width: w }} />)}
      </div>
    </div>
  );
}

export function JobQuoteTab() {
  const { job } = useJobWorkspace();
  const role = useAuth().me?.role;
  const canWork = !!role && can.purchaseWork(role);
  const canSeeCost = !!role && can.seeSupplierCost(role);
  const [sp, setSp] = useSearchParams();
  const quotesQ = useQuotes(job.id);
  const responsesQ = useQuoteResponses(job.id);
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState<Flash>();

  if (quotesQ.isPending) return <QuoteSkeleton />;
  if (quotesQ.isError) {
    return <StateCard><ErrorState title="Couldn't load this job's quotes" body={errorBody(quotesQ.error)} onRetry={() => quotesQ.refetch()} retrying={quotesQ.isFetching} /></StateCard>;
  }

  const quotes = quotesQ.data;
  const responses = responsesQ.data ?? [];

  if (quotes.length === 0) {
    if (creating && canWork) {
      return (
        <QuoteBuilder
          job={job}
          responses={responses}
          canWork={canWork}
          canSeeCost={canSeeCost}
          onFlash={setFlash}
          onCreated={(id) => { setCreating(false); setSp({ q: id }, { replace: true }); }}
          onCancelCreate={() => setCreating(false)}
        />
      );
    }
    return (
      <StateCard>
        <EmptyState
          icon={IconFileInvoice}
          title="No quote yet"
          body="Price the job line by line — you type every customer price. Sales sends it to the customer after you release it."
          action={canWork ? <Button kind="primary" icon={<Ic icon={IconPlus} size={18} />} onClick={() => setCreating(true)}>Start quote</Button> : undefined}
        />
      </StateCard>
    );
  }

  const selected = quotes.find((q) => q.id === sp.get('q')) ?? quotes[0];
  const select = (id: string) => setSp({ q: id }, { replace: true });

  return (
    <>
      {quotes.length > 1 && (
        <TabBar label="Quotes on this job">
          {quotes.map((q) => <Tab key={q.id} active={q.id === selected.id} onClick={() => select(q.id)} label={q.quote_number} />)}
        </TabBar>
      )}
      <QuoteLoader
        quoteId={selected.id}
        startRevise={sp.get('revise') === '1'}
        responses={responses}
        canWork={canWork}
        canSeeCost={canSeeCost}
        flash={flash}
        onFlash={setFlash}
      />
    </>
  );
}

function QuoteLoader({ quoteId, startRevise, responses, canWork, canSeeCost, flash, onFlash }: {
  quoteId: string; startRevise: boolean; responses: QuoteResponse[];
  canWork: boolean; canSeeCost: boolean; flash?: Flash; onFlash: (f: Flash) => void;
}) {
  const { job } = useJobWorkspace();
  const q = useQuote(quoteId);
  useEffect(() => { if (q.data) rememberQuote(q.data.id); }, [q.data]);

  if (q.isPending) return <QuoteSkeleton />;
  if (q.isError) {
    if (apiStatus(q.error) === 404) {
      return <StateCard><EmptyState icon={IconFileUnknown} title="Quote not found" body="This quote doesn't exist in your company, or the link is wrong." /></StateCard>;
    }
    return <StateCard><ErrorState title="Couldn't load this quote" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} /></StateCard>;
  }
  const quote = q.data;
  const latest = quote.revisions[quote.revisions.length - 1];
  if (!latest) {
    return <StateCard><EmptyState icon={IconFileUnknown} title="This quote has no revision" body="The quote header exists but no revision was returned." /></StateCard>;
  }
  return (
    <QuoteBuilder
      key={`${latest.id}:${latest.quote_status}`}
      job={job}
      quote={quote}
      responses={responses}
      canWork={canWork}
      canSeeCost={canSeeCost}
      startRevise={startRevise}
      flash={flash}
      onFlash={onFlash}
    />
  );
}
