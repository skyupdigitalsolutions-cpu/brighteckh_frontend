// STG0 · Create GRN · PO-00044 (177:139458). Data: GET /stores/purchase-orders/:id; write: POST /purchase-orders/:id/grns.
// Card 177:139462: glass-strong, radius 28, p-24, gap 16, fills the content height; footer pinned bottom-right (gap 12).
// Fields row 177:139463 (gap 16): compact "Text field" boxes = h-36, px-12, radius 12, bg-surface, 1px border-strong.
// Lines table: header (Item grow · Ordered 120 · Received now * 200) + rows; stepper 177:139482 = 40×40 radius-12
// bordered −/+ (18/24 SemiBold) around a 70px Data/Number-strong value.
// API over Figma (GapNote GRN-1):
//   - CreateGrnDto has only `lines` + `notes`. "Delivery note no." and "Vehicle / AWB" have no API field: they are
//     saved into the GRN's `notes` ("DN … · Vehicle/AWB …"), which the GRN header then shows. Not required (Figma's
//     asterisk would be a rule the API doesn't have).
//   - "Received at" can't be set: the server stamps received_at when the GRN is created. Shown read-only.
// Received now: 0 … outstanding (ordered − already received on earlier GRNs); 0 leaves the line out of this GRN, and
// the API needs at least one line with received_quantity >= 1.
import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconCheck, IconFileOff, IconLock } from '@tabler/icons-react';
import { apiStatus } from '../../../api/http';
import { formatQty } from '../../../lib/format';
import {
  Button, EmptyState, ErrorState, FormErrors, GapNote, GlassCard, Ic, InlineAlert, PageContent, PageHeader, SkeletonRows,
  StateCard, TD, TH, THead, TR, cx, errorBody,
} from '../../../ui/desktop';
import { num, useCreateGrn, useStoresPo, type StoresPoDetail, type StoresPoLine } from '../api';
import { ItemCell } from '../ui';

const GAP = 12;
const COLS = { ordered: 120, received: 200 };

export function CreateGrnPage() {
  const { poId = '' } = useParams();
  const q = useStoresPo(poId);

  if (q.isPending) {
    return (
      <>
        <PageHeader title="Create GRN" meta=" " />
        <PageContent><CardShell><SkeletonRows rows={3} widths={[300, 80, 160]} /></CardShell></PageContent>
      </>
    );
  }
  if (q.isError) {
    const notFound = apiStatus(q.error) === 404;
    return (
      <>
        <PageHeader title="Create GRN" />
        <PageContent>
          <StateCard>
            {notFound
              ? <EmptyState icon={IconFileOff} title="Purchase order not found" body={<>It may belong to another company. <Link className="underline" to="/st/receive">Back to Receive</Link></>} />
              : <ErrorState title="Couldn't load the purchase order" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />}
          </StateCard>
        </PageContent>
      </>
    );
  }
  return <CreateGrnForm po={q.data} />;
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <GlassCard strong className="flex min-h-[808px] w-full flex-1 flex-col items-start gap-[16px] p-[24px]">
      {children}
    </GlassCard>
  );
}

