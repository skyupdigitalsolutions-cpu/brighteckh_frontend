// Glass surfaces from the desktop frames.
// - GlassCard: generic container. `strong` = glass-strong fill (table card 177:102758), else glass (tab bar,
//   toolbar, dashboard panels). `shadow` = 0 8 24 rgba(51,38,38,.06) (register tab bar / toolbar / table card).
// - Panel: dashboard / workspace card (Figma "Jobs by status" 177:102599, "Engineer workload" 177:102628):
//   p-24, radius 28, gap 20, head = 20/28 SemiBold title + optional right slot (meta text or "See all" pill).
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './Icon';

type GlassProps = HTMLAttributes<HTMLDivElement> & {
  strong?: boolean;
  shadow?: boolean;
  /** Tailwind radius class; default rounded-t-card (28px). */
  radius?: string;
};

export function GlassCard({ children, className, strong, shadow, radius = 'rounded-t-card', ...rest }: GlassProps) {
  return (
    <div {...rest} className={cx(strong ? 'glass-strong' : 'glass', radius, shadow && 'shadow-glass', 'overflow-clip', className)}>
      {children}
    </div>
  );
}

export function Panel({ title, right, children, className, strong, shadow, bodyClassName }: {
  title?: ReactNode;
  /** Right side of the head: a meta string (14/20 secondary) or a node such as <PillButton>See all</PillButton>. */
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  strong?: boolean;
  shadow?: boolean;
}) {
  return (
    <GlassCard strong={strong} shadow={shadow} className={cx('flex flex-col gap-[20px] p-[24px]', className)}>
      {(title || right) && (
        <div className="flex w-full items-center gap-[12px]">
          <h2 className="min-w-0 flex-1 text-[20px] font-semibold leading-[28px] text-fg">{title}</h2>
          {typeof right === 'string'
            ? <p className="shrink-0 whitespace-nowrap text-[14px] leading-[20px] text-fg-2">{right}</p>
            : right}
        </div>
      )}
      <div className={cx('flex min-h-0 flex-1 flex-col', bodyClassName)}>{children}</div>
    </GlassCard>
  );
}

/** Content column under the page header (Figma "Content": vertical stack, gap 20). */
export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex w-full min-w-0 flex-col gap-[20px]', className)}>{children}</div>;
}
