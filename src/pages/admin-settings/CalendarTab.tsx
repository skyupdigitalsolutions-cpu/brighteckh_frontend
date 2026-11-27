// AST3 · Calendar — BLR 295:61778 · CHN 295:62183 · holidays not configured 295:62579 · saved 295:62939 ·
// validation error 295:63350 · loading 295:63764 · error 295:64159 · Add holiday drawer 295:64436.
// Three cards: Working hours · Holidays · SLA targets.
//
// Data: calendar (per company, migration 012: day_rules are authoritative), GLOBAL test-start SLA (br07_test_sla_targets),
// company_config quote_followup_days + rma_turnaround_target_working_days.
// Save changes = PUT …/working-hours (when hours changed) + PUT …/policies {company} (RMA / follow-up) +
// PUT /admin/settings/test-sla-targets per changed priority. Holidays are added / removed straight away (drawer / ×).
// Deviations:
// - Repair test-start SLA is per job priority in the API (NORMAL · URGENT · CRITICAL, hours or working days, GLOBAL for
//   every company) — the frame draws one "hours" box; three rows are shown.
// - Hours are grouped as drawn (Mon–Fri · Saturday · Sunday · one lunch break for all open days). If the stored weekday
//   hours differ, Mon–Fri shows Monday's and saving applies them to all five (a note says so).
// - Only future holidays can be removed (DB rule): past rows have no ×.
import { useMemo, useState } from 'react';
import { IconCalendarOff, IconClock, IconPlus, IconX } from '@tabler/icons-react';
import { formatDate } from '../../lib/format';
import {
  Badge, Button, DateField, Drawer, EmptyState, FormErrors, Ic, TextInput, cx, useToast,
} from '../../ui/desktop';
import { settingsApi, useSettingsSave, type CompanySettings, type DayRule, type WorkingDay } from './api';
import { FixAlert, NumBox, Note, SCard, SChip, SavedAlert, SettingsToolbar } from './local';
import { useSettingsCtx } from './SettingsLayout';
import { TabFrame } from './TabFrame';

export function CalendarTab() {
  const [justSaved, setJustSaved] = useState<string | null>(null);
  return (
    <TabFrame tab="CALENDAR" titles={['Working hours', 'Holidays', 'SLA targets']} errorTitle="Couldn't load the calendar">
      {(d) => (
        <CalendarForm
          key={`${d.company.id}|${d.last_saved.CALENDAR?.at ?? ''}|${d.company_config.policy?.updated_at ?? ''}|${slaKey(d)}`}
          data={d}
          justSaved={justSaved === d.company.id}
          onSaved={() => setJustSaved(d.company.id)}
        />
      )}
    </TabFrame>
  );
}

const slaKey = (d: CompanySettings) => d.test_sla_targets.map((t) => `${t.target_amount}${t.target_unit}`).join(',');
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
type Span = { open: boolean; start: string; end: string };
type Unit = 'WORKING_HOUR' | 'WORKING_DAY';
type Priority = 'NORMAL' | 'URGENT' | 'CRITICAL';

function initial(d: CompanySettings) {
  const rules = d.calendar?.day_rules ?? [];
  const by = (dow: number) => rules.find((r) => r.iso_dow === dow);
  const span = (r?: DayRule): Span => (r ? { open: true, start: hhmm(r.start_local), end: hhmm(r.end_local) } : { open: false, start: '', end: '' });
  const wk = [1, 2, 3, 4, 5].map(by);
  const firstWk = wk.find(Boolean);
  const brk = rules.find((r) => r.break_start_local);
  const sla = Object.fromEntries(d.test_sla_targets.map((t) => [t.priority, { amount: String(t.target_amount), unit: t.target_unit as Unit }])) as Record<Priority, { amount: string; unit: Unit }>;
  return {
    weekdays: span(firstWk),
    weekdaysMixed: wk.some((r) => !r !== !firstWk || (r && firstWk && (r.start_local !== firstWk.start_local || r.end_local !== firstWk.end_local))),
    saturday: span(by(6)),
    sunday: span(by(7)),
    lunchStart: hhmm(brk?.break_start_local),
    lunchEnd: hhmm(brk?.break_end_local),
    rma: d.company_config.policy?.rma_turnaround_target_working_days != null ? String(d.company_config.policy.rma_turnaround_target_working_days) : '',
    followup: d.company_config.policy?.quote_followup_days != null ? String(d.company_config.policy.quote_followup_days) : '',
    sla,
  };
}
type Form = ReturnType<typeof initial>;

