// POUT1 · Proof of delivery drawer: per line 246:52594, DAMAGED → next step BLOCKED 246:53235 (kit Drawer 520).
// POST /sales-outward-lines/:id/delivery once per line given a status (DeliveryEvidenceDto):
//   DELIVERED → delivered_qty (≤ shipped outward_qty; the server refuses more) + received_by_name + delivered_at + pod_uri
//   FAILED / DAMAGED → remarks (required by the API). BR-11 has NO follow-up path for these (open decision G20): the line
//   never reaches DELIVERED and the order can't close → shown as BLOCKED, as in 53235.
// API over Figma: 53235's "Damaged qty" has no API field (delivered_qty is for DELIVERED only) → the DAMAGED / FAILED
// line takes Remarks instead. The POD evidence file is uploaded once (POST /uploads) and its file_uri is sent as pod_uri
// on every DELIVERED line of this save.
import { useRef, useState } from 'react';
import { IconAlertTriangle, IconCheck, IconUpload } from '@tabler/icons-react';
import { formatQty } from '../../../lib/format';
import { Button, DateField, Drawer, FormErrors, Ic, InlineAlert, TextInput, cx } from '../../../ui/desktop';
import { purchaseApi } from '../../purchase/api';
import { DELIVERY_STATUSES, supplyApi, useSupplyMutation, type DeliveryStatus, type OutwardDetail, type OutwardLine } from '../api';
import { lineLabel, qtyNum, type LineInfo } from './data';
import { OpenQuestion } from './ui';

