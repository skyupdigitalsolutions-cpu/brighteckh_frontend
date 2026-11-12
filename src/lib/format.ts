// Presentation-only formatting (Figma 00 · Foundations → "Numbers, currency and dates").
// The API returns decimals and bigints as STRINGS; never route them through JS floats.

const IST = 'Asia/Kolkata';

/** Indian digit grouping on an integer string: 12345678 -> 1,23,45,678 */
function groupIndian(intPart: string): string {
  const neg = intPart.startsWith('-');
  const d = neg ? intPart.slice(1) : intPart;
  if (d.length <= 3) return (neg ? '-' : '') + d;
  const last3 = d.slice(-3);
  const rest = d.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (neg ? '-' : '') + rest + ',' + last3;
}

/** "124500.0000" -> "₹1,24,500.00" (always 2 decimals, half-up on the string). */
export function formatINR(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m) return value;
  const [, sign, int, frac = ''] = m;
  let cents = BigInt(int) * 100n + BigInt((frac + '00').slice(0, 2));
  if ((frac[2] ?? '0') >= '5') cents += 1n;
  const i = (cents / 100n).toString();
  const f = (cents % 100n).toString().padStart(2, '0');
  return `${sign}₹${groupIndian(i)}.${f}`;
}

/** Integer paise (number or string) -> "₹1,24,500.00" */
export function formatPaise(paise: string | number | null | undefined): string {
  if (paise == null || paise === '') return '—';
  const p = BigInt(typeof paise === 'number' ? Math.trunc(paise) : paise);
  const neg = p < 0n;
  const a = neg ? -p : p;
  return `${neg ? '-' : ''}₹${groupIndian((a / 100n).toString())}.${(a % 100n).toString().padStart(2, '0')}`;
}

/** "7.0000" + "NOS" -> "7 NOS"; "2.5000" + "M" -> "2.5 M" (trim trailing zeros, keep grouping). */
export function formatQty(value: string | number | null | undefined, uom?: string | null): string {
  if (value == null || value === '') return '—';
  const s = String(value);
  const m = /^(-?\d+)(?:\.(\d*?))?0*$/.exec(s);
  const out = m ? groupIndian(m[1]) + (m[2] ? '.' + m[2] : '') : s;
  return uom ? `${out} ${uom}` : out;
}

const dtf = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
const tf = new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false });
const df = new Intl.DateTimeFormat('en-GB', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' });

/** ISO -> "04 Nov 2026, 10:42" in IST */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dtf.format(d); // en-GB: "04 Nov 2026, 10:42"
}
export const formatTime = (iso: string | null | undefined) => (iso ? tf.format(new Date(iso)) : '—');
export const formatDate = (iso: string | null | undefined) => (iso ? df.format(new Date(iso)) : '—');

/** seconds -> "01:24:37" */
export function formatDuration(totalSeconds: number | string | null | undefined): string {
  const n = Math.max(0, Math.floor(Number(totalSeconds ?? 0)) || 0);
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
  return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':');
}

/** AWAITING_ASSIGNMENT -> "AWAITING ASSIGNMENT" (badge label rule). */
export const enumLabel = (v: string) => v.replace(/_/g, ' ');