function validate(f: Form) {
  const e: string[] = [];
  const spans: [string, Span][] = [['Monday – Friday', f.weekdays], ['Saturday', f.saturday], ['Sunday', f.sunday]];
  for (const [n, s] of spans) {
    if (!s.open) continue;
    if (!TIME.test(s.start) || !TIME.test(s.end)) e.push(`${n}: enter times as HH:MM.`);
    else if (s.start >= s.end) e.push(`${n}: closing time must be after opening time.`);
  }
  if (!spans.some(([, s]) => s.open)) e.push('At least one day must be open.');
  if (f.lunchStart || f.lunchEnd) {
    if (!TIME.test(f.lunchStart) || !TIME.test(f.lunchEnd)) e.push('Lunch break: enter both times as HH:MM, or clear both.');
    else if (f.lunchStart >= f.lunchEnd) e.push('Lunch break: end must be after start.');
    else for (const [n, s] of spans) {
      if (s.open && TIME.test(s.start) && TIME.test(s.end) && (f.lunchStart < s.start || f.lunchEnd > s.end)) e.push(`Lunch break must fall inside ${n} hours.`);
    }
  }
  if (f.rma && !/^[1-9][0-9]*$/.test(f.rma)) e.push('RMA turnaround: enter whole days (1 or more).');
  if (f.followup && !/^[1-9][0-9]*$/.test(f.followup)) e.push('Quote follow-up: enter whole days (1 or more).');
  for (const [p, v] of Object.entries(f.sla)) {
    if (!/^[1-9][0-9]*$/.test(v.amount) || Number(v.amount) > 1000) e.push(`Test-start SLA (${p.toLowerCase()}): enter 1 to 1000.`);
  }
  return e;
}

