// Figma "Shell / Pagination" 33:742 (177:102936; page 2 active in 177:107634).
// Container: glass, radius 24, p-6, gap 6. Prev/Next: 36×36 radius 18, glass-strong + 1px border-default,
// 18px chevron (primary). Page: 48×36 radius 18; current = brand gradient + 14/20 Medium white; other =
// glass-strong + 1px border-default + 14/20 Medium secondary.
// Paging is CLIENT-SIDE (Figma note: list endpoints have no limit/cursor). Use paginate() to slice.
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { cx, Ic } from './Icon';

export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  return { pages, page: p, rows: rows.slice((p - 1) * pageSize, p * pageSize) };
}

export function Pagination({ page, pages, onChange, className }: { page: number; pages: number; onChange: (p: number) => void; className?: string }) {
  if (pages <= 1) return null;
  const nav = 'flex h-[36px] w-[36px] shrink-0 items-center justify-center overflow-clip rounded-t-chip border border-line bg-glass-strong text-fg disabled:opacity-40';
  return (
    <nav aria-label="Pagination" className={cx('glass flex w-fit items-center gap-[6px] rounded-[24px] p-[6px]', className)}>
      <button type="button" aria-label="Previous page" className={nav} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <Ic icon={IconChevronLeft} size={18} />
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onChange(p)}
          className={cx(
            'flex h-[36px] w-[48px] shrink-0 items-center justify-center overflow-clip rounded-t-chip text-[14px] font-medium leading-[20px]',
            p === page ? 'bg-brand-gradient text-fg-inverse' : 'border border-line bg-glass-strong text-fg-2',
          )}
        >
          {p}
        </button>
      ))}
      <button type="button" aria-label="Next page" className={nav} disabled={page >= pages} onClick={() => onChange(page + 1)}>
        <Ic icon={IconChevronRight} size={18} />
      </button>
    </nav>
  );
}
