// Job workspace · Inspection tab — Figma "D·P4 · Job · inspection report review" 177:103486 (Columns 177:103499).
// Columns gap 16: Report (flex, glass-strong p-20 gap-14 radius 24, full height) · Right 400 (gap 16): Inspection time
// (177:103528) · History (177:103540) · Your review (177:103545, flex-1: comment field, spacer, Return for v2 secondary +
// Accept report primary, gap 10).
// Report: head 18/24 "Inspection report · version n" + report status badge; Outcome box (brand-subtle, 1px brand
// border, radius 16, px-16 py-14, gap 12: 12/16 brand-text "Outcome" over 18/24 SemiBold label + outcome badge);
// "Findings" H3 + 14/20 secondary text; "Evidence · n photos" H3 + 12/16 "k visible to customer"; gallery = 3 per row,
// gap 12, tiles h-170 radius 18, "Customer" chip (black/50, radius 10, px-8 py-4, 14px eye + 12/16 white) top-left.
//
// Data: GET /jobs/{id}/inspection-report (versions + reviews), GET /inspection-reports/{id}/media,
// GET /jobs/{id}/inspection-sessions (time totals), names via GET /lookups/employees?ids=.
// Write: POST /inspection-reports/{id}/review {decision ACCEPT|RETURN, comment} — PURCHASE; only while the report is
// SUBMITTED. Comment is optional to accept, required to return (Figma placeholder copy; the API takes it optional).
// Not built yet (sub-states): J3 photo viewer (177:116562…), J3 accepted / returned frames beyond the summary alert.
import { useState, type ReactNode } from 'react';
import { IconCheck, IconEye, IconFileSearch, IconPhoto, IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import { useMe } from '../../../auth/AuthProvider';
import { can } from '../../../auth/access';
import { useJobWorkspace } from '../job/JobWorkspace';
import { useEmployeesByIds } from '../api';
import { useJobInspectionSessions } from '../jobs/jobsData';
import { StatusPill } from '../../../ui/desktop/Badge';
import { Button } from '../../../ui/desktop/Button';
import { EmptyState, ErrorState, StateCard, errorBody } from '../../../ui/desktop/States';
import { FormErrors, InlineAlert } from '../../../ui/desktop/Feedback';
import { useToast } from '../../../ui/desktop/Toast';
import { AuthedImage } from '../../../ui/desktop/AuthedImage';
import { Ic } from '../../../ui/desktop/Icon';
import { displayVersion, enumLabel, formatDayTime, formatDuration } from '../../../lib/format';
import { TimelineItem, type TimelineTone } from '../sourcing/ui';
import { CompactField, Fact, H3, TabCard, TabSkeleton } from './ui';
import { useInspectionMedia, useInspectionReport, useReviewInspection, type InspectionMedia, type InspectionReport } from './data';

const OUTCOME_LABEL: Record<string, string> = {
  REPAIR_REQUIRED: 'Repair required', NO_FAULT_FOUND: 'No fault found', NOT_REPAIRABLE: 'Not repairable',
  EXTERNAL_REPAIR_REQUIRED: 'External repair required', FURTHER_INSPECTION_REQUIRED: 'Further inspection required',
};
// Placeholder tiles (Figma Photo 1/2/3 gradients) for media whose bytes can't be fetched.
const TILE_BG = [
  'linear-gradient(150.5deg, rgb(58, 26, 22) 14.286%, rgb(122, 43, 33) 85.714%)',
  'linear-gradient(150.5deg, rgb(30, 27, 51) 14.286%, rgb(61, 47, 134) 85.714%)',
  'linear-gradient(150.5deg, rgb(17, 48, 44) 14.286%, rgb(31, 107, 96) 85.714%)',
];

export function InspectionTab() {
  const { job } = useJobWorkspace();
  const me = useMe();
  const reportQ = useInspectionReport(job.id);
  const report = reportQ.data ?? null;
  const mediaQ = useInspectionMedia(job.id, report?.id);
  const sessionsQ = useJobInspectionSessions(job.id);

  if (reportQ.isPending) return <TabSkeleton />;
  if (reportQ.isError) {
    return <StateCard><ErrorState title="Couldn't load the inspection report" body={errorBody(reportQ.error)} onRetry={() => reportQ.refetch()} retrying={reportQ.isFetching} /></StateCard>;
  }
  if (!report || report.versions.length === 0) {
    return (
      <StateCard>
        <EmptyState
          icon={IconFileSearch}
          title="No inspection report yet"
          body={job.current_assignment ? 'The engineer submits the report from the mobile app after inspecting the unit. It appears here for your review.' : 'Assign an engineer first — they inspect the unit and submit the report.'}
        />
      </StateCard>
    );
  }

  const canReview = can.purchaseWork(me.role) && report.status === 'SUBMITTED';
  return (
    <div className="flex min-h-[738px] w-full flex-1 items-stretch gap-[16px]">
      <ReportCard report={report} media={mediaQ.data} mediaLoading={mediaQ.isPending} mediaError={mediaQ.isError} />
      <div className="flex w-[400px] shrink-0 flex-col gap-[16px]">
        <TabCard className="shrink-0">
          <H3>Inspection time</H3>
          {sessionsQ.isError ? <p className="text-[12px] leading-[16px] text-st-blocked-fg">{errorBody(sessionsQ.error)}</p> : (
            <div className="flex items-start gap-[32px] overflow-clip">
              <Fact label="Active">{sessionsQ.data ? formatDuration(sum(sessionsQ.data.time_totals, 'active_seconds')) : '…'}</Fact>
              <Fact label="Paused">{sessionsQ.data ? formatDuration(sum(sessionsQ.data.time_totals, 'paused_seconds')) : '…'}</Fact>
              <Fact label="Sessions">{sessionsQ.data ? String(sessionsQ.data.sessions.length) : '…'}</Fact>
            </div>
          )}
        </TabCard>
        <HistoryCard report={report} firstSessionAt={sessionsQ.data?.sessions[0]?.started_at} firstSessionBy={sessionsQ.data?.sessions[0]?.engineer_id} />
        <ReviewCard jobId={job.id} report={report} canReview={canReview} />
      </div>
    </div>
  );
}

const sum = (rows: { active_seconds?: unknown; paused_seconds?: unknown }[], k: 'active_seconds' | 'paused_seconds') =>
  rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);

