// Create RFQ drawer — opened by "Create RFQ for n shortage(s)" (D·P5 177:103647). No Figma frame draws this drawer;
// it is composed from the kit Drawer (177:108447 layout) + kit fields, with the API's CreateRfqDto fields only:
// one block per OPEN shortage source (technical_specification *, manufacturer_preference, preference_reason,
// desired_delivery_by) + RFQ notes. Item, quantity and UOM are taken by the server from the shortage — the drawer
// shows them read-only. One RFQ = one job (CLAUDE.md: separate enquiry per job, no cross-job grouping) — the drawer
// only ever lists this job's shortages. POST /jobs/{id}/rfqs.
import { useEffect, useState } from 'react';
import { IconSquare, IconSquareCheck } from '@tabler/icons-react';
import { Drawer } from '../../../ui/desktop/Drawer';
import { Button } from '../../../ui/desktop/Button';
import { DateField, TextAreaField, TextInput, FieldRow } from '../../../ui/desktop/Fields';
import { FormErrors, InlineAlert } from '../../../ui/desktop/Feedback';
import { cx, Ic } from '../../../ui/desktop/Icon';
import { formatQty } from '../../../lib/format';
import { useCreateRfq, type RfqCreated, type RfqLineBody } from '../api';

export type ShortageChoice = { id: string; code: string; name: string; qty: string; uom: string };
type LineDraft = { spec: string; make: string; reason: string; by: string };
const blank: LineDraft = { spec: '', make: '', reason: '', by: '' };

export function CreateRfqDrawer({ open, onClose, jobId, jobNumber, shortages, preselected, onCreated }: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber: string;
  shortages: ShortageChoice[];
  preselected: string[];
  onCreated: (rfq: RfqCreated) => void;
}) {
  const create = useCreateRfq(jobId);
  const [sel, setSel] = useState<string[]>([]);
  const [lines, setLines] = useState<Record<string, LineDraft>>({});
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSel(preselected);
    setLines({});
    setNotes('');
    setTried(false);
    create.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const draft = (id: string) => lines[id] ?? blank;
  const patch = (id: string, p: Partial<LineDraft>) => setLines((s) => ({ ...s, [id]: { ...draft(id), ...p } }));
  const chosen = shortages.filter((s) => sel.includes(s.id));
  const missingSpec = chosen.some((s) => !draft(s.id).spec.trim());

  const submit = () => {
    setTried(true);
    if (chosen.length === 0 || missingSpec) return;
    const body: RfqLineBody[] = chosen.map((s) => {
      const d = draft(s.id);
      return {
        shortage_source_id: s.id,
        technical_specification: d.spec.trim(),
        ...(d.make.trim() ? { manufacturer_preference: d.make.trim() } : {}),
        ...(d.reason.trim() ? { preference_reason: d.reason.trim() } : {}),
        ...(d.by ? { desired_delivery_by: d.by } : {}),
      };
    });
    create.mutate({ lines: body, ...(notes.trim() ? { notes: notes.trim() } : {}) }, { onSuccess: (r) => onCreated(r) });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      busy={create.isPending}
      title="Create RFQ"
      subtitle={`${jobNumber} · one enquiry for this job only`}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={create.isPending}>
            {chosen.length === 1 ? 'Create RFQ for 1 shortage' : `Create RFQ for ${chosen.length} shortages`}
          </Button>
        </>
      )}
    >
      <div className="flex w-full flex-col gap-[8px]">
        <span className="text-[14px] font-medium leading-[20px] text-fg">Shortages *</span>
        {shortages.map((s) => {
          const on = sel.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => setSel((x) => (on ? x.filter((i) => i !== s.id) : [...x, s.id]))}
              className={cx(
                'flex w-full items-center gap-[10px] rounded-t-field border px-[14px] py-[10px] text-left',
                on ? 'border-brand-border bg-brand-subtle' : 'border-line bg-subtle hover:bg-surface',
              )}
            >
              <Ic icon={on ? IconSquareCheck : IconSquare} size={18} className={on ? 'text-accent' : 'text-fg-2'} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-[13px] font-medium leading-[18px] text-fg-2">{s.code}</span>
                <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{s.name}</span>
              </span>
              <span className="whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg">{formatQty(s.qty, s.uom)}</span>
            </button>
          );
        })}
        {tried && chosen.length === 0 && <p className="text-[12px] leading-[16px] text-st-blocked-fg">Pick at least one shortage.</p>}
      </div>

      {chosen.map((s, i) => {
        const d = draft(s.id);
        return (
          <div key={s.id} className="flex w-full flex-col gap-[14px]">
            <p className="text-[14px] font-semibold leading-[20px] text-fg">Line {i + 1} · {s.name}</p>
            <TextAreaField
              label="Technical specification *"
              rows={3}
              value={d.spec}
              onChange={(e) => patch(s.id, { spec: e.target.value })}
              error={tried && !d.spec.trim() ? 'Required — this is what the supplier quotes against.' : null}
            />
            <FieldRow>
              <TextInput label="Preferred make / part" value={d.make} onChange={(e) => patch(s.id, { make: e.target.value })} />
              <DateField label="Needed by" value={d.by} onChange={(e) => patch(s.id, { by: e.target.value })} />
            </FieldRow>
            <TextInput label="Preference reason" value={d.reason} onChange={(e) => patch(s.id, { reason: e.target.value })} />
          </div>
        );
      })}

      <TextAreaField label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <InlineAlert tone="neutral" title="What suppliers receive">
        Item, quantity, specification and needed-by date. No customer details and no other suppliers' prices.
      </InlineAlert>
      <FormErrors error={create.error} />
    </Drawer>
  );
}
