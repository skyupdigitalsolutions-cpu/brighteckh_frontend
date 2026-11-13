// Figma "D·P2a · JIN detail · verify unit (photo gate)" 177:103100 → kit Drawer variant="side" 177:103185 (480 wide).
// Body: Photo capture "Unit photos" (required) · "Unit details" (Desktop/H3 15/20) · Serial number · Observed make /
// model · Reported fault · Physical condition (Text field 36px box, px-12, radius 12, surface fill, 1px border-strong).
// Footer: Gated action — blocked "Add a photo to continue" + "Take photo" + disabled "Verify & create Job ID";
// ready = "n photos attached" + enabled primary.
// Photos: each picked photo → POST /uploads → POST /equipment-units/{id}/photos immediately. The gate counts the
// unit's photos on the server (GET /equipment-units/{id}/photos, useUnitPhotos), so photos added earlier count too.
// Unit details: editable while the unit is PENDING / ON_HOLD (PATCH /equipment-units/{id}, useUpdateUnit) — saved
// with "Save details" or automatically just before verify. POST /equipment-units/{id}/verify (no body) →
// { equipment_unit, job }. The DB enforces photo-before-verify too; its message is shown.
import { useEffect, useRef, useState } from 'react';
import { IconCamera, IconDeviceFloppy } from '@tabler/icons-react';
import { Button, Drawer, FieldRow, FormErrors, GatedAction, Ic, PhotoPicker, type PickedFile } from '../../../../ui/desktop';
import {
  useAddUnitPhoto, useUnitPhotos, useUpdateUnit, useUpload, useVerifyUnit, type EquipmentUnit, type InwardReceipt,
  type UpdateUnitBody, type VerifyUnitResult,
} from '../../api';

type Slot = PickedFile & { file: File; fileUri?: string };

type Details = { serial_number: string; observed_make: string; observed_model: string; reported_fault: string; physical_condition: string };
const DETAIL_KEYS = ['serial_number', 'observed_make', 'observed_model', 'reported_fault', 'physical_condition'] as const;
const detailsOf = (u: EquipmentUnit): Details => ({
  serial_number: u.serial_number ?? '',
  observed_make: u.observed_make ?? '',
  observed_model: u.observed_model ?? '',
  reported_fault: u.reported_fault ?? '',
  physical_condition: u.physical_condition ?? '',
});

// P2a text field: label 14/20 Medium, gap 6; 36px box, px-12, radius 12, surface, 1px border-strong.
function DetailInput({ label, value, onChange, disabled, mono }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; mono?: boolean;
}) {
  return (
    <label className="flex w-full flex-col items-start gap-[6px]">
      <span className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="—"
        className={
          'h-[36px] w-full rounded-t-field border border-line-strong bg-surface px-[12px] text-fg placeholder:text-fg-muted '
          + 'focus:outline-none focus:ring-inside-brand disabled:bg-subtle disabled:text-fg-2 '
          + (mono ? 'font-mono text-[13px] font-medium leading-[18px]' : 'text-[14px] leading-[20px]')
        }
      />
    </label>
  );
}

