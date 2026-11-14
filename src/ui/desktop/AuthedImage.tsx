// Server-stored image (POST /uploads → file_uri "/api/uploads/<id>"). GET /uploads/:id needs the bearer token, so a
// plain <img src> can't load it: the bytes are fetched through the authed axios client and shown as an object URL.
// Any other URI (e.g. the engineer app's legacy "pending-upload://…" placeholders, G4) has no bytes to fetch → the
// `fallback` is rendered instead (Figma's gradient tile + photo glyph).
import { useEffect, useState, type ReactNode } from 'react';
import { http } from '../../api/http';
import { cx } from './Icon';

/** "/api/uploads/<id>" → "/uploads/<id>" (http.ts already has the /api base); null when not a server upload. */
export function uploadPath(fileUri: string | null | undefined): string | null {
  if (!fileUri) return null;
  const m = /^(?:https?:\/\/[^/]+)?\/api(\/uploads\/[0-9a-f-]{36})$/i.exec(fileUri);
  return m ? m[1]! : null;
}

export function useAuthedObjectUrl(fileUri: string | null | undefined): { url: string | null; failed: boolean } {
  const path = uploadPath(fileUri);
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });
  useEffect(() => {
    if (!path) { setState({ url: null, failed: false }); return; }
    let url: string | null = null;
    let live = true;
    http.get<Blob>(path, { responseType: 'blob' })
      .then((r) => { if (!live) return; url = URL.createObjectURL(r.data); setState({ url, failed: false }); })
      .catch(() => { if (live) setState({ url: null, failed: true }); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [path]);
  return state;
}

export function AuthedImage({ fileUri, alt, className, fallback }: {
  fileUri: string | null | undefined; alt: string; className?: string; fallback: ReactNode;
}) {
  const { url } = useAuthedObjectUrl(fileUri);
  if (!url) return <>{fallback}</>;
  return <img src={url} alt={alt} className={cx('block h-full w-full object-cover', className)} />;
}