function CreateGrnForm({ po }: { po: StoresPoDetail }) {
  const nav = useNavigate();
  const create = useCreateGrn(po.po_id);
  const sh = po.latest_shipment;
  const shipRef = [sh?.carrier, sh?.awb_or_lr_number].filter(Boolean).join(' · ');
  const [dn, setDn] = useState('');
  const [vehicle, setVehicle] = useState(shipRef);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(po.lines.map((l) => [l.po_line_id, num(l.outstanding_quantity)])));

  const lines = po.lines.filter((l) => (qty[l.po_line_id] ?? 0) > 0);
  const notes = [dn.trim() && `DN ${dn.trim()}`, vehicle.trim() && `Vehicle/AWB ${vehicle.trim()}`].filter(Boolean).join(' · ');
  const canSubmit = po.can_receive && lines.length > 0;

  const submit = () => create.mutate(
    { lines: lines.map((l) => ({ po_line_id: l.po_line_id, received_quantity: qty[l.po_line_id] })), ...(notes ? { notes } : {}) },
    { onSuccess: (g) => nav(`/st/grns/${g.id}`, { state: { created: true } }) },
  );

  return (
    <>
      <PageHeader title={`Create GRN · ${po.po_number}`} meta={[po.supplier_name, shipRef].filter(Boolean).join(' · ')} />
      <PageContent>
        <CardShell>
          <div className="flex w-full items-start gap-[16px] overflow-clip">
            <CompactField label="Delivery note no." value={dn} onChange={(e) => setDn(e.target.value)} placeholder="Supplier's DN number" maxLength={60} />
            <div className="flex min-w-px flex-1 flex-col items-start gap-[6px]">
              <p className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">Received at</p>
              <div className="flex h-[36px] w-full items-center gap-[8px] overflow-clip rounded-t-field border border-line bg-subtle px-[12px]">
                <Ic icon={IconLock} size={16} className="shrink-0 text-fg-2" />
                <p className="truncate text-[14px] leading-[20px] text-fg-2">Stamped by the server when you create the GRN</p>
              </div>
            </div>
            <CompactField label="Vehicle / AWB" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Vehicle no. or courier AWB" maxLength={80} />
          </div>
          <GapNote code="GRN-1">
            The GRN API has no delivery-note, vehicle or received-at fields. Delivery note and Vehicle / AWB are saved in the
            GRN notes; the received time is set by the server.
          </GapNote>

          <div className="flex w-full flex-col">
            <THead gap={GAP}>
              <TH grow>Item</TH>
              <TH w={COLS.ordered}>Ordered</TH>
              <TH w={COLS.received}>Received now *</TH>
            </THead>
            {po.lines.map((l) => (
              <LineRow key={l.po_line_id} l={l} value={qty[l.po_line_id] ?? 0} onChange={(v) => setQty((s) => ({ ...s, [l.po_line_id]: v }))} />
            ))}
          </div>
          <p className="text-[12px] leading-[16px] text-fg-2">
            Count what physically arrived. Inspection (accept / reject / hold) happens per line after the GRN is created.
          </p>

          {!po.can_receive && (
            <InlineAlert tone="neutral" title={`${po.po_number} is ${po.po_status.replace(/_/g, ' ')}`}>
              {po.po_status === 'RELEASED'
                ? 'A GRN can be created once the supplier acknowledges this PO.'
                : 'This PO no longer takes GRNs.'}
            </InlineAlert>
          )}
          {po.can_receive && lines.length === 0 && (
            <InlineAlert tone="neutral" title="Nothing counted">
              {po.lines.every((l) => num(l.outstanding_quantity) <= 0)
                ? 'Every line of this PO is already received on earlier GRNs.'
                : 'Set the received quantity on at least one line.'}
            </InlineAlert>
          )}
          <FormErrors error={create.error} title="The GRN wasn't created" />

          <div className="min-h-px w-px flex-1" />
          <div className="flex w-full items-start justify-end gap-[12px] overflow-clip">
            <Button kind="secondary" onClick={() => nav('/st/receive')}>Cancel</Button>
            {po.can_receive && (
              <Button icon={<Ic icon={IconCheck} size={18} />} disabled={!canSubmit} busy={create.isPending} onClick={submit}>Create GRN</Button>
            )}
          </div>
        </CardShell>
      </PageContent>
    </>
  );
}

function CompactField({ label, ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex min-w-px flex-1 flex-col items-start gap-[6px]">
      <span className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</span>
      <input
        {...rest}
        className="h-[36px] w-full rounded-t-field border border-line-strong bg-surface px-[12px] text-[14px] leading-[20px] text-fg placeholder:text-fg-muted focus:outline-none focus:ring-inside-brand"
      />
    </label>
  );
}

function LineRow({ l, value, onChange }: { l: StoresPoLine; value: number; onChange: (v: number) => void }) {
  const max = num(l.outstanding_quantity);
  const already = num(l.received_quantity);
  const step = (d: 1 | -1) => onChange(Math.max(0, Math.min(max, d > 0 ? value + 1 : Math.ceil(value) - 1)));
  return (
    <TR gap={GAP} className="hover:bg-transparent">
      <TD grow><ItemCell code={l.item_code} name={l.item_name} /></TD>
      <TD w={COLS.ordered}>
        <div className="flex flex-col">
          <span className="whitespace-nowrap font-mono text-[14px] leading-[20px] text-fg">{formatQty(l.ordered_quantity, l.uom)}</span>
          {already > 0 && <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">{formatQty(l.received_quantity)} already received</span>}
        </div>
      </TD>
      <TD w={COLS.received}>
        {max <= 0 ? (
          <span className="whitespace-nowrap text-[12px] leading-[16px] text-fg-muted">Fully received</span>
        ) : (
          <div className="flex items-center gap-[8px] overflow-clip">
            <StepBtn label={`Fewer ${l.item_code}`} onClick={() => step(-1)} disabled={value <= 0}>−</StepBtn>
            <p className="w-[70px] text-center font-mono text-[14px] font-semibold leading-[20px] text-fg" aria-live="polite">{formatQty(String(value), l.uom)}</p>
            <StepBtn label={`More ${l.item_code}`} onClick={() => step(1)} disabled={value >= max}>+</StepBtn>
          </div>
        )}
      </TD>
    </TR>
  );
}

function StepBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-clip rounded-t-field border border-line-strong text-[18px] font-semibold leading-[24px] text-fg',
        'hover:bg-subtle disabled:cursor-not-allowed disabled:hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}

