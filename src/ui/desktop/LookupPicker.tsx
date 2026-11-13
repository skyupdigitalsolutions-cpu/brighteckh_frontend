// Name pickers for drawer fields — replace the typed-UUID inputs (G16–G19 are closed by GET /lookups/*).
//
// LookupPicker (combobox): the drawer select slot as drawn in
//   Create JIN → Customer 177:108457 (inside 177:108243), Add equipment group → Assembly (177:108542),
//   Expand → Store location / Custodian (177:108610).
//   Closed = the Fields.tsx box (h-44, px-14, radius 12, bg-subtle, 1px border-strong) with the value 14/20 primary
//   (placeholder muted) + 18px chevron-down secondary; open/focused = 2px brand inside-stroke (Customer box).
//   Field label 14/20 Medium, helper 12/16 secondary ("Search by name or customer code"), gap 6.
//   The option list is not drawn in Figma: it reuses the filter-menu surface (glass-strong, radius 18, p-8, gap 2,
//   shadow-menu, 177:106010) and option rows (px-12 py-10, radius 12; selected = brand-subtle + 16px brand check),
//   8px below the box, box-wide. Rows add a 12/16 muted sub-line (code / status).
//
// LookupRadioList (radio cards): Assign engineer drawer D·P2b 177:103201 → cards in 177:103290.
//   "Choose an engineer" heading 15/20 SemiBold; cards px-16 py-12, radius 16, gap 12 (list gap 16);
//   selected = brand-subtle + 2px brand-border, other = surface + 1px border-default; 40px subtle avatar with
//   initials (14/20 Medium secondary); name 14/20 Medium primary + sub 12/16 secondary; 22px radio
//   (on = accent dot, off = 2px border-strong ring).
//
// Both take a LookupSource (search hook + by-ids resolve hook + row accessors). Ready-made sources for the
// Purchase lookups live in src/pages/purchase/api.ts (customerSource, engineerSource, …).
import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconChevronDown, IconLoader2, IconRefresh, IconX } from '@tabler/icons-react';
import { cx, Ic } from './Icon';
import { Field, boxState } from './Fields';
import { Button } from './Button';
import { SearchField } from './SearchField';
import { initials } from './Avatar';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

// ---------------------------------------------------------------- source contract
/** The subset of a TanStack UseQueryResult the pickers read. */
export type LookupQueryLike<D> = {
  data?: D;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
  /** True while the previous search's rows are shown and the new ones load. */
  isPlaceholderData?: boolean;
};

export type LookupSource<T> = {
  /** Search hook (called on every render). `enabled` is false while the picker is closed. */
  useSearch: (search: string, enabled: boolean) => LookupQueryLike<{ rows: T[]; total: number }>;
  /** By-ids resolve hook → Record<id, row>; must be disabled for an empty list. */
  useResolve: (ids: string[]) => LookupQueryLike<Record<string, T>>;
  getId: (row: T) => string;
  /** Name shown in the box and as the option's main line. */
  getLabel: (row: T) => string;
  /** 12/16 sub-line (code, status, counts). */
  getSub?: (row: T) => ReactNode;
  /** The API needs at least this many search characters before it can list (item-bridge = 1). */
  minSearch?: number;
  /** Noun for the empty / prompt rows, e.g. "customers". */
  noun?: string;
};

