// Figma "D·P2a · JIN detail · verify unit (photo gate)" 177:103100 → SideDrawer 177:103185 (480 wide).
// Body: Photo capture "Unit photos" (required) · "Unit details" (Desktop/H3 15/20) · Serial number · Observed make /
// model · Reported fault · Physical condition (Text field 36px box, px-12, radius 12, surface fill, 1px border-strong).
// Footer: Gated action — blocked "Add a photo to continue" + "Take photo" + disabled "Verify & create Job ID";
// ready = "n photos attached" + enabled primary.
// Flow: each picked photo → POST /uploads → POST /equipment-units/{id}/photos { file_uri, file_name, mime_type,
// file_size_bytes } immediately, so the gate reflects what the server holds. Then POST /equipment-units/{id}/verify
// (no body) → { equipment_unit, job }. The DB enforces photo-before-verify too; its message is shown.
// Gaps: G?-B-1 nothing writes serial / make / model / fault / condition (spec note 37:1148) → shown read-only from
// the unit row. G?-B-3 no GET for a unit's photos → the gate counts photos attached in this drawer session.
import { useEffect, useRef, useState } from 'react';
import { IconCamera } from '@tabler/icons-react';
import { FormErrors, GapNote, GatedAction, PhotoPicker, type PickedFile } from '../../../../ui/desktop';
import {
  useAddUnitPhoto, useUpload, useVerifyUnit, type EquipmentUnit, type InwardReceipt, type VerifyUnitResult,
} from '../../api';
import { SideDrawer } from './local';

type Slot = PickedFile & { file: File };

function DetailBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex w-full flex-col items-start gap-[6px]">
      <p className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-fg">{label}</p>
      <div className="flex h-[36px] w-full items-center overflow-clip rounded-t-field border border-line-strong bg-surface px-[12px]" aria-readonly="true">
        <p className={value ? 'truncate text-[14px] leading-[20px] text-fg' : 'text-[14px] leading-[20px] text-fg-muted'}>{value || '—'}</p>
      </div>
    </div>
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
  const upload = useUpload();
  const addPhoto = useAddUnitPhoto(receipt.id);
  const verify = useVerifyUnit(receipt.id);
  const camera = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

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
      patch(key, { state: 'uploaded', progress: 100 });
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

  const attached = slots.filter((s) => s.state === 'uploaded').length;
  const uploading = slots.some((s) => s.state === 'uploading');
  const ready = attached > 0 && !uploading;

  const doVerify = () => verify.mutate(unit.id, { onSuccess: (r) => onVerified(r) });

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      busy={verify.isPending || uploading}
      title={`Verify unit ${unitLabel}`}
      subtitle={`${receipt.jin_number} · ${groupLabel}`}
      footer={
        <div className="flex w-full flex-col gap-[12px]">
          <FormErrors error={verify.error} />
          <GatedAction
            ready={ready}
            reason={uploading ? 'Uploading photo…' : 'Add a photo to continue'}
            readyNote={`${attached} ${attached === 1 ? 'photo' : 'photos'} attached`}
            primaryLabel="Verify & create Job ID"
            onPrimary={doVerify}
            busy={verify.isPending}
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
      <PhotoPicker title="Unit photos" required files={slots} onFiles={take} onRetry={retry} />
      {photoError != null && <FormErrors error={photoError} title="The photo was not attached" />}
      <GapNote code="G?-B-3">The API has no list of a unit's photos, so only photos added here count toward the gate.</GapNote>
      <p className="whitespace-nowrap text-[15px] font-semibold leading-[20px] text-fg">Unit details</p>
      <DetailBox label="Serial number" value={unit.serial_number} />
      <DetailBox
        label="Observed make / model"
        value={[unit.observed_make, unit.observed_model].filter(Boolean).join(' · ') || null}
      />
      <DetailBox label="Reported fault" value={unit.reported_fault} />
      <DetailBox label="Physical condition" value={unit.physical_condition} />
      <GapNote code="G?-B-1">No endpoint writes serial number, make / model, fault or condition (needs PATCH /equipment-units/&#123;id&#125;) — shown read-only.</GapNote>
    </SideDrawer>
  );
}
