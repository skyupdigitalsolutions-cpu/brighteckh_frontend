// No login frame exists in Figma — built from 00 · Foundations tokens + 01 · Components (Button, Text field,
// Inline alert). POST /api/auth/login { login_id, password } → TokenPairResponse.
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { IconEye, IconEyeOff, IconLogin2 } from '@tabler/icons-react';
import { apiErrorMessages, apiStatus } from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { homeFor } from '../auth/access';
import { Button, InlineAlert } from '../ui/primitives';
import { LogoMark } from '../ui/LogoMark';

type LocState = { from?: string; expired?: boolean } | null;

export function LoginPage() {
  const { me, loading, login } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const state = loc.state as LocState;
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string[] | null>(null);

  if (!loading && me) return <Navigate to={state?.from ?? homeFor(me.role)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!loginId.trim() || !password) { setError(['Enter your login ID and password.']); return; }
    setBusy(true);
    setError(null);
    try {
      const signedIn = await login(loginId.trim(), password);
      navigate(state?.from ?? homeFor(signedIn.role), { replace: true });
    } catch (err) {
      // 401 = wrong ID/password or disabled login; the server doesn't say which, and neither do we.
      setError(apiStatus(err) === 401 ? ['Login ID or password is incorrect.'] : apiErrorMessages(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark className="h-10 w-10 shrink-0" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-[0.04em] text-brand-logo">BRIGHTECH GROUP</p>
            <p className="text-sm text-fg-2">Job Management System</p>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-[10px] border border-line bg-surface p-5">
          <h1 className="text-xl font-semibold leading-[26px]">Sign in</h1>

          {state?.expired && !error && (
            <InlineAlert tone="neutral" title="Your session ended">Sign in again to continue.</InlineAlert>
          )}
          {error && (
            <InlineAlert tone="blocked" title="Couldn't sign you in">
              {error.length === 1 ? error[0] : <ul className="list-disc pl-4">{error.map((m, i) => <li key={i}>{m}</li>)}</ul>}
            </InlineAlert>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-id" className="text-base font-medium leading-6">Login ID</label>
            <input
              id="login-id"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              maxLength={120}
              className="h-[52px] rounded-xl border border-line-strong bg-surface px-3 text-base focus:border-line-focus focus:outline-none"
            />
            <p className="text-sm leading-5 text-fg-2">Your employee code</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-base font-medium leading-6">Password</label>
            <div className="relative">
              <input
                id="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={200}
                className="h-[52px] w-full rounded-xl border border-line-strong bg-surface pl-3 pr-12 text-base focus:border-line-focus focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-fg-2 hover:bg-subtle"
              >
                {show ? <IconEyeOff size={20} /> : <IconEye size={20} />}
              </button>
            </div>
          </div>

          <Button type="submit" block busy={busy} icon={<IconLogin2 size={20} />}>Sign in</Button>
        </form>
      </div>
    </div>
  );
}
