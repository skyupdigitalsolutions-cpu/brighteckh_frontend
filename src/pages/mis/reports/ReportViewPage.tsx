// Report viewer (no Figma frame — kit build). Data: GET /mis/reports/:code (read-only transaction server-side; the
// entitlement is re-checked on every run), GET /mis/reports/:code/export (separate EXPORT grant), GET /mis/my-access
// (to mirror the export gate), GET /mis/companies (scope names).
// Honesty rules:
//   - summary values render exactly as returned; null renders "—" + "Not available" and the readiness list says why
//     (never a zero). Keys ending _paise are paise (formatPaise); *_rate are fractions shown as % (1 dp).
//   - kpi_status DRAFT / summary.kpi_status UNVERIFIED shown as badges, never hidden.
//   - customer fields are shown exactly as the server masked them; the PII chip reflects scope.pii_unmasked.
//   - rows: every column the API returns except bare UUID columns (*_id / id), which are not human-readable.
// Export gate: ACTIVE EXPORT grant for every company in scope → CSV / XLSX / PDF; INACTIVE → disabled with the reason
// (the role can clear it once approved); no grant / matrix denies → buttons not rendered, one-line note instead.
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconDownload, IconFileOff, IconLock, IconTableOff } from '@tabler/icons-react';
import { apiErrorText, apiStatus } from '../../../api/http';
import { useMe } from '../../../auth/AuthProvider';
import { enumLabel, formatDateTime, formatPaise, formatQty } from '../../../lib/format';
import {
  Button, DateField, EmptyState, ErrorState, FormErrors, Ic, InlineAlert, PageContent, PageHeader, Pagination, StateCard,
  cx, errorBody, paginate,
} from '../../../ui/desktop';
import {
  DATA_CLASS_LABEL, grantFor, misApi, useCatalogue, useCompanies, useMyAccess, useReport,
  type ExportFormat, type ReadinessItem, type ReportParams, type ReportResponse,
} from '../api';
import { KV, KpiBadge, MisCard, PiiChip, ReadinessBadge } from '../ui';
import { useMisBase } from '../base';

const PAGE_SIZE = 50;
type Period = { from: string; to: string };

export function ReportViewPage() {
  const { code = '' } = useParams();
  const me = useMe();
  const base = useMisBase();
  const cat = useCatalogue();
  const acc = useMyAccess();
  const cos = useCompanies();
  const entry = cat.data?.reports.find((r) => r.report_code === code);

  // Draft (inputs) vs applied (what the report ran with). Empty = server default (last 30 days to today, own company).
  const [draft, setDraft] = useState<ReportParams>({});
  const [applied, setApplied] = useState<ReportParams>({});
  const q = useReport(code, applied);

  // Companies the caller holds an ACTIVE VIEW grant on for this report (other companies need GRANTED_COMPANIES scope).
  const viewable = useMemo(() => {
    const ids = new Set((acc.data?.grants ?? []).filter((g) => g.report_code === code && g.action === 'VIEW' && g.status === 'ACTIVE')
      .map((g) => g.target_company_id));
    return (cos.data ?? []).filter((c) => ids.has(c.id));
  }, [acc.data, cos.data, code]);
  const scopeIds = q.data?.scope.company_ids ?? [me.company_id];
  const companyCode = (id: string) => cos.data?.find((c) => c.id === id)?.entity_code ?? id.slice(0, 8);

  const title = q.data?.title ?? entry?.title ?? code;
  const meta = [code, entry && DATA_CLASS_LABEL[entry.data_class], q.data && `as of ${formatDateTime(q.data.as_of)}`].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader title={title} meta={meta} />
      <PageContent>
        <MisCard>
          <div className="flex w-full flex-wrap items-end gap-[14px]">
            <DateField label="From" value={draft.from ?? ''} max={draft.to} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value || undefined }))} className="w-[200px]" />
            <DateField label="To" value={draft.to ?? ''} min={draft.from} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value || undefined }))} className="w-[200px]" />
            {viewable.length > 1 && (
              <CompanyPicker
                options={viewable}
                value={draft.companies ?? [me.company_id]}
                onChange={(companies) => setDraft((d) => ({ ...d, companies }))}
              />
            )}
            <Button kind="secondary" onClick={() => setApplied(draft)} busy={q.isFetching && !q.isPending}>Run report</Button>
            <div className="min-w-px flex-1" />
            <ExportGate code={code} params={applied} scopeIds={scopeIds} />
          </div>
          <p className="text-[12px] leading-[16px] text-fg-2">
            Empty dates = the server default (the 30 days up to today). Reports are read-only; each run and export is recorded in the access audit.
          </p>
        </MisCard>

        {q.isPending ? <ReportSkeleton /> : q.isError ? <ReportError error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} base={base} /> : (
          <ReportBody r={q.data} companyCode={companyCode} />
        )}
      </PageContent>
    </>
  );
}

