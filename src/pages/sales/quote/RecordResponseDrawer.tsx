// Figma "SS · Record response (drawer) · Q-00083" 177:139083 → Drawer 177:139127.
// 520 wide, p-28, gap 16. Title 22/28 SemiBold, subtitle 14/20 secondary. Chip groups (177:139134 / 177:139149):
// label 14/20 Medium, gap 8, chips px-12 py-8 radius 16, 11/14 SemiBold +0.44; selected = brand-subtle fill +
// brand border + primary text, else bg-subtle + border-default + secondary text. Two text fields (Customer contact,
// Notes). Evidence 177:139164: dashed border-strong, radius 14, px-14 py-12, gap 10, 18px upload, 14/20 secondary.
// Footer: Cancel (secondary) + Save response (primary, check icon), both flex-1.
//
// API: POST /jobs/:job_id/quote-responses { br04_quote_revision_id, response_type, response_channel?,
// customer_contact? (varchar 180), response_notes?, evidence_uri? } — evidence_uri = POST /uploads file_uri.
// Deviations: + EXPIRED chip (the enum has it and it is the only way an EXPIRED outcome exists — no auto-expiry);
// AWAITING_RESPONSE is not offered (it is the implicit state). PARTIAL ACCEPTANCE stores no lines (GapNote).
// Upload takes images or PDF only (no .eml/.msg). Subtitle shows the revision instead of a total (no API total).
import { useRef, useState } from 'react';
import { IconCheck, IconFileText, IconRefresh, IconUpload, IconX } from '@tabler/icons-react';
import { Button, Drawer, FormErrors, GapNote, Ic, TextInput, cx } from '../../../ui/desktop';
import { apiErrorText } from '../../../api/http';
import { enumLabel } from '../../../lib/format';
import { purchaseApi } from '../../purchase/api';
import {
  RESPONSE_CHANNELS, RESPONSE_TYPES, useRecordResponse,
  type ResponseChannel, type ResponseRecorded, type ResponseType, type SalesRevision,
} from './api';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

function Chips<V extends string>({ label, options, value, onChange, error }: {
  label: string; options: V[]; value: V | null; onChange: (v: V | null) => void; error?: string | null;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full flex-col items-start gap-[8px] overflow-clip">
      <p className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</p>
      <div className="flex w-full flex-wrap items-start gap-[8px]">
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on && !label.endsWith('*') ? null : o)}
              className={cx(
                'flex shrink-0 items-start overflow-clip rounded-[16px] border px-[12px] py-[8px] text-[11px] font-semibold leading-[14px] tracking-[0.44px] whitespace-nowrap',
                on ? 'border-brand-border bg-brand-subtle text-fg' : 'border-line bg-subtle text-fg-2 hover:bg-surface',
              )}
            >
              {enumLabel(o)}
            </button>
          );
        })}
      </div>
      {error && <p className="text-[12px] leading-[16px] text-st-blocked-fg">{error}</p>}
    </div>
  );
}

type Evidence = { name: string; state: 'uploading' | 'uploaded' | 'failed'; progress: number; uri?: string; error?: string; file: File };