function CalendarForm({ data, justSaved, onSaved }: { data: CompanySettings; justSaved: boolean; onSaved: () => void }) {
  const { companies, setCompanyId } = useSettingsCtx();
  const start = useMemo(() => initial(data), [data]);
  const [f, setF] = useState(start);
  const [tried, setTried] = useState(false);
  const [adding, setAdding] = useState(false);
  const code = data.company.entity_code;

  const hoursChanged = JSON.stringify([f.weekdays, f.saturday, f.sunday, f.lunchStart, f.lunchEnd])
    !== JSON.stringify([start.weekdays, start.saturday, start.sunday, start.lunchStart, start.lunchEnd]);
  const policyChanged = f.rma !== start.rma || f.followup !== start.followup;
  const slaChanged = (Object.keys(f.sla) as Priority[]).filter((p) => f.sla[p].amount !== start.sla[p]?.amount || f.sla[p].unit !== start.sla[p]?.unit);
  const dirty = hoursChanged || policyChanged || slaChanged.length > 0;
  const errors = validate(f);
  const visible = tried || dirty ? errors : [];

  const m = useSettingsSave(async () => {
    if (hoursChanged) {
      const brk = f.lunchStart && f.lunchEnd ? { break_start_local: f.lunchStart, break_end_local: f.lunchEnd } : { break_start_local: null, break_end_local: null };
      const days: WorkingDay[] = [];
      const add = (dow: number, s: Span) => { if (s.open) days.push({ iso_dow: dow, start_local: s.start, end_local: s.end, ...brk }); };
      [1, 2, 3, 4, 5].forEach((d) => add(d, f.weekdays));
      add(6, f.saturday);
      add(7, f.sunday);
      await settingsApi.workingHours(data.company.id, { days });
    }
    if (policyChanged) {
      await settingsApi.policies(data.company.id, {
        company: {
          ...(f.rma !== start.rma ? { rma_turnaround_target_working_days: f.rma ? Number(f.rma) : null } : {}),
          ...(f.followup !== start.followup ? { quote_followup_days: f.followup ? Number(f.followup) : null } : {}),
        },
      });
    }
    for (const p of slaChanged) await settingsApi.testSla({ priority: p, target_amount: Number(f.sla[p].amount), target_unit: f.sla[p].unit });
  });

  function save() {
    setTried(true);
    if (errors.length) return;
    m.mutate(undefined, { onSuccess: onSaved });
  }

  const setSpan = (k: 'weekdays' | 'saturday' | 'sunday', s: Partial<Span>) => setF((x) => ({ ...x, [k]: { ...x[k], ...s } }));

  return (
    <>
      <SettingsToolbar
        companies={companies}
        companyId={data.company.id}
        onCompany={setCompanyId}
        saved={data.last_saved.CALENDAR}
        savedJustNow={justSaved}
        dirty={dirty}
        canSave={dirty && visible.length === 0}
        busy={m.isPending}
        onDiscard={() => { setF(start); setTried(false); m.reset(); }}
        onSave={save}
      />
      <FixAlert errors={visible} />
      <FormErrors error={m.error} title="Calendar wasn't saved" />
      {justSaved && !dirty && !m.error && (
        <SavedAlert title={`Calendar saved · ${code}`}>New due times use these hours from now. Due times already set are unchanged.</SavedAlert>
      )}
      {!data.calendar ? (
        <SCard title="Working hours" className="min-h-[300px]">
          <EmptyState icon={IconCalendarOff} title="No working calendar for this company" body="This company has no active working calendar, so hours and holidays can't be set here." />
        </SCard>
      ) : (
        <div className="flex min-h-[674px] w-full items-stretch gap-[16px]">
          <SCard title="Working hours" right={<Ic icon={IconClock} size={18} className="text-fg-2" />} className="max-w-[450px]">
            <HoursRow label="Monday – Friday" span={f.weekdays} onChange={(s) => setSpan('weekdays', s)} />
            <HoursRow label="Saturday" span={f.saturday} onChange={(s) => setSpan('saturday', s)} />
            <HoursRow label="Sunday" span={f.sunday} onChange={(s) => setSpan('sunday', s)} />
            <div className="flex w-full items-center gap-[8px] border-b border-line pb-[12px]">
              <p className="min-w-px flex-1 text-[14px] font-medium leading-[20px] text-fg">Lunch break (all days)</p>
              <TimeBox label="Lunch start" value={f.lunchStart} onChange={(v) => setF((x) => ({ ...x, lunchStart: v }))} />
              <span className="text-[12px] text-fg-muted">to</span>
              <TimeBox label="Lunch end" value={f.lunchEnd} onChange={(v) => setF((x) => ({ ...x, lunchEnd: v }))} />
            </div>
            {start.weekdaysMixed && <Note>Stored weekday hours differ by day — Monday's are shown; saving applies them to Monday – Friday.</Note>}
            <Note>{`Working hours drive SLA clocks and test due times for ${code}.`}</Note>
          </SCard>

          <HolidaysCard data={data} onAdd={() => setAdding(true)} />

          <SCard title="SLA targets" className="max-w-[400px]">
            <div className="flex w-full flex-col gap-[8px] border-b border-line pb-[12px]">
              <p className="text-[14px] font-medium leading-[20px] text-fg">Repair test-start SLA</p>
              <p className="text-[12px] leading-[16px] text-fg-2">Time from repair report to first test cycle · per job priority · all companies</p>
              {(['NORMAL', 'URGENT', 'CRITICAL'] as Priority[]).map((p) => f.sla[p] && (
                <div key={p} className="flex w-full items-center gap-[8px]">
                  <span className="min-w-px flex-1 text-[12px] font-semibold leading-[16px] tracking-[0.44px] text-fg-2">{p}</span>
                  <NumBox label={`Test-start SLA ${p}`} value={f.sla[p].amount} unit="" width={36}
                    onChange={(v) => setF((x) => ({ ...x, sla: { ...x.sla, [p]: { ...x.sla[p], amount: v } } }))} />
                  <SChip label="HOURS" on={f.sla[p].unit === 'WORKING_HOUR'} onClick={() => setF((x) => ({ ...x, sla: { ...x.sla, [p]: { ...x.sla[p], unit: 'WORKING_HOUR' } } }))} />
                  <SChip label="DAYS" on={f.sla[p].unit === 'WORKING_DAY'} onClick={() => setF((x) => ({ ...x, sla: { ...x.sla, [p]: { ...x.sla[p], unit: 'WORKING_DAY' } } }))} />
                </div>
              ))}
            </div>
            <SlaRow label="RMA turnaround" sub="Customer return received → resolved" unit="days" value={f.rma} onChange={(v) => setF((x) => ({ ...x, rma: v }))} unset={!start.rma} />
            <SlaRow label="Quote follow-up chase" sub="Sales reminder after a quote is sent" unit="days" value={f.followup} onChange={(v) => setF((x) => ({ ...x, followup: v }))} unset={!start.followup} />
            <Note>Unset SLAs show no due time on job screens until a value is saved. RMA turnaround and follow-up are recorded only — no workflow reads them yet.</Note>
          </SCard>
        </div>
      )}
      <AddHolidayDrawer open={adding} onClose={() => setAdding(false)} data={data} />
    </>
  );
}

function HoursRow({ label, span, onChange }: { label: string; span: Span; onChange: (s: Partial<Span>) => void }) {
  return (
    <div className="flex w-full items-center gap-[8px] border-b border-line pb-[12px]">
      <p className="min-w-px flex-1 text-[14px] font-medium leading-[20px] text-fg">{label}</p>
      {span.open ? (
        <>
          <TimeBox label={`${label} opens`} value={span.start} onChange={(v) => onChange({ start: v })} />
          <span className="text-[12px] text-fg-muted">to</span>
          <TimeBox label={`${label} closes`} value={span.end} onChange={(v) => onChange({ end: v })} />
          <button type="button" aria-label={`Close ${label}`} onClick={() => onChange({ open: false })} className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-fg-2 hover:bg-subtle">
            <Ic icon={IconX} size={16} />
          </button>
        </>
      ) : (
        <button type="button" aria-label={`Open ${label}`} title="Click to set opening hours" onClick={() => onChange({ open: true, start: span.start || '09:30', end: span.end || '18:30' })}>
          <Badge tone="neutral" label="CLOSED" />
        </button>
      )}
    </div>
  );
}

function TimeBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const bad = value !== '' && !TIME.test(value);
  return (
    <input
      aria-label={label}
      value={value}
      placeholder="--:--"
      maxLength={5}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'h-[36px] w-[57px] rounded-[12px] border border-line-strong bg-surface px-[10px] text-center font-mono text-[14px] leading-[20px] text-fg placeholder:text-fg-muted focus:outline-none focus:ring-inside-brand',
        bad && 'ring-inside-danger',
      )}
    />
  );
}

