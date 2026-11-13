// Avatars.
// - Avatar: circle with initials. Colour = one of the Figma team literals (#7b6fd6, #2ba597, #f5a300 from the page
//   header Team 76:807), picked deterministically from `seed` (an id) so a person keeps one colour; or the brand
//   gradient (`brand`, the signed-in user 76:797).
//   Sizes: 36 (team, 11/14 SemiBold +0.44, 2px surface ring), 40 (user / workload rows, 14/20 Medium),
//   30/28 (dashboard people, 11/14 SemiBold), 44 (assignment card, 14/20 Medium).
// - AvatarStack: Team overlap (-10px) with a "+n" subtle chip.
import { cx } from './Icon';

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

const PALETTE = ['#7b6fd6', '#2ba597', '#f5a300'];
function colourFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

export function Avatar({ name, seed, size = 40, brand, ring, className }: {
  name: string; seed?: string; size?: 28 | 30 | 36 | 40 | 44; brand?: boolean; ring?: boolean; className?: string;
}) {
  const big = size >= 40;
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center overflow-clip rounded-full text-fg-inverse',
        brand && 'bg-brand-gradient',
        ring && 'border-2 border-surface',
        big ? 'text-[14px] font-medium leading-[20px]' : 'text-[11px] font-semibold leading-[14px] tracking-[0.44px]',
        className,
      )}
      style={{ width: size, height: size, background: brand ? undefined : colourFor(seed ?? name) }}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 3 }: { people: { name: string; seed?: string }[]; max?: number }) {
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <div className="flex items-center overflow-clip">
      {shown.map((p, i) => (
        <Avatar key={p.seed ?? p.name + i} name={p.name} seed={p.seed} size={36} ring className="mr-[-10px]" />
      ))}
      {more > 0 && (
        <span className="inline-flex h-[36px] w-[36px] items-center justify-center overflow-clip rounded-full border-2 border-surface bg-subtle text-[11px] font-semibold leading-[14px] tracking-[0.44px] text-fg-2">
          +{more}
        </span>
      )}
      {more <= 0 && <span className="w-[10px]" aria-hidden />}
    </div>
  );
}
