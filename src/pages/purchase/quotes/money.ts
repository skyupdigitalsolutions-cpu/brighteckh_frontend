// Decimal helpers for BR-04 quote money. BR-04 quote amounts are `numeric` RUPEES (decimal strings in responses,
// JSON numbers in requests) — not paise. Arithmetic is done on BigInt paise so no float rounding reaches the screen.
import { formatINR } from '../../../lib/format';

const DEC = /^\s*(\d+)(?:\.(\d*))?\s*$/;

/** "9500" / "9500.5" / "9500.505" -> paise (half-up on the 3rd decimal). null when not a non-negative decimal. */
export function toPaise(v: string | null | undefined): bigint | null {
  if (v == null) return null;
  const m = DEC.exec(v);
  if (!m) return null;
  const frac = m[2] ?? '';
  let p = BigInt(m[1]) * 100n + BigInt((frac + '00').slice(0, 2));
  if ((frac[2] ?? '0') >= '5') p += 1n;
  return p;
}

/** paise -> "1234.50" (decimal string accepted by formatINR). */
export function paiseToDec(p: bigint): string {
  const neg = p < 0n;
  const a = neg ? -p : p;
  return `${neg ? '-' : ''}${a / 100n}.${(a % 100n).toString().padStart(2, '0')}`;
}

export const formatPaiseBig = (p: bigint | null) => (p == null ? '—' : formatINR(paiseToDec(p)));

/** qty (decimal string, up to 4 dp) × unit price (paise) -> line paise, half-up. null if qty is not a decimal. */
export function lineTotalPaise(qty: string, unitPaise: bigint | null): bigint | null {
  if (unitPaise == null) return null;
  const m = DEC.exec(qty);
  if (!m) return null;
  const q4 = BigInt(m[1]) * 10000n + BigInt(((m[2] ?? '') + '0000').slice(0, 4));
  return (q4 * unitPaise + 5000n) / 10000n;
}

/** True for a valid positive/non-negative decimal string. */
export const isDecimal = (v: string) => DEC.test(v);