function SlaRow({ label, sub, unit, value, onChange, unset }: { label: string; sub: string; unit: string; value: string; onChange: (v: string) => void; unset: boolean }) {
  return (
    <div className="flex w-full flex-col gap-[6px] border-b border-line pb-[12px]">
      <div className="flex w-full items-center gap-[12px]">
        <p className="min-w-px flex-1 text-[14px] font-medium leading-[20px] text-fg">{label}</p>
        <NumBox label={label} value={value} onChange={onChange} unit={unit} placeholder="Not set" width={56} />
      </div>
      <p className="text-[12px] leading-[16px] text-fg-2">{sub}</p>
      {unset && <Badge tone="blocked" label="NOT YET CONFIGURED" className="self-start" />}
    </div>
  );
}

function HolidaysCard({ data, onAdd }: { data: CompanySettings; onAdd: () => void }) {
  const toast = useToast();
  const holidays = data.calendar?.holidays ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const m = useSettingsSave((id: string) => settingsApi.removeHoliday(data.company.id, id));
  return (
    <SCard
      title={`Holidays · ${data.company.entity_code}`}
      right={<Button kind="secondary" icon={<Ic icon={IconPlus} size={18} />} onClick={onAdd}>Add holiday</Button>}
    >
      <FormErrors error={m.error} title="The holiday wasn't removed" />
      {holidays.length === 0 ? (
        <EmptyState icon={IconCalendarOff} title="No holidays configured" body={`Only Sundays and closed days are skipped for ${data.company.entity_code} until holidays are added.`} />
      ) : (
        <div role="table" className="flex w-full flex-col">
          <div role="row" className="flex w-full items-center gap-[10px] rounded-[14px] bg-subtle px-[10px] py-[8px] text-[12px] font-medium leading-[16px] text-fg-2">
            <span role="columnheader" className="w-[130px] shrink-0">Date</span>
            <span role="columnheader" className="min-w-px flex-1">Holiday</span>
            <span className="w-[28px] shrink-0" />
          </div>
          {holidays.map((h) => {
            const date = String(h.holiday_date).slice(0, 10);
            const future = date > today;
            return (
              <div role="row" key={h.id} className="flex w-full items-center gap-[10px] border-b border-line px-[10px] py-[10px]">
                <span role="cell" className="w-[130px] shrink-0 font-mono text-[14px] leading-[20px] text-fg">{formatDate(date)}</span>
                <span role="cell" className="min-w-px flex-1 truncate text-[14px] leading-[20px] text-fg">{h.description}</span>
                <span className="flex w-[28px] shrink-0 justify-center">
                  {future && (
                    <button
                      type="button"
                      aria-label={`Remove ${h.description}`}
                      disabled={m.isPending}
                      onClick={() => m.mutate(h.id, { onSuccess: () => toast({ tone: 'success', title: `Removed ${h.description}` }) })}
                      className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-fg-2 hover:bg-subtle"
                    >
                      <Ic icon={IconX} size={16} />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </SCard>
  );
}

function AddHolidayDrawer({ open, onClose, data }: { open: boolean; onClose: () => void; data: CompanySettings }) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const m = useSettingsSave(() => settingsApi.addHoliday(data.company.id, { holiday_date: date, description: name.trim() }));
  const ready = /^\d{4}-\d{2}-\d{2}$/.test(date) && name.trim().length > 0;
  const close = () => { setDate(''); setName(''); m.reset(); onClose(); };
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      title="Add holiday"
      subtitle={`${data.company.entity_code} · ${data.company.legal_name ?? data.company.name}`}
      onSubmit={() => ready && m.mutate(undefined, { onSuccess: () => { toast({ tone: 'success', title: `Holiday added · ${formatDate(date)}` }); close(); } })}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button type="submit" busy={m.isPending} disabled={!ready} icon={<Ic icon={IconPlus} size={18} />}>Add holiday</Button>
        </>
      )}
    >
      <DateField label="Date *" value={date} onChange={(e) => setDate(e.target.value)} helper="Only future holidays can be removed later" />
      <TextInput label="Holiday name *" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="e.g. Deepavali" />
      <FormErrors error={m.error} title="The holiday wasn't added" />
    </Drawer>
  );
}
