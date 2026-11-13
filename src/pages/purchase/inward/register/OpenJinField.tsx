// "Open JIN" — the closest real path while the register can't list receipts (G14).
// GET /inward-receipts/{id} exists, so a receipt can be opened by its UUID (or a pasted /p/inward/<id> link).
// A JIN *number* (JIN-BLR-000061) can't be resolved: that needs a list/search endpoint.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowRight } from '@tabler/icons-react';
import { Button, Ic, TextInput } from '../../../../ui/desktop';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function parseReceiptId(text: string): string | null {
  const m = UUID.exec(text.trim());
  return m ? m[0].toLowerCase() : null;
}

export function OpenJinField({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = parseReceiptId(text);
    if (!id) {
      setError(/^\s*JIN-/i.test(text)
        ? "JIN numbers can't be looked up yet (no inward list). Paste the receipt ID or its /p/inward/… link."
        : 'Paste a receipt ID (UUID) or a /p/inward/… link.');
      return;
    }
    navigate(`/p/inward/${id}`);
  };

  return (
    <form onSubmit={submit} className={className} noValidate>
      <div className="flex w-full items-start gap-[8px]">
        <TextInput
          label="Open a JIN"
          mono
          value={text}
          onChange={(e) => { setText(e.target.value); setError(undefined); }}
          placeholder="Receipt ID or /p/inward/… link"
          error={error}
          className="min-w-px flex-1 text-left"
        />
        <Button kind="secondary" type="submit" icon={<Ic icon={IconArrowRight} size={18} />} className="mt-[30px]">Open</Button>
      </div>
    </form>
  );
}
