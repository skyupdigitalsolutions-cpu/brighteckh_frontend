// E4a photo gate blocked (16:291) · E4b ready (16:402) · E4c submitted/locked (16:541) · E4d returned → next version (16:634).
// POST /jobs/{id}/inspection-reports (get-or-create) → POST /inspection-reports/{id}/media → POST …/submit.
// Server rules: ≥1 PHOTO on the report (VIDEO doesn't count); every version after the first needs amendment_reason;
// versions are numbered from 0 by the API.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconInfoCircle, IconLock, IconPackage, IconPhoto, IconSend } from '@tabler/icons-react';
import { api } from '../../api/endpoints';
import { apiErrorText } from '../../api/http';
import type { InspectionOutcome, InspectionReport, JobDetail } from '../../api/types';
import { useMe } from '../../auth/AuthProvider';
import { formatDateTime } from '../../lib/format';
import { localMedia } from '../../lib/storage';
import { storeFile, UPLOAD_IS_PLACEHOLDER } from '../../lib/upload';
import { Button, Card, cx, ErrorState, FormError, GapNote, InlineAlert, SkeletonCard, StatusBadge, TextArea } from '../../ui/primitives';
import { GatedAction, PhotoCapture, type Capture } from '../../ui/mobile';
import { useInspectionReport, useInvalidateJob } from './data';
import { JobFrame, useJobAction } from './JobFrame';

export const OUTCOMES: { value: InspectionOutcome; label: string; hint: string }[] = [
  { value: 'REPAIR_REQUIRED', label: 'Repair required', hint: 'Fault found and repairable here' },
  { value: 'NO_FAULT_FOUND', label: 'No fault found', hint: 'Unit works as specified' },
  { value: 'NOT_REPAIRABLE', label: 'Not repairable', hint: 'Beyond economic or technical repair' },
  { value: 'EXTERNAL_REPAIR_REQUIRED', label: 'Send for external repair', hint: 'Needs a specialist outside Brightech' },
  { value: 'FURTHER_INSPECTION_REQUIRED', label: 'Needs further inspection', hint: 'More tests before a decision' },
];

export function InspectionReportPage() {
  const { jobId = '' } = useParams();
  return (
    <JobFrame jobId={jobId} title="Report" flow="br03" step="report">
      {(job) => <Report job={job} />}
    </JobFrame>
  );
}

function Report({ job }: { job: JobDetail }) {
  const me = useMe();
  const report = useInspectionReport(job.id);
  const canAct = job.current_assignment?.engineer_id === me.id && job.current_assignment.response === 'ACCEPTED';

  if (report.isPending) return <><SkeletonCard /><SkeletonCard /></>;
  if (report.error) return <ErrorState title="Couldn't load the inspection report" onRetry={() => void report.refetch()} />;

  const r = report.data;
  const latest = r?.versions[r.versions.length - 1] ?? null;
  const locked = r?.status === 'SUBMITTED' || r?.status === 'ACCEPTED';

  if (r && latest && locked) return <LockedReport job={job} report={r} />;
  if (!canAct) {
    return (
      <InlineAlert tone="neutral" title={r ? `Report is ${r.status.replace(/_/g, ' ')}` : 'No report yet'}>
        Only the engineer holding custody of this job can write the inspection report.
      </InlineAlert>
    );
  }
  return <ReportForm job={job} report={r} />;
}

