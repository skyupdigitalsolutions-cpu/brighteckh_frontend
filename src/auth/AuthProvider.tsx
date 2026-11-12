import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/endpoints';
import { SESSION_EXPIRED, tokens } from '../api/http';
import type { Me } from '../api/types';

type AuthState = {
  me: Me | null;
  companyCode: string | null; // BLR / CHN (legal_entities.entity_code)
  companyName: string | null;
  loading: boolean;
  login: (login_id: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState(() => !!(tokens.access || tokens.refresh));

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: hasSession, retry: false, staleTime: 60_000 });
  const companyQ = useQuery({
    queryKey: ['entity-profile', meQ.data?.company_id],
    queryFn: api.entityProfile,
    enabled: !!meQ.data,
    staleTime: Infinity,
    retry: false,
  });
  const companyCode = companyQ.data?.entity_code ?? null;
  const companyName = companyQ.data?.name ?? null;

  useEffect(() => {
    try {
      if (companyCode) document.documentElement.dataset.company = companyCode;
      else delete document.documentElement.dataset.company;
    } catch { /* ignore */ }
  }, [companyCode]);

  const clear = useCallback(() => {
    tokens.clear();
    setHasSession(false);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    const onExpired = () => { clear(); navigate('/login', { replace: true, state: { expired: true } }); };
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
  }, [clear, navigate]);

  // A stored token that /auth/me rejects even after refresh = no session.
  useEffect(() => { if (meQ.isError) clear(); }, [meQ.isError, clear]);

  const value = useMemo<AuthState>(() => ({
    me: meQ.data ?? null,
    companyCode,
    companyName,
    loading: hasSession && meQ.isPending,
    async login(login_id, password) {
      await api.login({ login_id, password });
      setHasSession(true);
      const me = await qc.fetchQuery({ queryKey: ['me'], queryFn: api.me });
      return me;
    },
    async logout() {
      try { await api.logout(); } finally { clear(); navigate('/login', { replace: true }); }
    },
  }), [meQ.data, meQ.isPending, companyCode, companyName, hasSession, qc, clear, navigate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** The signed-in user. Only use under <RequireAuth>. */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error('useMe without a session');
  return me;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullScreenSpinner />;
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

function FullScreenSpinner() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
    </div>
  );
}
