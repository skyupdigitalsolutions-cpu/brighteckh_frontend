// Grant approvals queue (no Figma frame — kit build). Data: GET /mis/report-grants/pending-my-approval (only grants the
// caller can approve now, server-computed with the same rules as the approval trigger); write: POST
// /mis/report-grants/:id/approve { approval_kind }. Approving opens data access, so each approval is a two-step confirm.
// A grant turns ACTIVE only when every required approval exists; the row then leaves this list.
// Used by a configured FINANCIAL / CROSS_COMPANY authoriser (e.g. MANAGEMENT) at /mg/approvals and embedded on the
// SYSTEM_ADMIN Grants page for STANDARD approvals.
import { useState } from 'react';
import { IconChecks, IconShieldCheck } from '@tabler/icons-react';
import { formatDateTime } from '../../../lib/format';
import {
  Badge, Button, EmptyState, ErrorState, FormErrors, Ic, PageContent, PageHeader, SkeletonRows, StateCard, errorBody, useToast,
} from '../../../ui/desktop';
import { DATA_CLASS_LABEL, useApproveGrant, usePendingMyApproval, type ApprovalKind, type PendingApproval } from '../api';
import { MisCard } from '../ui';

export function ApprovalsPage() {
  return (
    <>
      <PageHeader title="Approvals" meta="Report grants waiting for an approval only you can give · each one opens data access" />
      <PageContent><PendingApprovals /></PageContent>
    </>
  );
}

/** The queue itself (also embedded on the admin Grants page). */
export function PendingApprovals({ compact }: { compact?: boolean }) {
  const q = usePendingMyApproval();
  if (q.isPending) return <MisCard title="Waiting for your approval"><SkeletonRows rows={3} widths={[260, 120, 160]} /></MisCard>;
  if (q.isError) return <StateCard><ErrorState title="Couldn't load approvals" body={errorBody(q.error)} onRetry={() => q.refetch()} retrying={q.isFetching} /></StateCard>;
  if (q.data.length === 0) {
    if (compact) return null;
    return (
      <StateCard>
        <EmptyState icon={IconChecks} title="Nothing waiting for you" body="Grants appear here when they need an approval your role is configured to give." />
      </StateCard>
    );
  }
  return (
    <MisCard title="Waiting for your approval" right={<span className="text-[14px] leading-[20px] text-fg-2">{q.data.length}</span>}>
      {q.data.map((g) => <ApprovalRow key={g.id} g={g} />)}
    </MisCard>
  );
}

function ApprovalRow({ g }: { g: PendingApproval }) {
  const approve = useApproveGrant();
  const toast = useToast();
  const [confirm, setConfirm] = useState<ApprovalKind | null>(null);
  const done = (g.approvals ?? []).map((a) => a.approval_kind);

  const go = (kind: ApprovalKind) => approve.mutate({ id: g.id, kind }, {
    onSuccess: (r) => {
      setConfirm(null);
      toast({
        tone: 'success',
        title: `${kind} approval recorded`,
        body: r.status === 'ACTIVE' ? `${g.employee_name} now has ${g.action} on ${g.report_code} (${g.target_company_code}).` : 'The grant still needs another approval before it is active.',
      });
    },
  });

  return (
    <div className="flex w-full flex-col gap-[10px] border-b border-line pb-[14px] last:border-0 last:pb-0">
      <div className="flex w-full items-start gap-[12px]">
        <div className="flex min-w-px flex-1 flex-col gap-[2px]">
          <p className="text-[14px] font-medium leading-[20px] text-fg">
            {g.employee_name} <span className="font-mono text-[12px] font-normal text-fg-2">{g.employee_code}</span>
          </p>
          <p className="text-[14px] leading-[20px] text-fg-2">
            <span className="font-mono text-[13px] text-fg">{g.action}</span> on <span className="font-mono text-[13px] text-fg">{g.report_code}</span>
            {' · '}{DATA_CLASS_LABEL[g.data_class as keyof typeof DATA_CLASS_LABEL] ?? g.data_class} · data owner <span className="font-mono text-[13px] text-fg">{g.target_company_code}</span>
          </p>
          <p className="text-[12px] leading-[16px] text-fg-2">
            Requested {formatDateTime(g.created_at)} · needs {g.required_approvals.join(' + ')}{done.length ? ` · recorded: ${done.join(', ')}` : ''}
            {g.note ? ` · “${g.note}”` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-[8px]">
          {g.can_approve_kinds.map((k) => (
            confirm === k ? null : <Button key={k} icon={<Ic icon={IconShieldCheck} size={18} />} onClick={() => setConfirm(k as ApprovalKind)}>Approve {k}</Button>
          ))}
        </div>
      </div>
      {confirm && (
        <div className="flex w-full items-center gap-[12px] rounded-t-md border border-st-progress-bd bg-st-progress-bg px-[16px] py-[12px] text-st-progress-fg">
          <Badge tone="progress" label={confirm} />
          <p className="min-w-px flex-1 text-[14px] leading-[20px]">
            Approve {g.employee_name}&rsquo;s {g.action} access to {g.report_code} ({g.target_company_code})? This is recorded under your name and can&rsquo;t be undone (only revoked).
          </p>
          <Button kind="secondary" onClick={() => setConfirm(null)} disabled={approve.isPending}>Cancel</Button>
          <Button busy={approve.isPending} onClick={() => go(confirm)}>Confirm approval</Button>
        </div>
      )}
      <FormErrors error={approve.error} title="The approval was refused" />
    </div>
  );
}