type Entry = { status: DeliveryStatus | null; qty: string; remarks: string };
const CHIP: Record<DeliveryStatus, string> = {
  DELIVERED: 'border-st-success-bd bg-st-success-bg text-st-success-fg',
  FAILED: 'border-st-blocked-bd bg-st-blocked-bg text-st-blocked-fg',
  DAMAGED: 'border-st-blocked-bd bg-st-blocked-bg text-st-blocked-fg',
};

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function PodDrawer({ o, lines, info, onClose, onDone }: {
  o: OutwardDetail; lines: OutwardLine[]; info: Record<string, LineInfo>; onClose: () => void;
  onDone: (r: { delivered: number; blocked: number }) => void;
}) {
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, { status: 'DELIVERED' as DeliveryStatus | null, qty: formatQty(l.outward_qty).replace(/,/g, ''), remarks: '' }])));
  const [receivedBy, setReceivedBy] = useState('');
  const [at, setAt] = useState(nowLocal);
  const [pod, setPod] = useState<{ uri: string; name: string } | null>(null);
  const [upState, setUpState] = useState<'idle' | 'uploading' | 'failed'>('idle');
  const [tried, setTried] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const save = useSupplyMutation(async () => {
    let delivered = 0; let blocked = 0;
    for (const l of lines) {
      const e = entries[l.id];
      if (!e?.status) continue;
      if (e.status === 'DELIVERED') {
        await supplyApi.recordDelivery(l.id, {
          delivery_status: 'DELIVERED', delivered_qty: Number(e.qty), received_by_name: receivedBy.trim() || undefined,
          delivered_at: at ? new Date(at).toISOString() : undefined, pod_uri: pod?.uri,
        });
        delivered += 1;
      } else {
        await supplyApi.recordDelivery(l.id, {
          delivery_status: e.status, remarks: e.remarks.trim(), received_by_name: receivedBy.trim() || undefined,
          delivered_at: at ? new Date(at).toISOString() : undefined,
        });
        blocked += 1;
      }
    }
    return { delivered, blocked };
  });

  const set = (id: string, patch: Partial<Entry>) => setEntries((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  const chosen = lines.filter((l) => entries[l.id]?.status);
  const over = chosen.filter((l) => entries[l.id].status === 'DELIVERED' && (!(qtyNum(entries[l.id].qty) > 0) || qtyNum(entries[l.id].qty) > qtyNum(l.outward_qty)));
  const missingRemarks = chosen.filter((l) => entries[l.id].status !== 'DELIVERED' && !entries[l.id].remarks.trim());
  const anyBad = chosen.some((l) => entries[l.id].status !== 'DELIVERED');
  const ready = chosen.length > 0 && over.length === 0 && upState !== 'uploading';

  const pickFile = async (f: File) => {
    setUpState('uploading');
    try {
      const up = await purchaseApi.upload(f);
      setPod({ uri: up.file_uri, name: up.original_name });
      setUpState('idle');
    } catch { setUpState('failed'); }
  };

  const submit = () => {
    setTried(true);
    if (!ready || missingRemarks.length) return;
    save.mutate(undefined, { onSuccess: onDone });
  };

  return (
    <Drawer
      open
      onClose={onClose}
      busy={save.isPending}
      bodyGap={16}
      title="Proof of delivery"
      subtitle={`${o.outward_number ?? ''} · per line`}
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" disabled={!ready} busy={save.isPending} icon={<Ic icon={IconCheck} size={18} />}>Save POD</Button>
        </>
      )}
    >
      <div className="flex w-full flex-col">
        <div className="flex w-full items-start gap-[10px] overflow-clip rounded-[18px] bg-subtle px-[10px] py-[10px]">
          <span className="min-w-px flex-1 text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">Line</span>
          <span className="w-[196px] shrink-0 text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">Delivery status</span>
        </div>
        {lines.map((l) => {
          const e = entries[l.id];
          return (
            <div key={l.id} className="flex w-full items-center gap-[10px] overflow-clip border-b border-line px-[10px] py-[12px]">
              <p className="min-w-px flex-1 truncate text-[14px] font-medium leading-[20px] text-fg">
                {lineLabel(l, info[l.sales_order_line_id])} · {formatQty(l.outward_qty, l.uom)}
              </p>
              <div role="radiogroup" className="flex w-[196px] shrink-0 items-center gap-[4px]">
                {DELIVERY_STATUSES.map((s) => {
                  const on = e?.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set(l.id, { status: on ? null : s })}
                      className={cx(
                        'inline-flex items-center gap-[6px] rounded-t-sm border px-[6px] py-[3px] text-[11px] font-semibold leading-[14px] tracking-[0.44px]',
                        on ? CHIP[s] : 'border-st-neutral-bd bg-st-neutral-bg text-st-neutral-fg opacity-70 hover:opacity-100',
                      )}
                    >
                      <span className="h-[6px] w-[6px] rounded-full bg-current" aria-hidden />{s}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {chosen.map((l) => {
        const e = entries[l.id];
        const name = lineLabel(l, info[l.sales_order_line_id]);
        return e.status === 'DELIVERED' ? (
          <TextInput
            key={l.id}
            label={`Delivered qty · ${name}`}
            mono="number"
            inputMode="decimal"
            value={e.qty}
            onChange={(ev) => set(l.id, { qty: ev.target.value.replace(/[^\d.]/g, '') })}
            trailing={<span className="text-[14px] leading-[20px] text-fg-2">{l.uom}</span>}
            error={over.includes(l) ? `Must be more than 0 and at most the shipped ${formatQty(l.outward_qty, l.uom)}` : null}
          />
        ) : (
          <TextInput
            key={l.id}
            label={`Remarks · ${name} (${e.status}) *`}
            value={e.remarks}
            onChange={(ev) => set(l.id, { remarks: ev.target.value })}
            placeholder={e.status === 'DAMAGED' ? 'What was damaged, how many' : 'Why the delivery failed'}
            error={tried && !e.remarks.trim() ? 'Required for FAILED / DAMAGED' : null}
          />
        );
      })}

      <TextInput label="Received by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Name at the customer" />
      <DateField label="Delivered at" withTime value={at} onChange={(e) => setAt(e.target.value)} />
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); e.target.value = ''; }} />
      <button
        type="button"
        onClick={() => file.current?.click()}
        className={cx('flex h-[44px] w-full items-center gap-[10px] overflow-clip rounded-t-field border border-dashed px-[14px] text-left',
          upState === 'failed' ? 'border-danger' : 'border-line-strong')}
      >
        <Ic icon={upState === 'failed' ? IconAlertTriangle : IconUpload} size={18} className={upState === 'failed' ? 'text-st-blocked-fg' : 'text-fg-2'} />
        <span className={cx('min-w-0 truncate text-[14px] leading-[20px]', upState === 'failed' ? 'text-st-blocked-fg' : 'text-fg-2')}>
          {upState === 'uploading' ? 'Uploading…' : upState === 'failed' ? 'Upload failed — tap to retry'
            : pod ? `${pod.name} · uploaded` : 'Signed DC / delivery photo (evidence)'}
        </span>
      </button>

      {anyBad && (
        <>
          <InlineAlert tone="blocked" icon={IconAlertTriangle} title="What happens next isn't defined">
            The POD is recorded, but re-dispatch, return to stock, or credit note for FAILED / DAMAGED lines is not decided.
          </InlineAlert>
          <OpenQuestion code="G20">POD FAILED / DAMAGED path (re-dispatch vs return to stock vs credit note) is not decided.</OpenQuestion>
        </>
      )}
      {chosen.length === 0 && <p className="text-[12px] leading-[16px] text-fg-2">Pick a delivery status for at least one line to save.</p>}
      <FormErrors error={save.error} title="The POD wasn't saved for every line" />
    </Drawer>
  );
}
