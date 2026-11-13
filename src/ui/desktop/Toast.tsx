// Toast. No Figma toast component exists; this is the desktop InlineAlert (5:332) floated bottom-right over the
// canvas with the popover shadow, auto-dismissed after 5 s. Wrap the desktop shell in <ToastProvider> (done in
// DesktopShell); call useToast()({ tone, title, body }) after a mutation succeeds or fails.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import type { Tone } from '../../lib/tones';
import { Ic } from './Icon';
import { InlineAlert } from './Feedback';

type ToastInput = { tone?: Tone; title: ReactNode; body?: ReactNode; durationMs?: number };
type ToastItem = ToastInput & { id: number };
const Ctx = createContext<((t: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { ...t, id }]);
    window.setTimeout(() => dismiss(id), t.durationMs ?? 5000);
  }, [dismiss]);
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-[28px] right-[28px] z-[60] flex w-[420px] max-w-[calc(100vw-56px)] flex-col gap-[8px]" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className="pointer-events-auto relative rounded-t-md bg-surface shadow-popover">
              <InlineAlert tone={t.tone ?? 'success'} title={t.title}>{t.body}</InlineAlert>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="absolute right-[10px] top-[12px] text-current opacity-70 hover:opacity-100">
                <Ic icon={IconX} size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  const t = useContext(Ctx);
  if (!t) throw new Error('useToast outside ToastProvider');
  return t;
}