export function RecordResponseDrawer({ open, onClose, onRecorded, jobId, quoteId, revision, subtitle }: {
  open: boolean;
  onClose: () => void;
  onRecorded: (r: ResponseRecorded) => void;
  jobId: string;
  quoteId: string;
  /** The BR-04 revision being answered. The caller only opens this for the latest revision while it is SENT. */
  revision: SalesRevision;
  subtitle: string;
}) {
  const [type, setType] = useState<ResponseType | null>(null);
  const [channel, setChannel] = useState<ResponseChannel | null>(null);
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [tried, setTried] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const m = useRecordResponse(jobId, quoteId);
  const uploading = evidence?.state === 'uploading';

  function reset() {
    setType(null); setChannel(null); setContact(''); setNotes(''); setEvidence(null); setTried(false); m.reset();
  }
  function close() { reset(); onClose(); }

  function upload(file: File) {
    setEvidence({ name: file.name, state: 'uploading', progress: 0, file });
    purchaseApi.upload(file, (pct) => setEvidence((e) => (e && e.file === file ? { ...e, progress: pct } : e)))
      .then((r) => setEvidence((e) => (e && e.file === file ? { ...e, state: 'uploaded', progress: 100, uri: r.file_uri } : e)))
      .catch((err) => setEvidence((e) => (e && e.file === file ? { ...e, state: 'failed', error: apiErrorText(err) } : e)));
  }

  function submit() {
    setTried(true);
    if (!type || uploading || evidence?.state === 'failed') return;
    m.mutate({
      br04_quote_revision_id: revision.id,
      response_type: type,
      ...(channel ? { response_channel: channel } : {}),
      ...(contact.trim() ? { customer_contact: contact.trim() } : {}),
      ...(notes.trim() ? { response_notes: notes.trim() } : {}),
      ...(evidence?.uri ? { evidence_uri: evidence.uri } : {}),
    }, {
      onSuccess: (r) => { reset(); onRecorded(r); },
    });
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      bodyGap={16}
      title="Record customer response"
      subtitle={subtitle}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} disabled={uploading} icon={<Ic icon={IconCheck} size={18} />}>Save response</Button>
        </>
      )}
    >
      <Chips label="Response *" options={RESPONSE_TYPES} value={type} onChange={setType} error={tried && !type ? 'Choose the customer’s response.' : null} />
      {type === 'PARTIAL_ACCEPTANCE' && (
        <GapNote code="G-S8">Accepted lines aren’t captured: the API has no partial-acceptance lines. Put the accepted lines and quantities in Notes.</GapNote>
      )}
      <Chips label="Channel" options={RESPONSE_CHANNELS} value={channel} onChange={setChannel} />
      <TextInput label="Customer contact" value={contact} maxLength={180} onChange={(e) => setContact(e.target.value)} placeholder="Name · designation" />
      <TextInput label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What the customer said" />

      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      {!evidence ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border border-dashed border-line-strong px-[14px] py-[12px] text-left hover:bg-subtle"
        >
          <Ic icon={IconUpload} size={18} className="text-fg-2" />
          <span className="whitespace-nowrap text-[14px] leading-[20px] text-fg-2">Attach email / screenshot as evidence</span>
        </button>
      ) : (
        <div className={cx('flex w-full items-center gap-[10px] overflow-clip rounded-[14px] border px-[14px] py-[12px]', evidence.state === 'failed' ? 'border-danger' : 'border-line-strong')}>
          <Ic icon={IconFileText} size={18} className={evidence.state === 'failed' ? 'text-st-blocked-fg' : 'text-fg-2'} />
          <div className="flex min-w-px flex-1 flex-col">
            <span className="truncate text-[14px] leading-[20px] text-fg">{evidence.name}</span>
            <span className={cx('text-[12px] leading-[16px]', evidence.state === 'failed' ? 'text-st-blocked-fg' : 'text-fg-2')}>
              {evidence.state === 'uploading' ? `Uploading… ${evidence.progress}%` : evidence.state === 'failed' ? (evidence.error || 'Upload failed.') : 'Attached'}
            </span>
          </div>
          {evidence.state === 'failed' && (
            <button type="button" aria-label="Retry upload" onClick={() => upload(evidence.file)} className="flex h-[20px] w-[20px] shrink-0 items-center justify-center text-fg-2 hover:text-fg">
              <Ic icon={IconRefresh} size={16} />
            </button>
          )}
          {evidence.state !== 'uploading' && (
            <button type="button" aria-label="Remove evidence" onClick={() => setEvidence(null)} className="flex h-[20px] w-[20px] shrink-0 items-center justify-center text-fg-2 hover:text-fg">
              <Ic icon={IconX} size={16} />
            </button>
          )}
        </div>
      )}
      <p className="-mt-[8px] text-[12px] leading-[16px] text-fg-2">Image or PDF. Save an email as PDF or take a screenshot.</p>
      {tried && evidence?.state === 'failed' && <p className="text-[12px] leading-[16px] text-st-blocked-fg">Retry or remove the evidence before saving.</p>}

      <FormErrors error={m.error} title="The response wasn't saved" />
    </Drawer>
  );
}
