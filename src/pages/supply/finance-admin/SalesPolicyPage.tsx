// AS0 · Sales policy (/a/sales-policy, SYSTEM_ADMIN) — Figma configured state 247:55530 (UNSET 247:55208 superseded).
// Header "Sales policy" + meta "BR-11 company policy · BLR". Content gap 16:
//   top Inline alert: success "Live policy for BLR" + "Invoice on DISPATCH · payment before closure not required ·
//     product GST 18 %. Edit these in Settings › Policies and Company & tax." (blocked alert when something is unset);
//   three cards in a row (gap 20; glass-strong, radius 24, p-22, gap 12; head 15/20 SemiBold + status badge):
//     Invoice trigger: chips ADVANCE · DISPATCH · DELIVERY · MILESTONE (read-only, the live value selected) +
//       "MILESTONE is not supported for product sales." + info note "Invoice trigger: DISPATCH — set in Admin › Settings ›
//       Policies.";
//     Payment before closure: chips YES · NO + info note;
//     Product GST rate: locked field + "Set in company tax settings" + info note (HSN from each item);
//   "What is blocked right now" card (rows bg-subtle r14 px-16 py-12: icon, title + reason, OK / BLOCKED badge);
//   "Edit in Settings" secondary button bottom-right → /a/settings/policies.
//
// Data: GET /sales-config (policy, product_gst_rate, blocked). This page is now read-only: the values are edited in
// Admin › Settings (Policies / Company & tax). G12 / G13 / G15 are answered (configured), so the open-question notes and
// the CLIENT-UNCONFIRMED save flow are gone.
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCheck, IconInfoCircle, IconLock, IconX } from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthProvider';
import { enumLabel, formatQty } from '../../../lib/format';
import { Badge, Button, ErrorState, GlassCard, Ic, InlineAlert, PageHeader, StateCard, errorBody } from '../../../ui/desktop';
import { INVOICE_TRIGGERS, useSalesConfig, type SalesConfig } from '../api';
import { PolicyChip } from './local';

export function SalesPolicyPage() {
  const { companyCode } = useAuth();
  const q = useSalesConfig();
  return (
    <>
      <PageHeader title="Sales policy" meta={`BR-11 company policy · ${companyCode ?? '…'}`} />
      {q.isPending ? <PolicySkeleton /> : q.isError ? (
        <StateCard>
          <ErrorState title="Couldn't load the sales policy" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} />
        </StateCard>
      ) : <PolicyView config={q.data} code={companyCode ?? ''} />}
    </>
  );
}

