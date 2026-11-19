// One evidence file per field: POST /uploads (purchaseApi.upload) as soon as it's picked; pass `uri` (file_uri) to the write.
import { useState } from 'react';
import { apiErrorText } from '../../../api/http';
import { purchaseApi } from '../../purchase/api';

export type Evidence = { name: string; state: 'uploading' | 'uploaded' | 'failed'; progress: number; uri?: string; error?: string; file: File };

/** One evidence file: POST /uploads immediately; pass `ev.uri` (the file_uri) to the write. */
export function useEvidence() {
  const [ev, setEv] = useState<Evidence | null>(null);
  const upload = (file: File) => {
    setEv({ name: file.name, state: 'uploading', progress: 0, file });
    purchaseApi.upload(file, (pct) => setEv((e) => (e && e.file === file ? { ...e, progress: pct } : e)))
      .then((r) => setEv((e) => (e && e.file === file ? { ...e, state: 'uploaded', progress: 100, uri: r.file_uri } : e)))
      .catch((err) => setEv((e) => (e && e.file === file ? { ...e, state: 'failed', error: apiErrorText(err) } : e)));
  };
  return { ev, upload, clear: () => setEv(null), busy: ev?.state === 'uploading', uri: ev?.state === 'uploaded' ? ev.uri : undefined };
}