// ---------------------------------------------------------------- LookupPicker (combobox)
export function LookupPicker<T>({
  label, helper, error, placeholder = 'Select…', value, onChange, source, disabled, clearable, className,
  emptyText, id, autoFocus,
}: {
  label: ReactNode;
  helper?: ReactNode;
  error?: string | null;
  placeholder?: string;
  /** Selected id (null/'' = none). A pre-set id is resolved to its name via the source's `useResolve`. */
  value: string | null | undefined;
  /** Receives the id and the picked row (row is undefined when cleared). */
  onChange: (id: string | null, row?: T) => void;
  source: LookupSource<T>;
  disabled?: boolean;
  /** Shows a 16px clear (x) while a value is set. */
  clearable?: boolean;
  className?: string;
  /** Empty-result text (default "No {noun} match “…”"). */
  emptyText?: ReactNode;
  id?: string;
  autoFocus?: boolean;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const listId = `${fid}-list`;
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<T | null>(null);
  const q = useDebouncedValue(search.trim(), 250);
  const minSearch = source.minSearch ?? 0;
  const canSearch = q.length >= minSearch;

  const results = source.useSearch(q, open && canSearch && !disabled);
  const rows = (canSearch && results.data?.rows) || [];
  const total = results.data?.total ?? 0;

  // Resolve a pre-set id that we didn't pick in this session.
  const pickedMatches = !!value && !!picked && source.getId(picked) === value;
  const resolve = source.useResolve(value && !pickedMatches ? [value] : []);
  const selectedRow: T | null = !value ? null : pickedMatches ? picked : resolve.data?.[value] ?? null;
  const selectedLabel = selectedRow
    ? source.getLabel(selectedRow)
    : value
      ? resolve.isPending || resolve.isFetching ? 'Loading…' : `Unknown (${value.slice(0, 8)})`
      : '';

  const openList = useCallback(() => {
    if (disabled) return;
    setSearch('');
    setActive(0);
    setOpen(true);
  }, [disabled]);
  const closeList = useCallback(() => { setOpen(false); setSearch(''); }, []);

  const choose = (row: T) => {
    setPicked(row);
    onChange(source.getId(row), row);
    closeList();
    inputRef.current?.focus();
  };

  // Keyboard highlight: start on the selected row when the results arrive.
  useEffect(() => {
    if (!open) return;
    const i = value ? rows.findIndex((r) => source.getId(r) === value) : -1;
    setActive(i >= 0 ? i : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results.data]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  // Outside click closes.
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      closeList();
    };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [open, closeList]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openList(); else setActive((a) => Math.min(a + 1, Math.max(rows.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Home' && open) {
      e.preventDefault(); setActive(0);
    } else if (e.key === 'End' && open) {
      e.preventDefault(); setActive(Math.max(rows.length - 1, 0));
    } else if (e.key === 'Enter') {
      if (open) {
        e.preventDefault(); // don't submit the drawer form
        const row = rows[active];
        if (row) choose(row);
      }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); e.stopPropagation(); closeList(); } // keep the drawer open
    } else if (e.key === 'Tab') {
      if (open) closeList();
    }
  };

  const activeId = open && rows[active] ? `${fid}-opt-${active}` : undefined;
  const noun = source.noun ?? 'results';

  return (
    <Field label={label} helper={helper} error={error} htmlFor={fid} className={className}>
      <div
        ref={boxRef}
        className={cx(boxState(!!error, disabled), open && 'ring-inside-brand', !disabled && 'cursor-text')}
        onMouseDown={(e) => {
          if (disabled || e.target === inputRef.current) return;
          e.preventDefault();
          inputRef.current?.focus();
          if (open) closeList(); else openList();
        }}
      >
        <input
          ref={inputRef}
          id={fid}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={!!error || undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={open ? (selectedLabel || 'Type to search') : placeholder}
          value={open ? search : selectedLabel}
          onFocus={() => { if (!open) openList(); }}
          onClick={() => { if (!open) openList(); }}
          onChange={(e) => {
            const v = e.target.value;
            if (!open) {
              setOpen(true);
              setSearch(selectedLabel && v.startsWith(selectedLabel) ? v.slice(selectedLabel.length) : v);
            } else setSearch(v);
            setActive(0);
          }}
          onKeyDown={onKey}
          className={cx(
            'min-w-0 flex-1 bg-transparent text-[14px] leading-[20px] text-fg placeholder:text-fg-muted focus:outline-none disabled:text-fg-disabled',
            !open && !selectedRow && value && 'text-fg-muted',
          )}
        />
        {open && results.isFetching && canSearch && <Ic icon={IconLoader2} size={16} className="animate-spin text-fg-muted" />}
        {clearable && value && !disabled && (
          <button
            type="button"
            aria-label="Clear"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { setPicked(null); onChange(null); closeList(); }}
            className="flex h-[16px] w-[16px] items-center justify-center text-fg-2"
          >
            <Ic icon={IconX} size={16} />
          </button>
        )}
        <Ic icon={IconChevronDown} size={18} className={cx('text-fg-2 transition-transform', open && 'rotate-180')} />
      </div>

      {open && (
        <ListPanel anchorRef={boxRef} panelRef={panelRef}>
          <div
            role="listbox"
            id={listId}
            aria-label={typeof label === 'string' ? label : undefined}
            className="glass-strong flex max-h-[296px] flex-col items-stretch gap-[2px] overflow-y-auto rounded-t-chip p-[8px] shadow-menu"
          >
            {!canSearch ? (
              <InfoRow>Type {minSearch > 1 ? `${minSearch} characters` : 'a name or code'} to search {noun}</InfoRow>
            ) : results.isError && !results.data ? (
              <div className="flex items-center gap-[8px] px-[12px] py-[10px]">
                <p className="min-w-0 flex-1 text-[14px] leading-[20px] text-st-blocked-fg">Couldn't load {noun}.</p>
                <Button kind="ghost" icon={<Ic icon={IconRefresh} size={18} />} onClick={() => results.refetch()}>Retry</Button>
              </div>
            ) : results.isPending && !results.data ? (
              <InfoRow><Ic icon={IconLoader2} size={16} className="animate-spin" /> Loading {noun}…</InfoRow>
            ) : rows.length === 0 ? (
              <InfoRow>{emptyText ?? (q ? `No ${noun} match “${q}”` : `No ${noun} available`)}</InfoRow>
            ) : (
              <>
                {rows.map((r, i) => {
                  const rid = source.getId(r);
                  const sel = rid === value;
                  const sub = source.getSub?.(r);
                  return (
                    <div
                      key={rid}
                      id={`${fid}-opt-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={sel}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(r)}
                      className={cx(
                        'flex w-full cursor-pointer items-center gap-[10px] rounded-t-field px-[12px] py-[10px] text-left',
                        sel ? 'bg-brand-subtle' : i === active ? 'bg-subtle' : '',
                        results.isPlaceholderData && 'opacity-70',
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className={cx('truncate text-[14px] leading-[20px]', sel ? 'font-medium text-fg' : 'text-fg')}>{source.getLabel(r)}</span>
                        {sub != null && sub !== '' && <span className="truncate text-[12px] leading-[16px] text-fg-muted">{sub}</span>}
                      </span>
                      {sel && <Ic icon={IconCheck} size={16} className="text-brand-text" />}
                    </div>
                  );
                })}
                {total > rows.length && (
                  <p className="px-[12px] pb-[4px] pt-[6px] text-[12px] leading-[16px] text-fg-muted">
                    Showing {rows.length} of {total} · keep typing to narrow
                  </p>
                )}
              </>
            )}
          </div>
        </ListPanel>
      )}
    </Field>
  );
}

function InfoRow({ children }: { children: ReactNode }) {
  return <p role="status" className="flex items-center gap-[8px] px-[12px] py-[10px] text-[14px] leading-[20px] text-fg-2">{children}</p>;
}

/** Box-wide panel 8px below the anchor (flips above when there's no room), in a portal above drawers (z-60). */
function ListPanel({ anchorRef, panelRef, children }: {
  anchorRef: RefObject<HTMLElement>; panelRef: RefObject<HTMLDivElement>; children: ReactNode;
}) {
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const flip = below < 240 && r.top > below;
    setPos(flip
      ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 8 }
      : { left: r.left, width: r.width, top: r.bottom + 8 });
  }, [anchorRef]);
  useLayoutEffect(() => { place(); }, [place]);
  useEffect(() => {
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [place]);
  if (!pos) return null;
  return createPortal(
    <div ref={panelRef} className="fixed z-[60]" style={pos} onClick={(e) => e.stopPropagation()}>{children}</div>,
    document.body,
  );
}

// ---------------------------------------------------------------- LookupRadioList (radio cards, P2b)
export function LookupRadioList<T>({
  title, value, onChange, source, searchable, searchPlaceholder, className, emptyText, name: groupName, error,
}: {
  /** Heading above the cards, e.g. "Choose an engineer" (Desktop/H3 15/20 SemiBold). */
  title?: ReactNode;
  value: string | null | undefined;
  onChange: (id: string, row: T) => void;
  source: LookupSource<T>;
  /** Show a search field above the cards. It also appears automatically when the list has more rows than fit. */
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  emptyText?: ReactNode;
  /** Radio group name (defaults to a unique id). */
  name?: string;
  error?: string | null;
}) {
  const auto = useId();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 250);
  const results = source.useSearch(q, true);
  const rows = results.data?.rows ?? [];
  const total = results.data?.total ?? 0;
  const inPage = !!value && rows.some((r) => source.getId(r) === value);
  const resolve = source.useResolve(value && !inPage && results.data ? [value] : []);
  const pinned = value && !inPage ? resolve.data?.[value] : undefined;
  const list = pinned ? [pinned, ...rows] : rows;
  const showSearch = searchable || total > rows.length || search !== '';

  return (
    <div className={cx('flex w-full flex-col items-stretch gap-[16px]', className)}>
      {title && <p className="whitespace-nowrap text-[15px] font-semibold leading-[20px] text-fg">{title}</p>}
      {showSearch && (
        <SearchField value={search} onChange={setSearch} placeholder={searchPlaceholder ?? `Search ${source.noun ?? ''}`.trim()} width="full" />
      )}
      {results.isError && !results.data ? (
        <div className="flex w-full items-center gap-[8px] rounded-[16px] border border-line px-[16px] py-[12px]">
          <p className="min-w-0 flex-1 text-[14px] leading-[20px] text-st-blocked-fg">Couldn't load {source.noun ?? 'options'}.</p>
          <Button kind="ghost" icon={<Ic icon={IconRefresh} size={18} />} onClick={() => results.refetch()}>Retry</Button>
        </div>
      ) : results.isPending && !results.data ? (
        <div role="status" aria-label="Loading" className="flex flex-col gap-[16px]">
          {[0, 1, 2].map((i) => <div key={i} className="h-[64px] w-full animate-pulse rounded-[16px] bg-subtle" />)}
        </div>
      ) : list.length === 0 ? (
        <p className="text-[14px] leading-[20px] text-fg-2">{emptyText ?? (q ? `No ${source.noun ?? 'results'} match “${q}”` : `No ${source.noun ?? 'options'} available`)}</p>
      ) : (
        <div role="radiogroup" aria-label={typeof title === 'string' ? title : undefined} className="flex flex-col items-stretch gap-[16px]">
          {list.map((r) => {
            const rid = source.getId(r);
            const on = rid === value;
            const name = source.getLabel(r);
            const sub = source.getSub?.(r);
            return (
              <label
                key={rid}
                className={cx(
                  'flex w-full cursor-pointer items-center gap-[12px] overflow-clip rounded-[16px] px-[16px] py-[12px]',
                  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-line-focus',
                  on ? 'border-2 border-brand-border bg-brand-subtle' : 'border border-line bg-surface hover:bg-subtle',
                )}
              >
                <input
                  type="radio"
                  name={groupName ?? auto}
                  value={rid}
                  checked={on}
                  onChange={() => onChange(rid, r)}
                  className="sr-only"
                />
                <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-clip rounded-full bg-subtle text-[14px] font-medium leading-[20px] text-fg-2" aria-hidden>
                  {initials(name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col items-start overflow-clip">
                  <span className="truncate text-[14px] font-medium leading-[20px] text-fg">{name}</span>
                  {sub != null && sub !== '' && <span className="truncate text-[12px] leading-[16px] text-fg-2">{sub}</span>}
                </span>
                <span
                  aria-hidden
                  className={cx('h-[22px] w-[22px] shrink-0 rounded-full', on ? 'bg-accent' : 'border-2 border-line-strong')}
                  style={on ? undefined : { margin: 1, width: 20, height: 20 }}
                />
              </label>
            );
          })}
          {total > rows.length && (
            <p className="text-[12px] leading-[16px] text-fg-muted">Showing {rows.length} of {total} · search to narrow</p>
          )}
        </div>
      )}
      {error && <p className="text-[12px] leading-[16px] text-st-blocked-fg">{error}</p>}
    </div>
  );
}