export function VerifyUnitDrawer({ open, onClose, receipt, unit, unitLabel, groupLabel, onVerified }: {
  open: boolean;
  onClose: () => void;
  receipt: InwardReceipt;
  unit: EquipmentUnit;
  /** "3 of 3" */
  unitLabel: string;
  groupLabel: string;
  onVerified: (r: VerifyUnitResult) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [photoError, setPhotoError] = useState<unknown>(null);
  const photos = useUnitPhotos(unit.id);
  const upload = useUpload();
  const addPhoto = useAddUnitPhoto(receipt.id);
  const verify = useVerifyUnit(receipt.id);
  const update = useUpdateUnit(receipt.id);
  const camera = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const editable = unit.verification_status === 'PENDING' || unit.verification_status === 'ON_HOLD';
  const [saved, setSaved] = useState<Details>(() => detailsOf(unit));
  const [d, setD] = useState<Details>(() => detailsOf(unit));
  const changed = DETAIL_KEYS.filter((k) => d[k].trim() !== saved[k].trim());
  const setField = (k: keyof Details) => (v: string) => { update.reset(); setD((p) => ({ ...p, [k]: v })); };

  // Release previews when the drawer goes away.
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  useEffect(() => () => { slotsRef.current.forEach((s) => s.previewUrl && URL.revokeObjectURL(s.previewUrl)); }, []);

  const patch = (key: string, p: Partial<Slot>) => setSlots((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const send = async (key: string, file: File) => {
    patch(key, { state: 'uploading', progress: 0 });
    try {
      const up = await upload.mutateAsync({ file, onProgress: (pct) => patch(key, { progress: pct }) });
      await addPhoto.mutateAsync({
        unitId: unit.id,
        body: { file_uri: up.file_uri, file_name: up.original_name, mime_type: up.content_type, file_size_bytes: Number(up.size_bytes) },
      });
      patch(key, { state: 'uploaded', progress: 100, fileUri: up.file_uri });
    } catch (e) {
      setPhotoError(e);
      patch(key, { state: 'failed' });
    }
  };

  const take = (files: File[]) => {
    setPhotoError(null);
    const added: Slot[] = files.map((file) => ({
      key: `p${++seq.current}`,
      name: file.name,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      state: 'uploading',
      progress: 0,
    }));
    setSlots((xs) => [...xs, ...added]);
    added.forEach((s) => { void send(s.key, s.file); });
  };
  const retry = () => { setPhotoError(null); slots.filter((s) => s.state === 'failed').forEach((s) => { void send(s.key, s.file); }); };

  // Thumbs = photos already on the server (added earlier, no local preview) + this drawer's slots.
  const localUris = new Set(slots.map((s) => s.fileUri).filter(Boolean));
  const earlier: PickedFile[] = (photos.data ?? [])
    .filter((p) => !localUris.has(p.file_uri))
    .map((p) => ({ key: p.id, name: p.file_name, state: 'uploaded' }));
  const files: PickedFile[] = [...earlier, ...slots];

  const uploading = slots.some((s) => s.state === 'uploading');
  const attachedHere = slots.filter((s) => s.state === 'uploaded').length;
  // Server count when known; while it loads / if it fails, what this drawer attached (the DB re-checks on verify).
  const attached = photos.data ? photos.data.length : attachedHere;
  const ready = attached > 0 && !uploading && !update.isPending;

  const body = (): UpdateUnitBody => Object.fromEntries(changed.map((k) => [k, d[k].trim() || null])) as UpdateUnitBody;
  const save = (then?: () => void) =>
    update.mutate({ unitId: unit.id, body: body() }, { onSuccess: () => { setSaved(d); then?.(); } });

  const doVerify = () => {
    const go = () => verify.mutate(unit.id, { onSuccess: (r) => onVerified(r) });
    if (editable && changed.length > 0) save(go); else go();
  };

  return (
    <Drawer
      variant="side"
      open={open}
      onClose={onClose}
      busy={verify.isPending || uploading || update.isPending}
      title={`Verify unit ${unitLabel}`}
      subtitle={`${receipt.jin_number} · ${groupLabel}`}
      footer={
        <div className="flex w-full flex-col gap-[12px]">
          <FormErrors error={verify.error} />
          <GatedAction
            ready={ready}
            reason={uploading ? 'Uploading photo…' : photos.isPending && attachedHere === 0 ? 'Checking photos…' : 'Add a photo to continue'}
            readyNote={`${attached} ${attached === 1 ? 'photo' : 'photos'} attached`}
            primaryLabel="Verify & create Job ID"
            onPrimary={doVerify}
            busy={verify.isPending || update.isPending}
            secondaryLabel={attached > 0 ? 'Add another photo' : 'Take photo'}
            secondaryIcon={IconCamera}
            onSecondary={() => camera.current?.click()}
          />
        </div>
      }
    >
      <input
        ref={camera}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        hidden
        onChange={(e) => { if (e.target.files?.length) take(Array.from(e.target.files)); e.target.value = ''; }}
      />
      <PhotoPicker title="Unit photos" required files={files} onFiles={take} onRetry={retry} />
      {photoError != null && <FormErrors error={photoError} title="The photo was not attached" />}
      {photos.isError && <FormErrors error={photos.error} title="Couldn't load the unit's earlier photos" />}
      <p className="whitespace-nowrap text-[15px] font-semibold leading-[20px] text-fg">Unit details</p>
      <DetailInput label="Serial number" mono value={d.serial_number} onChange={setField('serial_number')} disabled={!editable} />
      <FieldRow>
        <DetailInput label="Observed make" value={d.observed_make} onChange={setField('observed_make')} disabled={!editable} />
        <DetailInput label="Observed model" value={d.observed_model} onChange={setField('observed_model')} disabled={!editable} />
      </FieldRow>
      <DetailInput label="Reported fault" value={d.reported_fault} onChange={setField('reported_fault')} disabled={!editable} />
      <DetailInput label="Physical condition" value={d.physical_condition} onChange={setField('physical_condition')} disabled={!editable} />
      {editable ? (
        <div className="flex w-full flex-col items-end gap-[8px]">
          <FormErrors error={update.error} title="The unit details were not saved" />
          {changed.length > 0 && (
            <Button kind="secondary" busy={update.isPending} icon={<Ic icon={IconDeviceFloppy} size={18} />} onClick={() => save()}>
              Save details
            </Button>
          )}
          {changed.length > 0 && <p className="text-[12px] leading-[16px] text-fg-2">Unsaved changes are saved when you verify.</p>}
        </div>
      ) : (
        <p className="text-[12px] leading-[16px] text-fg-2">
          This unit is {unit.verification_status.toLowerCase()} — the API doesn't allow changes to unit details after verification.
        </p>
      )}
    </Drawer>
  );
}
