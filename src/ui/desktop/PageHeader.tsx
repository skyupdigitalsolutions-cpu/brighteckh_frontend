// Figma "Shell / Page header" 76:802 (instances 177:102546 dashboard, 177:102736 register, 177:116071 job).
// "Title = page or record, Meta = context line, Team = engineers on the job/area, Action = one primary for the
// page." Layout: px-20, gap 16, centred row; Titles column (flex-1, gap 4): title Desktop/H1 22/28 SemiBold
// primary, meta Desktop/Body 14/20 secondary (whitespace preserved, "A  |  B" spacing as drawn).
// Team = <AvatarStack> (36px, -10px overlap, +n chip). Action = one primary <Button>.
import type { ReactNode } from 'react';
import { AvatarStack } from './Avatar';
import { cx } from './Icon';

export function PageHeader({ title, meta, team, action, className }: {
  title: ReactNode;
  meta?: ReactNode;
  /** Engineers on the record/area. Only real people from the API — omit when unknown. */
  team?: { name: string; seed?: string }[];
  /** The page's single primary action (e.g. <Button icon={<Ic icon={IconPlus} size={18}/>}>New JIN</Button>). */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('flex w-full items-center gap-[16px] px-[20px]', className)}>
      <div className="flex min-w-px flex-1 flex-col items-start gap-[4px] overflow-clip">
        <h1 className="whitespace-nowrap text-[22px] font-semibold leading-[28px] text-fg">{title}</h1>
        {meta != null && meta !== '' && (
          <div className="flex items-center overflow-clip">
            <p className="whitespace-pre text-[14px] leading-[20px] text-fg-2">{meta}</p>
          </div>
        )}
      </div>
      {team && team.length > 0 && <AvatarStack people={team} />}
      {action}
    </header>
  );
}
