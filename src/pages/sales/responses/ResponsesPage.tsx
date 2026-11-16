// SR0 · Customer responses (/s/responses) — Figma 177:139228.
// Page header "Customer responses" + meta; table card (radius 24): header bg-subtle radius 20 px-16 py-12 gap 12;
// rows px-16 py-14 gap 12. Cells: Quote 140 (Data/ID) · Customer flex (14/20 Medium) · Response 200 (badge) ·
// Channel 120 (14/20 secondary, API enum text) · Contact 240 (14/20 secondary) · Recorded 150 (14/20 secondary).
//
// Data: there is NO responses-feed endpoint (G-S3 out of scope). Built from GET /sales/quotes (sent stages, paged 100 at
// a time, up to FEED_MAX_PAGES): rows with a `latest_response`, newest response first, paginated client-side.
// Deviations: one row per quote = the LATEST response on its LATEST revision only — not every response event, and not
// responses to superseded revisions (GapNote G-S3). Meta "Every reply you recorded" → the row may have been recorded by
// another Sales colleague on your quote (any SALES user can record; the recorder's name is in the row tooltip).
// Response badge = BR-05 response_type (the event), not the derived sales stage.
import { useState } from 'react';
import { IconMessageCircle } from '@tabler/icons-react';
import { enumLabel, formatDayTime } from '../../../lib/format';
import {
  EmptyState, ErrorState, GapNote, PageContent, PageHeader, Pagination, SkeletonRows, TD, TH, THead, TR, errorBody, paginate,
} from '../../../ui/desktop';
import { FEED_MAX_PAGES, useSalesResponseFeed, type ResponseFeed } from '../api';
import { ResponseBadge, SalesTableCard } from '../ui';

const PAGE_SIZE = 25;
const COLS = { quote: 140, response: 200, channel: 120, contact: 240, recorded: 150 };
const GAP = 12;

export function ResponsesPage() {
  const q = useSalesResponseFeed('');
  const [page, setPage] = useState(1);
  const feed = q.data;
  const pg = paginate(feed?.rows ?? [], page, PAGE_SIZE);

  return (
    <>
      <PageHeader title="Customer responses" meta="Latest reply on each of your quotes · newest first" />
      <PageContent>
        <GapNote code="G-S3">
          One row per quote: the latest response recorded on its current revision. Earlier responses, and responses to
          older revisions, are on the quote page — there is no endpoint that lists every response event.
        </GapNote>
        {feed?.truncated && (
          <GapNote code="G-S3">
            Only your {feed.scanned} most recent sent quotes (of {feed.total}) were checked for responses — the list is built
            from the quote list, {FEED_MAX_PAGES * 100} quotes at most.
          </GapNote>
        )}
        <SalesTableCard>
          <THead gap={GAP}>
            <TH w={COLS.quote}>Quote</TH>
            <TH grow>Customer</TH>
            <TH w={COLS.response}>Response</TH>
            <TH w={COLS.channel}>Channel</TH>
            <TH w={COLS.contact}>Contact</TH>
            <TH w={COLS.recorded}>Recorded</TH>
          </THead>
          {q.isPending ? <SkeletonRows rows={6} widths={[90, 240, 100, 70, 160, 100]} /> : q.isError ? (
            <div className="flex flex-1 items-center justify-center">
              <ErrorState title="Couldn't load responses" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
            </div>
          ) : pg.rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={IconMessageCircle}
                title="No responses recorded yet"
                body="Open a sent quote and record the customer's reply — it shows up here."
              />
            </div>
          ) : (
            <div className="flex w-full flex-col">
              {pg.rows.map((r) => <ResponseRow key={r.quote_id} r={r} />)}
            </div>
          )}
          {pg.pages > 1 && <Pagination page={pg.page} pages={pg.pages} onChange={setPage} className="mt-auto" />}
        </SalesTableCard>
      </PageContent>
    </>
  );
}

function ResponseRow({ r }: { r: ResponseFeed['rows'][number] }) {
  const resp = r.latest_response;
  const dash = <span className="text-[14px] leading-[20px] text-fg-2">—</span>;
  return (
    <TR to={`/s/quotes/${r.quote_id}`} gap={GAP}>
      <TD w={COLS.quote} kind="id">{r.quote_number}</TD>
      <TD grow kind="strong">{r.customer_name}</TD>
      <TD w={COLS.response}><ResponseBadge type={resp.response_type} /></TD>
      <TD w={COLS.channel}>{resp.response_channel ? <span className="truncate whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{enumLabel(resp.response_channel)}</span> : dash}</TD>
      <TD w={COLS.contact}>{resp.customer_contact ? <span className="truncate whitespace-nowrap text-[14px] leading-[20px] text-fg-2" title={resp.customer_contact}>{resp.customer_contact}</span> : dash}</TD>
      <TD w={COLS.recorded}>
        <span className="truncate whitespace-nowrap text-[14px] leading-[20px] text-fg-2" title={`Recorded by ${resp.recorded_by_name}`}>{formatDayTime(resp.responded_at)}</span>
      </TD>
    </TR>
  );
}