function ReportCard({ report, media, mediaLoading, mediaError }: {
  report: InspectionReport; media: InspectionMedia[] | undefined; mediaLoading: boolean; mediaError: boolean;
}) {
  const v = report.versions.find((x) => x.version_no === report.current_version_no) ?? report.versions[report.versions.length - 1]!;
  const mine = (media ?? []).filter((m) => m.version_id === v.id || m.version_id == null);
  const photos = mine.filter((m) => m.media_type === 'PHOTO').length;
  const visible = mine.filter((m) => m.customer_visible).length;
  const countLabel = mine.length === photos ? `${photos} ${photos === 1 ? 'photo' : 'photos'}` : `${mine.length} files`;
  return (
    <TabCard className="min-w-px flex-1">
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className="min-w-px flex-1 text-[18px] font-semibold leading-[24px] text-fg" title={`API version_no ${v.version_no}`}>Inspection report · version {displayVersion(v.version_no)}</h2>
        <StatusPill domain="reportVersion" value={v.version_status} />
      </div>
      <div className="flex w-full items-center gap-[12px] overflow-clip rounded-[16px] border border-brand-border bg-brand-subtle px-[16px] py-[14px]">
        <div className="flex min-w-px flex-1 flex-col items-start gap-[2px] overflow-clip whitespace-nowrap">
          <span className="text-[12px] leading-[16px] text-brand-text">Outcome</span>
          <span className="text-[18px] font-semibold leading-[24px] text-fg">{OUTCOME_LABEL[v.outcome] ?? enumLabel(v.outcome)}</span>
        </div>
        <StatusPill domain="outcome" value={v.outcome} />
      </div>
      {v.amendment_reason && (
        <InlineAlert tone="neutral" title={`Why version ${displayVersion(v.version_no)}`}>{v.amendment_reason}</InlineAlert>
      )}
      <H3>Findings</H3>
      <p className="w-full whitespace-pre-line text-[14px] leading-[20px] text-fg-2">{v.inspection_description}</p>
      <div className="flex w-full items-center gap-[8px] overflow-clip">
        <H3 className="min-w-px flex-1">Evidence · {mediaLoading ? '…' : countLabel}</H3>
        {!mediaLoading && !mediaError && <span className="shrink-0 whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{visible} visible to customer</span>}
      </div>
      {mediaError ? (
        <p className="text-[12px] leading-[16px] text-st-blocked-fg">Couldn't load the photos.</p>
      ) : mediaLoading ? (
        <div className="grid w-full grid-cols-3 gap-[12px]">{[0, 1, 2].map((i) => <div key={i} className="h-[170px] animate-pulse rounded-[18px] bg-disabled" />)}</div>
      ) : mine.length === 0 ? (
        <p className="text-[14px] leading-[20px] text-fg-2">No photos on this version.</p>
      ) : (
        <div className="grid w-full grid-cols-3 gap-[12px]">
          {mine.map((m, i) => <MediaTile key={m.id} m={m} i={i} />)}
        </div>
      )}
    </TabCard>
  );
}

function MediaTile({ m, i }: { m: InspectionMedia; i: number }) {
  const placeholder = (
    <div className="flex h-full w-full items-center justify-center" style={{ backgroundImage: TILE_BG[i % 3] }}>
      <Ic icon={m.media_type === 'VIDEO' ? IconPlayerPlay : IconPhoto} size={32} className="text-fg-2" />
    </div>
  );
  return (
    <div className="relative h-[170px] min-w-px overflow-clip rounded-[18px]" title={m.file_name}>
      {m.media_type === 'PHOTO' ? <AuthedImage fileUri={m.file_uri} alt={m.file_name} fallback={placeholder} /> : placeholder}
      {m.customer_visible && (
        <div className="absolute left-[10px] top-[10px] flex items-center gap-[4px] overflow-clip rounded-[10px] bg-[rgba(0,0,0,0.5)] px-[8px] py-[4px]">
          <Ic icon={IconEye} size={14} className="text-fg-inverse" />
          <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-inverse">Customer</span>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ report, firstSessionAt, firstSessionBy }: { report: InspectionReport; firstSessionAt?: string; firstSessionBy?: string }) {
  const { job } = useJobWorkspace();
  const a = job.current_assignment;
  const empQ = useEmployeesByIds([
    ...report.versions.map((v) => v.engineer_id), ...report.reviews.map((r) => r.reviewer_id), firstSessionBy, a?.engineer_id,
  ]);
  const name = (id?: string | null) => (id ? empQ.data?.[id]?.full_name ?? null : null);
  type Ev = { at: string; title: string; actor: string | null; detail?: string | null; tone: TimelineTone };
  const ev: Ev[] = [];
  for (const v of report.versions) ev.push({ at: v.submitted_at, title: `Version ${displayVersion(v.version_no)} submitted`, actor: name(v.engineer_id), tone: 'progress' });
  for (const r of report.reviews) {
    const vno = report.versions.find((v) => v.id === r.version_id)?.version_no;
    ev.push({
      at: r.reviewed_at,
      title: `${vno != null ? `Version ${displayVersion(vno)}` : 'Report'} ${r.review_decision === 'ACCEPT' ? 'accepted' : 'returned'}`,
      actor: name(r.reviewer_id), detail: r.review_comment, tone: r.review_decision === 'ACCEPT' ? 'success' : 'neutral',
    });
  }
  if (firstSessionAt) ev.push({ at: firstSessionAt, title: 'Inspection started', actor: name(firstSessionBy), tone: 'neutral' });
  if (a?.response === 'ACCEPTED' && a.responded_at) ev.push({ at: a.responded_at, title: 'Custody acknowledged', actor: name(a.engineer_id), tone: 'success' });
  ev.sort((x, y) => y.at.localeCompare(x.at));
  return (
    <TabCard className="shrink-0">
      <H3>History</H3>
      <div className="flex w-full flex-col gap-[14px]">
        {ev.map((e, i) => (
          <TimelineItem key={`${e.at}-${e.title}`} title={e.title} meta={[e.actor, formatDayTime(e.at)].filter(Boolean).join(' · ')} detail={e.detail ?? undefined} tone={e.tone} last={i === ev.length - 1} />
        ))}
      </div>
    </TabCard>
  );
}

function ReviewCard({ jobId, report, canReview }: { jobId: string; report: InspectionReport; canReview: boolean }) {
  const toast = useToast();
  const m = useReviewInspection(jobId, report.id);
  const [comment, setComment] = useState('');
  const [tried, setTried] = useState<'RETURN' | null>(null);
  const v = report.versions.find((x) => x.version_no === report.current_version_no);
  const lastReview = v ? [...report.reviews].reverse().find((r) => r.version_id === v.id) : undefined;
  const empQ = useEmployeesByIds([lastReview?.reviewer_id]);

  const submit = (decision: 'ACCEPT' | 'RETURN') => {
    if (decision === 'RETURN' && !comment.trim()) { setTried('RETURN'); return; }
    m.mutate({ decision, ...(comment.trim() ? { comment: comment.trim() } : {}) }, {
      onSuccess: () => {
        setComment(''); setTried(null);
        toast(decision === 'ACCEPT'
          ? { tone: 'success', title: 'Report accepted', body: v ? `Version ${displayVersion(v.version_no)} is now the accepted inspection report.` : 'The report is accepted.' }
          : { tone: 'progress', title: 'Returned for a new version', body: 'The engineer sees your comment on their report screen.' });
      },
    });
  };

  let body: ReactNode;
  if (canReview) {
    body = (
      <>
        <CompactField
          label="Comment to engineer"
          placeholder="Optional to accept · required to return"
          helper="Shown on the engineer's report screen"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          error={tried === 'RETURN' && !comment.trim() ? 'Say what the engineer must change for the next version.' : null}
          disabled={m.isPending}
        />
        <div className="min-h-px w-px flex-1" />
        <FormErrors error={m.error} title="The review wasn't saved" />
        <div className="flex w-full items-start gap-[10px] [&>*]:min-w-px [&>*]:flex-1">
          <Button kind="secondary" icon={<Ic icon={IconRefresh} size={18} />} disabled={m.isPending} onClick={() => submit('RETURN')}>Return for v{displayVersion(report.current_version_no) + 1}</Button>
          <Button kind="primary" icon={<Ic icon={IconCheck} size={18} />} busy={m.isPending && m.variables?.decision === 'ACCEPT'} disabled={m.isPending} onClick={() => submit('ACCEPT')}>Accept report</Button>
        </div>
      </>
    );
  } else if (lastReview) {
    const who = empQ.data?.[lastReview.reviewer_id]?.full_name;
    body = (
      <InlineAlert
        tone={lastReview.review_decision === 'ACCEPT' ? 'success' : 'blocked'}
        title={`${lastReview.review_decision === 'ACCEPT' ? 'Accepted' : 'Returned'}${who ? ` by ${who}` : ''} · ${formatDayTime(lastReview.reviewed_at)}`}
      >
        {lastReview.review_comment || (lastReview.review_decision === 'ACCEPT' ? 'No comment.' : 'Waiting for the engineer to submit a new version.')}
      </InlineAlert>
    );
  } else {
    body = <p className="text-[14px] leading-[20px] text-fg-2">{report.status === 'SUBMITTED' ? 'Waiting for Purchase to review this version.' : `Report ${enumLabel(report.status)}.`}</p>;
  }
  return (
    <TabCard className="flex-[1_0_auto]">
      <H3>Your review</H3>
      {body}
    </TabCard>
  );
}
