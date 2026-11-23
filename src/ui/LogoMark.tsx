// Brightech logo mark, rendered INLINE so it follows the theme: an <img src=svg> can't see the page's CSS variables.
// Gear = --color-brand-gear (light #737378, dark #A3A3AB, Figma brand/gear), "G" = --color-brand-logo (#DA4A3C both).
// Same artwork as src/assets/brand/logo-mark.svg (that file stays the source; the fallbacks keep its light colours).
// The customer quotation preview keeps <img src=logo-mark.svg>: it is light on purpose in both themes.
import raw from '../assets/brand/logo-mark.svg?raw';

const THEMED = raw
  .replace(/fill="#737378"/i, 'style="fill: var(--color-brand-gear, #737378)"')
  .replace(/fill="#DA4A3C"/i, 'style="fill: var(--color-brand-logo, #DA4A3C)"')
  .replace(/width="139" height="137"/, 'width="100%" height="100%"');

export function LogoMark({ className }: { className?: string }) {
  // Static, bundled asset (not user content), so injecting it is safe.
  return <span aria-hidden className={className} style={{ display: 'block' }} dangerouslySetInnerHTML={{ __html: THEMED }} />;
}