function PolicyView({ config, code }: { config: SalesConfig; code: string }) {
  const nav = useNavigate();
  const p = config.policy;
  const trigger = p?.invoice_trigger ?? null;
  const closure = p?.requires_full_payment_for_closure ?? null;
  const gst = config.product_gst_rate;
  const rate = gst ? `${formatQty(gst.igst_rate)} %` : null;
  const anyBlocked = config.blocked.product_invoicing || config.blocked.order_closure;
  const closureText = closure == null ? 'not set' : closure ? 'REQUIRED' : 'NOT REQUIRED';

  return (
    <div className="flex w-full min-w-0 flex-col gap-[16px]">
      {anyBlocked ? (
        <InlineAlert tone="blocked" title={`Policy incomplete for ${code}`}>
          {[!trigger || trigger === 'MILESTONE' ? 'Invoice trigger not usable' : null, closure == null ? 'payment-before-closure not set' : null,
            !gst ? 'product GST rate not set' : null].filter(Boolean).join(' · ')}
          . Set these in Settings › Policies and Company & tax.
        </InlineAlert>
      ) : (
        <InlineAlert tone="success" title={`Live policy for ${code}`}>
          {`Invoice on ${trigger} · payment before closure ${closure ? 'required' : 'not required'} · product GST ${rate}. Edit these in Settings › Policies and Company & tax.`}
        </InlineAlert>
      )}

      <div className="flex min-h-[390px] w-full items-stretch gap-[20px]">
        <PolicyCard title="Invoice trigger" badge={<ValueBadge ok={!!trigger && trigger !== 'MILESTONE'} label={trigger ? enumLabel(trigger) : 'NOT SET'} />}>
          <ChipGroup label="When is a product invoice raised?">
            {INVOICE_TRIGGERS.map((t) => (
              <PolicyChip key={t} label={enumLabel(t)} on={trigger === t} disabled={t === 'MILESTONE' && trigger !== 'MILESTONE'} onClick={() => {}} />
            ))}
          </ChipGroup>
          <p className="w-full text-[12px] leading-[16px] text-fg-muted">MILESTONE is not supported for product sales.</p>
          <Info>{`Invoice trigger: ${trigger ? enumLabel(trigger) : 'not set'} — set in Admin › Settings › Policies.`}</Info>
        </PolicyCard>

        <PolicyCard title="Payment before closure" badge={<ValueBadge ok={closure != null} label={closure == null ? 'NOT SET' : closure ? 'YES' : 'NO'} />}>
          <ChipGroup label="Require full payment to close an order?">
            <PolicyChip label="YES" on={closure === true} onClick={() => {}} />
            <PolicyChip label="NO" on={closure === false} onClick={() => {}} />
          </ChipGroup>
          <Info>{`Payment before closure: ${closureText} — Admin › Settings › Policies.`}</Info>
        </PolicyCard>

        <PolicyCard title="Product GST rate" badge={<ValueBadge ok={!!gst} label={rate ?? 'NOT SET'} />}>
          <div className="flex w-full flex-col items-start gap-[6px]">
            <p className="w-full text-[14px] font-medium leading-[20px] text-fg">Product GST rate (read-only here)</p>
            <div className="flex h-[36px] w-full items-center gap-[8px] overflow-clip rounded-t-field border border-line bg-subtle px-[12px]">
              <Ic icon={IconLock} size={16} className="text-fg-2" />
              <p className="truncate whitespace-nowrap text-[14px] leading-[20px] text-fg">
                {gst ? `${rate} · CGST ${formatQty(gst.cgst_rate)} % + SGST ${formatQty(gst.sgst_rate)} %` : 'Not set'}
              </p>
            </div>
            <p className="whitespace-nowrap text-[12px] leading-[16px] text-fg-2">Set in company tax settings</p>
          </div>
          <Info>{`Product GST ${rate ?? 'not set'} (Admin › Settings › Company & tax). HSN comes from each item (Stock › Items).`}</Info>
        </PolicyCard>
      </div>

      <GlassCard strong radius="rounded-[24px]" className="flex w-full flex-col gap-[12px] p-[22px]">
        <h2 className="w-full text-[15px] font-semibold leading-[20px] text-fg">What is blocked right now</h2>
        {!anyBlocked ? (
          <BlockedRow ok title="Nothing blocked by policy" reason="Product invoicing and closure follow the live policy" />
        ) : (
          <>
            {config.blocked.product_invoicing && <BlockedRow title="Product invoicing" reason={invoicingReason(trigger, !!gst)} />}
            {config.blocked.order_closure && <BlockedRow title="Order closure" reason="Needs payment-before-closure (yes / no)" />}
          </>
        )}
      </GlassCard>

      <div className="flex w-full items-start justify-end">
        <Button kind="secondary" onClick={() => nav('/a/settings/policies')}>Edit in Settings</Button>
      </div>
    </div>
  );
}

function invoicingReason(trigger: string | null, hasGst: boolean) {
  if (trigger === 'MILESTONE') return hasGst ? 'MILESTONE is not modelled — choose ADVANCE, DISPATCH or DELIVERY' : 'MILESTONE is not modelled, and no product GST rate is set';
  if (trigger == null && !hasGst) return 'Needs invoice trigger + product GST rate';
  if (trigger == null) return 'Needs invoice trigger';
  return 'Needs product GST rate';
}

const ValueBadge = ({ ok, label }: { ok: boolean; label: string }) => <Badge tone={ok ? 'success' : 'blocked'} label={label} />;

function Info({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-[8px] overflow-clip rounded-[12px] bg-subtle px-[12px] py-[10px]">
      <Ic icon={IconInfoCircle} size={16} className="shrink-0 text-fg-2" />
      <p className="min-w-px flex-1 text-[12px] leading-[16px] text-fg-2">{children}</p>
    </div>
  );
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
      <div role="radiogroup" aria-label={label} aria-readonly className="pointer-events-none flex w-full flex-wrap items-start gap-[8px]">{children}</div>
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
