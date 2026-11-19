// AS0 · Sales policy (/a/sales-policy, SYSTEM_ADMIN) — Figma UNSET (BLOCKED) 247:55208 · example configuration 247:55530.
// Header "Sales policy" + meta "BR-11 company policy · BLR · CLIENT-UNCONFIRMED". Content gap 16:
//   top Inline alert (blocked "Policy not set — …" / neutral when set);
//   three cards in a row (gap 20; glass-strong, radius 24, p-22, gap 12; head = 15/20 SemiBold + status badge):
//     Invoice trigger (11C-07): chips ADVANCE · DISPATCH · DELIVERY · MILESTONE (disabled) + "MILESTONE is not supported
//       for product sales." (12/16 muted) + open question G12;
//     Payment before closure (11C-09): chips YES · NO + open question G15;
//     Product GST rate (P-12): read-only locked field (h-36, radius 12, bg-subtle, 1px border-default, 16px lock) +
//       helper "Set in company tax settings" + open question G13;
//   "What is blocked right now" card (glass-strong, radius 24, p-22, gap 12): rows bg-subtle, radius 14, px-16 py-12, gap 10,
//     18px x / check, title 14/20 Medium + reason 12/16 secondary, BLOCKED / OK badge;
//   actions row right-aligned: Gated action (560) while nothing to save, else primary "Save policy" (check icon).
//
// Data: GET /sales-config → policy (null = unset), product_gst_rate (null = unset), blocked {product_invoicing,
// order_closure}. PUT /sales-config/policy {invoice_trigger?, requires_full_payment_for_closure?, note?}; null = unset
// (blocked again). Values are CLIENT-UNCONFIRMED (11C-07, 11C-09, P-12): an unset value is never pre-filled.
// Deviations:
// - Save is ENABLED once the admin picks a value (the API allows SYSTEM_ADMIN to save); the frame's "Awaiting client
//   confirmation — values can't be saved as guesses" lock is replaced by a confirm step that states the decision is
//   CLIENT-UNCONFIRMED and what it unblocks. The confirm step also takes the optional policy `note` (not drawn).
// - Clicking a selected chip clears it (sends null = blocked again); the frame has no way to unset.
// - GST card shows the configured PRODUCT_SALE rate (IGST, with CGST + SGST and HSN/SAC) read-only; no write endpoint here.
// - Top alert copy reflects the real state (the "Example configuration" copy is design-only); the set-state alert shows the
//   saved note and update time.
import { useMemo, useState, type ReactNode } from 'react';
import { IconCheck, IconInfoCircle, IconLock, IconX } from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthProvider';
import { enumLabel, formatDateTime, formatQty } from '../../../lib/format';
import {
  Badge, Button, Drawer, ErrorState, FormErrors, GatedAction, GlassCard, Ic, InlineAlert, PageHeader, StateCard, TextAreaField,
  errorBody, useToast,
} from '../../../ui/desktop';
import { INVOICE_TRIGGERS, supplyApi, useSalesConfig, useSupplyMutation, type InvoiceTrigger, type SalesConfig, type SalesPolicyBody } from '../api';
import { OpenQuestion, PolicyChip } from './local';

type Trigger = NonNullable<InvoiceTrigger>;

export function SalesPolicyPage() {
  const { companyCode } = useAuth();
  const q = useSalesConfig();
  return (
    <>
      <PageHeader title="Sales policy" meta={`BR-11 company policy · ${companyCode ?? '…'} · CLIENT-UNCONFIRMED`} />
      {q.isPending ? <PolicySkeleton /> : q.isError ? (
        <StateCard>
          <ErrorState title="Couldn't load the sales policy" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
        </StateCard>
      ) : (
        <PolicyForm key={q.data.policy?.updated_at ?? 'unset'} config={q.data} />
      )}
    </>
  );
}