// ---------------------------------------------------------------- body
function ReportBody({ r, companyCode }: { r: ReportResponse; companyCode: (id: string) => string }) {
  const summary = r.summary as Record<string, unknown>;
  const scalars = Object.entries(summary).filter(([, v]) => v === null || typeof v !== 'object');
  const groups = Object.entries(summary).filter(([, v]) => v !== null && typeof v === 'object') as [string, unknown][];
  const formulas = Object.entries(r.formulas as Record<string, string>);
  const nullKeys = scalars.filter(([, v]) => v === null).map(([k]) => k);

  return (
    <>
      <MisCard
        title="Scope"
        right={<div className="flex items-center gap-[8px]"><KpiBadge status={r.kpi_status} /><PiiChip unmasked={r.scope.pii_unmasked} /></div>}
      >
        <div className="grid w-full grid-cols-2 gap-x-[32px] gap-y-[10px]">
          <KV label="Period" value={`${(r.period as Period).from} → ${(r.period as Period).to}`} mono />
          <KV label="Companies" value={r.scope.company_ids.map(companyCode).join(', ')} mono />
          <KV label="Row scope" value={enumLabel(r.scope.row_scope)} />
          <KV label="Via role binding" value={r.scope.via_roles.join(', ') || '—'} mono />
        </div>
        {r.kpi_status === 'DRAFT' && (
          <p className="text-[12px] leading-[16px] text-fg-2">KPI DRAFT: the definitions behind these numbers are not yet client-validated.</p>
        )}
      </MisCard>

      {(scalars.length > 0 || groups.length > 0) && (
        <MisCard title="Summary">
          {scalars.length > 0 && (
            <div className="grid w-full grid-cols-4 gap-[12px]">
              {scalars.map(([k, v]) => <Metric key={k} name={k} value={v} />)}
            </div>
          )}
          {nullKeys.length > 0 && (
            <p className="text-[12px] leading-[16px] text-fg-2">“Not available” = the API returned no value; the readiness list below says why. It is never shown as 0.</p>
          )}
          {groups.length > 0 && (
            <div className="grid w-full grid-cols-3 gap-[12px]">
              {groups.map(([k, v]) => <Breakdown key={k} name={k} value={v} />)}
            </div>
          )}
        </MisCard>
      )}

      {r.readiness.length > 0 && (
        <MisCard title="Readiness">
          {r.readiness.map((x: ReadinessItem) => (
            <div key={x.item} className="flex w-full items-start gap-[12px] border-b border-line pb-[10px] last:border-0 last:pb-0">
              <div className="w-[220px] shrink-0"><ReadinessBadge status={x.status} /></div>
              <div className="min-w-px flex-1 text-[14px] leading-[20px]">
                <p className="font-medium text-fg">{x.item}</p>
                <p className="text-fg-2">{x.note}</p>
              </div>
            </div>
          ))}
        </MisCard>
      )}

      {formulas.length > 0 && (
        <MisCard title="Formulas">
          {formulas.map(([k, f]) => <KV key={k} label={<span className="font-mono text-[13px]">{k}</span>} value={<span className="font-normal text-fg-2">{f}</span>} />)}
        </MisCard>
      )}

      <RowsTable rows={r.rows as Record<string, unknown>[]} />
    </>
  );
}