// ------------------------------------------------------------------ editable (E4a / E4b / E4d)
function ReportForm({ job, report }: { job: JobDetail; report: InspectionReport | null }) {
  const invalidate = useInvalidateJob(job.id);
  const latest = report?.versions[report.versions.length - 1] ?? null;
  const returned = report?.status === 'RETURNED' || report?.status === 'AMENDMENT_REQUIRED';
  const isAmendment = (report?.versions.length ?? 0) > 0;

  const [outcome, setOutcome] = useState<InspectionOutcome | null>(returned ? latest?.outcome ?? null : null);
  const [description, setDescription] = useState(returned ? latest?.inspection_description ?? '' : '');
  const [amendment, setAmendment] = useState('');
  const [customerVisible, setCustomerVisible] = useState(false);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const reportIdRef = useRef<string | null>(report?.id ?? null);
  useEffect(() => { reportIdRef.current = report?.id ?? reportIdRef.current; }, [report?.id]);
  useEffect(() => () => captures.forEach((c) => c.previewUrl && URL.revokeObjectURL(c.previewUrl)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Photos already uploaded from this device (G9: the API returns no media list).
  // Snapshot taken once: photos uploaded in THIS visit are tracked in `captures`, so they aren't counted twice.
  const [devicePhotos] = useState(() => (report ? localMedia.list(report.id).filter((m) => m.media_type === 'PHOTO') : []));
  const uploadedPhotos = devicePhotos.length + captures.filter((c) => c.state === 'uploaded' && c.kind === 'PHOTO').length;
  // A submitted version proves a PHOTO already exists on the report (media is never tied to a version).
  const photoGateMet = uploadedPhotos > 0 || isAmendment;

  async function ensureReport(): Promise<string> {
    if (reportIdRef.current) return reportIdRef.current;
    const created = await api.createInspectionReport(job.id); // get-or-create
    reportIdRef.current = created.id;
    return created.id;
  }

  async function onFiles(files: File[]) {
    for (const file of files) {
      const key = crypto.randomUUID();
      const isVideo = file.type.startsWith('video/');
      setCaptures((cs) => [...cs, { key, name: file.name, kind: isVideo ? 'VIDEO' : 'PHOTO', previewUrl: isVideo ? undefined : URL.createObjectURL(file), state: 'uploading' }]);
      try {
        const reportId = await ensureReport();
        const stored = await storeFile(file);
        const row = await api.addInspectionMedia(reportId, {
          media_type: isVideo ? 'VIDEO' : 'PHOTO',
          file_uri: stored.file_uri,
          file_name: stored.file_name,
          customer_visible: customerVisible,
        });
        localMedia.add(reportId, { id: row.id, file_name: row.file_name, media_type: row.media_type, uploaded_at: row.uploaded_at, version_id: row.version_id });
        setCaptures((cs) => cs.map((c) => (c.key === key ? { ...c, name: row.file_name, state: 'uploaded' } : c)));
      } catch (e) {
        setCaptures((cs) => cs.map((c) => (c.key === key ? { ...c, state: 'failed', error: `Upload failed: ${apiErrorText(e)}` } : c)));
      }
    }
    void invalidate();
  }

  const submit = useJobAction(job.id, async () => {
    const reportId = await ensureReport();
    return api.submitInspection(reportId, {
      inspection_description: description.trim(),
      outcome: outcome!,
      ...(isAmendment ? { amendment_reason: amendment.trim() } : {}),
    });
  });

  const blocked = !photoGateMet ? 'Add at least one photo to submit'
    : !outcome ? 'Choose an outcome'
    : !description.trim() ? 'Describe what you found'
    : isAmendment && !amendment.trim() ? 'Say what changed in this version'
    : null;

  const photoTiles: Capture[] = [
    ...devicePhotos.map((m) => ({ key: m.id, name: m.file_name, kind: 'PHOTO' as const, state: 'uploaded' as const })),
    ...captures,
  ];

  return (
    <>
      {returned && (
        <InlineAlert tone="blocked" title={`Returned by Purchase — version ${latest?.version_no}`}>
          Fix what Purchase asked for and submit a new version. Your previous answers are filled in.
        </InlineAlert>
      )}
      {returned && <GapNote code="G13">Purchase's return comment is stored but no API returns it — ask Purchase what to change.</GapNote>}
      {isAmendment && (
        <TextArea
          label="What changed in this version?"
          value={amendment}
          onChange={(e) => setAmendment(e.target.value)}
          helper="Required for every version after the first."
        />
      )}

      <PhotoCapture title="Photos" captures={photoTiles} onFiles={onFiles} />
      {isAmendment && uploadedPhotos === 0 && (
        <p className="text-sm text-fg-2">Photos from your earlier version still count. Add more if Purchase asked for them.</p>
      )}
      {UPLOAD_IS_PLACEHOLDER && (
        <GapNote code="G4">No file-upload endpoint: the photo is recorded against the report, but the image itself stays on this device.</GapNote>
      )}

      <label className="flex items-center gap-3">
        <span className="flex-1 text-base leading-6">Show new photos to the customer</span>
        <button
          type="button"
          role="switch"
          aria-checked={customerVisible}
          onClick={() => setCustomerVisible((v) => !v)}
          className={cx('relative h-8 w-[52px] shrink-0 rounded-full transition-colors', customerVisible ? 'bg-accent' : 'bg-line-strong')}
        >
          <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white transition-all', customerVisible ? 'left-6' : 'left-1')} />
        </button>
      </label>

      <Card title="Outcome">
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Outcome">
          {OUTCOMES.map((o) => {
            const on = outcome === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setOutcome(o.value)}
                className={cx('flex items-center gap-3 rounded-lg border px-3.5 py-3 text-left',
                  on ? 'border-accent bg-brand-subtle' : 'border-line bg-surface hover:border-line-strong')}
              >
                <span className={cx('flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2', on ? 'border-accent' : 'border-line-strong')}>
                  {on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-medium leading-6">{o.label}</span>
                  <span className="block text-sm leading-5 text-fg-2">{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <TextArea
        label="What did you find?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        helper="Required. Describe the fault, readings and evidence."
      />

      <FormError messages={submit.errors} />
      <div className="rounded-[10px] border border-line bg-surface p-4">
        <GatedAction
          blockedReason={blocked}
          readyNote={uploadedPhotos > 0 ? `${uploadedPhotos} photo${uploadedPhotos === 1 ? '' : 's'} attached` : undefined}
          primaryLabel={isAmendment ? 'Submit new version' : 'Submit report'}
          primaryIcon={<IconSend size={20} />}
          busy={submit.busy}
          onPrimary={() => submit.run(undefined)}
        />
      </div>
    </>
  );
}

// ------------------------------------------------------------------ locked (E4c) + accepted
function LockedReport({ job, report }: { job: JobDetail; report: InspectionReport }) {
  const latest = report.versions[report.versions.length - 1]!;
  const outcome = OUTCOMES.find((o) => o.value === latest.outcome);
  const photos = localMedia.list(report.id).filter((m) => m.media_type === 'PHOTO');
  return (
    <>
      {report.status === 'SUBMITTED' ? (
        <InlineAlert tone="progress" title="Waiting for Purchase review" icon={<IconInfoCircle size={20} />}>
          Version {latest.version_no} was sent on {formatDateTime(latest.submitted_at)}. You'll be able to request parts once it's accepted.
        </InlineAlert>
      ) : (
        <InlineAlert tone="success" title="Accepted by Purchase">
          Version {latest.version_no} was accepted. You can now request parts.
        </InlineAlert>
      )}

      <Card>
        {report.versions.map((v) => (
          <div key={v.id} className="flex items-center gap-2">
            <span className="text-base font-medium leading-6">Version {v.version_no}</span>
            <StatusBadge domain="reportVersion" value={v.version_status} />
            <span className="ml-auto text-sm text-fg-2">{formatDateTime(v.submitted_at)}</span>
          </div>
        ))}
        {photos.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <li key={p.id} title={p.file_name} className="flex h-[72px] w-[72px] items-center justify-center rounded-lg bg-subtle">
                <IconPhoto size={24} className="text-fg-muted" />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <GapNote code="G9">The report API returns no media list, so only photos taken on this device are shown.</GapNote>

      <Card title="Outcome">
        <div className="flex items-center gap-3 rounded-lg border border-accent bg-brand-subtle px-3.5 py-3">
          <IconLock size={18} className="shrink-0 text-fg-muted" />
          <span>
            <span className="block text-base font-medium leading-6">{outcome?.label ?? latest.outcome}</span>
            <span className="block text-sm leading-5 text-fg-2">{outcome?.hint}</span>
          </span>
        </div>
      </Card>
      <TextArea label="What did you find?" value={latest.inspection_description} readOnlyLocked />
      {latest.amendment_reason && <TextArea label="What changed" value={latest.amendment_reason} readOnlyLocked />}
      <p className="text-sm text-fg-2">Locked after submit</p>

      {report.status === 'ACCEPTED' && (
        <Link to={`/jobs/${job.id}/material`} className="self-start">
          <Button icon={<IconPackage size={20} />}>Request parts</Button>
        </Link>
      )}
    </>
  );
}