function PolicyForm({ config }: { config: SalesConfig }) {
  const toast = useToast();
  const saved = config.policy;
  const savedTrigger = (saved?.invoice_trigger ?? null) as Trigger | null;
  const savedClosure = saved?.requires_full_payment_for_closure ?? null;
  const [trigger, setTrigger] = useState<Trigger | null>(savedTrigger);
  const [closure, setClosure] = useState<boolean | null>(savedClosure);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
  const m = useSupplyMutation((b: SalesPolicyBody) => supplyApi.setPolicy(b));

  const triggerChanged = trigger !== savedTrigger;
  const closureChanged = closure !== savedClosure;
  const dirty = triggerChanged || closureChanged;
  const gst = config.product_gst_rate;
  const anyBlocked = config.blocked.product_invoicing || config.blocked.order_closure;

  const unblocks = useMemo(() => {
    const out: string[] = [];
    if (triggerChanged) {
      if (trigger == null) out.push('Product invoicing becomes BLOCKED again (no invoice trigger).');
      else if (trigger === 'MILESTONE') out.push('Product invoicing stays blocked: MILESTONE is not modelled, so the server refuses to invoice under it.');
      else if (!gst) out.push(`Invoices would be raised on ${enumLabel(trigger)}, but product invoicing stays blocked until a product GST rate is configured.`);
      else out.push(`Unblocks product invoicing: Finance can issue product invoices on ${enumLabel(trigger)}.`);
    }
    if (closureChanged) {
      if (closure == null) out.push('Order closure becomes BLOCKED again (no payment-before-closure rule).');
      else out.push(closure
        ? 'Unblocks order closure: an order can close only once it is fully paid.'
        : 'Unblocks order closure: an order can close without full payment.');
    }
    return out;
  }, [trigger, closure, triggerChanged, closureChanged, gst]);

  function save() {
    const body: SalesPolicyBody = {
      ...(triggerChanged ? { invoice_trigger: trigger } : {}),
      ...(closureChanged ? { requires_full_payment_for_closure: closure } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    m.mutate(body, {
      onSuccess: () => {
        setConfirming(false);
        setNote('');
        toast({ tone: 'success', title: 'Sales policy saved', body: 'Saved as a CLIENT-UNCONFIRMED decision.' });
      },
    });
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-[16px]">
      {anyBlocked ? (
        <InlineAlert tone="blocked" title={blockedTitle(config)}>
          These values are CLIENT-UNCONFIRMED. Until they are set,
          {config.blocked.product_invoicing && config.blocked.order_closure
            ? " Finance can't issue product invoices and Purchase can't close any order."
            : config.blocked.product_invoicing ? " Finance can't issue product invoices." : " Purchase can't close any order."}
        </InlineAlert>
      ) : (
        <InlineAlert tone="neutral" icon={IconInfoCircle} title="Policy set — CLIENT-UNCONFIRMED">
          {`Saved ${formatDateTime(saved?.updated_at)} before client confirmation (11C-07, 11C-09). Change it here when the client confirms.`}
          {saved?.note ? ` Note: ${saved.note}` : ''}
        </InlineAlert>
      )}

      <div className="flex min-h-[390px] w-full items-stretch gap-[20px]">
        <PolicyCard
          title="Invoice trigger"
          badge={savedTrigger == null ? <Badge tone="blocked" label="BLOCKED" /> : <Badge tone={savedTrigger === 'MILESTONE' ? 'blocked' : 'success'} label={enumLabel(savedTrigger)} />}
        >
          <ChipGroup label="When is a product invoice raised?">
            {INVOICE_TRIGGERS.map((t) => (
              <PolicyChip
                key={t}
                label={enumLabel(t)}
                on={trigger === t}
                disabled={t === 'MILESTONE' && trigger !== 'MILESTONE'}
                onClick={() => setTrigger(trigger === t ? null : t)}
              />
            ))}
          </ChipGroup>
          <p className="w-full text-[12px] leading-[16px] text-fg-muted">MILESTONE is not supported for product sales.</p>
          <OpenQuestion>G12 · CLIENT-UNCONFIRMED — trigger not confirmed by the client.</OpenQuestion>
        </PolicyCard>

        <PolicyCard
          title="Payment before closure"
          badge={savedClosure == null ? <Badge tone="blocked" label="BLOCKED" /> : <Badge tone="success" label={savedClosure ? 'YES' : 'NO'} />}
        >
          <ChipGroup label="Require full payment to close an order?">
            <PolicyChip label="YES" on={closure === true} onClick={() => setClosure(closure === true ? null : true)} />
            <PolicyChip label="NO" on={closure === false} onClick={() => setClosure(closure === false ? null : false)} />
          </ChipGroup>
          <OpenQuestion>G15 · CLIENT-UNCONFIRMED — closure rule not confirmed by the client.</OpenQuestion>
        </PolicyCard>

        <PolicyCard
          title="Product GST rate"
          badge={gst ? <Badge tone="success" label={`${formatQty(gst.igst_rate)} %`} /> : <Badge tone="blocked" label="NOT SET" />}
        >
          <div className="flex w-full flex-col items-start gap-[6px]">
            <p className="w-full text-[14px] font-medium leading-[20px] text-fg">Product GST rate (read-only here)</p>
            <div className="flex h-[36px] w-full items-center gap-[8px] overflow-clip rounded-t-field border border-line bg-subtle px-[12px]">
              <Ic icon={IconLock} size={16} className="text-fg-2" />
              <p className="truncate whitespace-nowrap text-[14px] leading-[20px] text-fg">
                {gst
                  ? `${formatQty(gst.igst_rate)} % IGST · ${formatQty(gst.cgst_rate)} % CGST + ${formatQty(gst.sgst_rate)} % SGST · HSN/SAC ${gst.hsn_sac}`
                  : 'Not set'}
              </p>
            </div>
            <p className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">Set in company tax settings</p>
          </div>
          <OpenQuestion>G13 · CLIENT-UNCONFIRMED — rate source (company vs HSN vs item) not decided.</OpenQuestion>
        </PolicyCard>
      </div>

      <GlassCard strong radius="rounded-[24px]" className="flex w-full flex-col gap-[12px] p-[22px]">
        <h2 className="w-full text-[15px] font-semibold leading-[20px] text-fg">What is blocked right now</h2>
        {!anyBlocked ? (
          <BlockedRow ok title="Nothing blocked by policy" reason="Product invoicing and closure follow the saved policy" />
        ) : (
          <>
            {config.blocked.product_invoicing && (
              <BlockedRow title="Product invoicing" reason={invoicingReason(savedTrigger, !!gst)} />
            )}
            {config.blocked.order_closure && (
              <BlockedRow title="Order closure" reason="Needs payment-before-closure (yes / no)" />
            )}
          </>
        )}
      </GlassCard>

      <div className="flex w-full items-start justify-end">
        {dirty ? (
          <Button icon={<Ic icon={IconCheck} size={18} />} onClick={() => { m.reset(); setConfirming(true); }}>Save policy</Button>
        ) : (
          <div className="w-[560px] max-w-full">
            <GatedAction
              ready={false}
              reason={saved ? 'No changes to save' : 'Choose a value above to save — nothing is pre-filled'}
              readyNote=""
              primaryLabel="Save policy"
              onPrimary={() => {}}
            />
          </div>
        )}
      </div>

      <Drawer
        open={confirming}
        onClose={() => setConfirming(false)}
        busy={m.isPending}
        title="Save a CLIENT-UNCONFIRMED policy?"
        subtitle="The client hasn't confirmed these values (11C-07, 11C-09)."
        onSubmit={save}
        footer={(
          <>
            <Button kind="secondary" onClick={() => setConfirming(false)} disabled={m.isPending}>Cancel</Button>
            <Button type="submit" busy={m.isPending} icon={<Ic icon={IconCheck} size={18} />}>Save policy</Button>
          </>
        )}
      >
        <InlineAlert tone="blocked" title="This is a CLIENT-UNCONFIRMED decision">
          You are saving a value the client hasn't confirmed. It takes effect for every BR-11 order in this company straight away.
        </InlineAlert>
        <div className="flex w-full flex-col gap-[8px]">
          <p className="text-[14px] font-medium leading-[20px] text-fg">Changes</p>
          {triggerChanged && <ChangeLine label="Invoice trigger" from={savedTrigger ? enumLabel(savedTrigger) : 'Not set'} to={trigger ? enumLabel(trigger) : 'Not set (blocked)'} />}
          {closureChanged && <ChangeLine label="Full payment before closure" from={yn(savedClosure)} to={closure == null ? 'Not set (blocked)' : yn(closure)} />}
        </div>
        <div className="flex w-full flex-col gap-[8px]">
          <p className="text-[14px] font-medium leading-[20px] text-fg">What this does</p>
          <ul className="list-disc pl-[18px] text-[14px] leading-[20px] text-fg-2">
            {unblocks.map((u) => <li key={u}>{u}</li>)}
          </ul>
        </div>
        <TextAreaField
          label="Note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Who decided this and why (optional)"
          helper={`${note.length} / 500`}
        />
        <FormErrors error={m.error} title="The policy wasn't saved" />
      </Drawer>
    </div>
  );
}

const yn = (v: boolean | null) => (v == null ? 'Not set' : v ? 'YES' : 'NO');

function blockedTitle(c: SalesConfig) {
  if (c.blocked.product_invoicing && c.blocked.order_closure) return 'Policy not set — product invoicing and order closure are blocked';
  return c.blocked.product_invoicing ? 'Product invoicing is blocked' : 'Order closure is blocked';
}

function invoicingReason(trigger: Trigger | null, hasGst: boolean) {
  if (trigger === 'MILESTONE') return hasGst ? 'MILESTONE is not modelled — choose ADVANCE, DISPATCH or DELIVERY' : 'MILESTONE is not modelled, and no product GST rate is set';
  if (trigger == null && !hasGst) return 'Needs invoice trigger + product GST rate';
  if (trigger == null) return 'Needs invoice trigger';
  return 'Needs product GST rate';
}

function PolicyCard({ title, badge, children }: { title: string; badge: ReactNode; children: ReactNode }) {
  return (
    <GlassCard strong radius="rounded-[24px]" className="flex min-w-px flex-1 flex-col items-start gap-[12px] p-[22px]">
      <div className="flex w-full items-center gap-[10px] overflow-clip">
        <h2 className="min-w-px flex-1 text-[15px] font-semibold leading-[20px] text-fg">{title}</h2>
        {badge}
      </div>
      {children}
    </GlassCard>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-start gap-[8px] overflow-clip">
      <p className="w-full text-[14px] font-medium leading-[20px] text-fg">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex w-full flex-wrap items-start gap-[8px]">{children}</div>
    </div>
  );
}

function BlockedRow({ title, reason, ok }: { title: string; reason: string; ok?: boolean }) {
  return (
    <div className="flex w-full items-center gap-[10px] overflow-clip rounded-[14px] bg-subtle px-[16px] py-[12px]">
      <Ic icon={ok ? IconCheck : IconX} size={18} className={ok ? 'text-fg' : 'text-danger'} />
      <div className="flex min-w-px flex-1 flex-col gap-[2px] overflow-clip">
        <p className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{title}</p>
        <p className="text-[12px] leading-[16px] text-fg-2">{reason}</p>
      </div>
      <Badge tone={ok ? 'success' : 'blocked'} label={ok ? 'OK' : 'BLOCKED'} />
    </div>
  );
}

function ChangeLine({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="flex w-full items-center gap-[10px] rounded-[14px] bg-subtle px-[16px] py-[12px] text-[14px] leading-[20px]">
      <span className="min-w-px flex-1 text-fg-2">{label}</span>
      <span className="text-fg-2">{from}</span>
      <span className="text-fg-muted" aria-hidden>→</span>
      <span className="font-medium text-fg">{to}</span>
    </div>
  );
}

function PolicySkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex w-full flex-col gap-[16px]">
      <div className="h-[68px] w-full animate-pulse rounded-t-md bg-disabled" />
      <div className="flex min-h-[390px] w-full gap-[20px]">
        {[0, 1, 2].map((i) => (
          <GlassCard key={i} strong radius="rounded-[24px]" className="flex flex-1 flex-col gap-[12px] p-[22px]">
            <div className="h-[12px] w-[140px] animate-pulse rounded-[4px] bg-disabled" />
            <div className="h-[12px] w-[220px] animate-pulse rounded-[4px] bg-disabled" />
            <div className="h-[32px] w-[260px] animate-pulse rounded-[16px] bg-disabled" />
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