const human = (k: string) => k.replace(/_paise$/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function fmt(key: string, v: unknown): ReactNode {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (key.endsWith('_paise')) return formatPaise(v as string);
  if (key.endsWith('_rate') && Number.isFinite(Number(v))) return `${(Number(v) * 100).toFixed(1)} %`;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDateTime(v);
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return formatQty(v); // API decimal string: grouped, trailing zeros trimmed
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return String(v);
}

function Metric({ name, value }: { name: string; value: unknown }) {
  const shown = fmt(name, value);
  return (
    <div className="flex min-w-0 flex-col gap-[4px] rounded-[16px] border border-line bg-surface px-[16px] py-[14px]">
      <p className="truncate text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{human(name)}</p>
      {shown === null
        ? <p className="text-[14px] font-medium leading-[20px] text-fg-muted">— Not available</p>
        : <p className="truncate font-mono text-[20px] font-semibold leading-[28px] text-fg">{shown}</p>}
    </div>
  );
}

function Breakdown({ name, value }: { name: string; value: unknown }) {
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i + 1), v] as const) : Object.entries(value as Record<string, unknown>);
  return (
    <div className="flex min-w-0 flex-col gap-[6px] rounded-[16px] border border-line bg-surface px-[16px] py-[14px]">
      <p className="text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2">{human(name)}</p>
      {entries.length === 0 ? <p className="text-[14px] leading-[20px] text-fg-muted">None in this period</p> : entries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-[8px] text-[14px] leading-[20px]">
          <span className="min-w-px flex-1 truncate text-fg-2">{enumLabel(k)}</span>
          <span className="shrink-0 font-mono text-fg">{typeof v === 'object' && v !== null ? JSON.stringify(v) : fmt(k, v) ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

function RowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  const [page, setPage] = useState(1);
  const cols = useMemo(() => {
    const keys: string[] = [];
    for (const r of rows.slice(0, 200)) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
    return keys.filter((k) => k !== 'id' && !k.endsWith('_id') && !k.endsWith('_ids'));
  }, [rows]);
  const { pages, page: current, rows: shown } = paginate(rows, page, PAGE_SIZE);

  return (
    <MisCard title="Rows" right={<span className="text-[14px] leading-[20px] text-fg-2">{rows.length.toLocaleString('en-IN')} rows</span>}>
      {rows.length === 0 ? (
        <div className="flex w-full justify-center"><EmptyState icon={IconTableOff} title="No rows for this period and scope" body="The summary above still reflects the run." /></div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                {cols.map((c, i) => (
                  <th key={c} className={cx('whitespace-nowrap bg-subtle px-[14px] py-[10px] text-[12px] font-semibold leading-[16px] tracking-[0.24px] text-fg-2',
                    i === 0 && 'rounded-l-[18px]', i === cols.length - 1 && 'rounded-r-[18px]')}>{human(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => {
                    const v = fmt(c, r[c]);
                    const numeric = typeof r[c] === 'number' || c.endsWith('_paise') || (typeof r[c] === 'string' && /^-?\d+(\.\d+)?$/.test(r[c] as string));
                    return (
                      <td key={c} className={cx('whitespace-nowrap border-b border-line px-[14px] py-[12px] text-[14px] leading-[20px]',
                        numeric ? 'text-right font-mono text-fg' : 'text-fg', v === null && 'text-fg-muted')}>
                        {v ?? '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && <Pagination page={current} pages={pages} onChange={setPage} />}
    </MisCard>
  );
}

// ---------------------------------------------------------------- export gate
function ExportGate({ code, params, scopeIds }: { code: string; params: ReportParams; scopeIds: string[] }) {
  const acc = useMyAccess();
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<unknown>(null);
  if (!acc.data) return null;
  const grants = scopeIds.map((id) => grantFor(acc.data, code, 'EXPORT', id));
  const allActive = grants.every((g) => g?.status === 'ACTIVE');
  const anyPending = grants.some((g) => g?.status === 'INACTIVE');

  if (!allActive && !anyPending) {
    return <p className="flex items-center gap-[6px] text-[12px] leading-[16px] text-fg-2"><Ic icon={IconLock} size={14} />Export needs a separate EXPORT grant</p>;
  }
  const run = async (f: ExportFormat) => {
    setBusy(f); setError(null);
    try {
      const { blob, filename } = await misApi.exportReport(code, params, f);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(await blobError(e));
    } finally { setBusy(null); }
  };
  return (
    <div className="flex flex-col items-end gap-[6px]">
      <div className="flex items-center gap-[8px]">
        {(['csv', 'xlsx', 'pdf'] as const).map((f) => (
          <Button key={f} kind="secondary" disabled={!allActive} busy={busy === f} icon={<Ic icon={IconDownload} size={18} />} onClick={() => run(f)}>
            {f.toUpperCase()}
          </Button>
        ))}
      </div>
      {!allActive && <p className="text-[12px] leading-[16px] text-st-blocked-fg">Your EXPORT grant is awaiting approval</p>}
      {allActive && <p className="text-[12px] leading-[16px] text-fg-2">Files mask customer PII unless you hold PII_CUSTOMER · EXPORT</p>}
      {error != null && <FormErrors error={error} title="Export refused" />}
    </div>
  );
}

/** Axios errors on a blob response carry the JSON error as a Blob: decode it so FormErrors can show the server reason. */
async function blobError(e: unknown) {
  const data = (e as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try { (e as { response: { data: unknown } }).response.data = JSON.parse(await data.text()); } catch { /* keep as-is */ }
  }
  return e;
}

// ---------------------------------------------------------------- states
function ReportError({ error, onRetry, retrying, base }: { error: unknown; onRetry: () => void; retrying: boolean; base: string }) {
  const status = apiStatus(error);
  if (status === 403) {
    return (
      <StateCard>
        <EmptyState icon={IconLock} title="You don't have access to this report" body={
          <>
            <span className="block">{apiErrorText(error)}</span>
            <span className="mt-[8px] block">Access is checked by the server on every run: an ACTIVE role binding, a role that permits this data class, and an ACTIVE VIEW grant for each company.</span>
            <Link className="mt-[8px] inline-block underline" to={`${base}/access`}>See my access</Link>
          </>
        } />
      </StateCard>
    );
  }
  if (status === 404 || status === 400) {
    return <StateCard><EmptyState icon={IconFileOff} title="This report can't be run" body={apiErrorText(error)} /></StateCard>;
  }
  return <StateCard><ErrorState title="Couldn't run the report" body={errorBody(error)} onRetry={onRetry} retrying={retrying} /></StateCard>;
}

function ReportSkeleton() {
  const bar = (w: number | string, h = 12) => <span className="block animate-pulse rounded-[6px] bg-disabled" style={{ width: w, height: h }} />;
  return (
    <div role="status" aria-label="Running report" className="flex w-full flex-col gap-[20px]">
      <MisCard>{bar(180, 18)}{bar('60%')}{bar('45%')}</MisCard>
      <MisCard>
        {bar(120, 18)}
        <div className="grid w-full grid-cols-4 gap-[12px]">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-[16px] bg-disabled" />)}</div>
      </MisCard>
      <InlineAlert tone="progress" title="Running report">Read-only query against live data. Larger periods take longer.</InlineAlert>
    </div>
  );
}

function CompanyPicker({ options, value, onChange }: { options: { id: string; entity_code: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div role="group" aria-label="Companies" className="flex flex-col gap-[6px]">
      <span className="text-[14px] font-medium leading-[20px] text-fg">Companies</span>
      <div className="flex h-[44px] items-center gap-[8px]">
        {options.map((c) => {
          const on = value.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              title={c.name}
              onClick={() => onChange(on ? (value.length > 1 ? value.filter((x) => x !== c.id) : value) : [...value, c.id])}
              className={cx('rounded-t-chip border px-[16px] py-[10px] font-mono text-[11px] font-semibold leading-[14px] tracking-[0.44px]',
                on ? 'border-brand-border bg-brand-subtle text-fg' : 'border-line bg-subtle text-fg-2')}
            >
              {c.entity_code}
            </button>
          );
        })}
      </div>
    </div>
  );
}
