// Figma "JIN-00033 · Add equipment group (drawer)" 177:108542 → kit Drawer (177:108580, 520 wide).
// Body 177:108587: Equipment (assembly)* picker slot + "Only APPROVED / ACTIVE assemblies" · Quantity received*
// stepper (44px square buttons, 1px border-strong, radius 14, gap 10; value 90 wide, Data/Number strong 14/20 mono
// SemiBold) + helper · Customer DC line (mono). Footer: Cancel + "Add group".
// POST /inward-receipts/{id}/equipment-groups (CreateEquipmentGroupDto: assembly_id, quantity_received, customer_dc_line?).
// G19: equipment groups reference `assemblies`, which has no list endpoint (/masters/assemblies is a different
// table) → the slot takes the assembly UUID + GapNote.
import { useState } from 'react';
import { Button, Drawer, Field, FormErrors, GapNote, TextInput } from '../../../../ui/desktop';
import { useAddEquipmentGroup, type InwardReceipt } from '../../api';
import { isUuid } from './local';

export function AddGroupDrawer({ open, onClose, receipt }: { open: boolean; onClose: () => void; receipt: InwardReceipt }) {
  const [assembly, setAssembly] = useState('');
  const [qty, setQty] = useState('1');
  const [dcLine, setDcLine] = useState('');
  const [touched, setTouched] = useState(false);
  const add = useAddEquipmentGroup(receipt.id);

  const n = /^\d+$/.test(qty.trim()) ? Number(qty.trim()) : NaN;
  const errs = {
    assembly: !assembly.trim() ? 'Enter the assembly ID' : !isUuid(assembly) ? 'Assembly ID is a UUID' : null,
    qty: !Number.isInteger(n) || n < 1 ? 'Enter a whole number of units, 1 or more' : null,
  };
  const reset = () => { setAssembly(''); setQty('1'); setDcLine(''); setTouched(false); add.reset(); };
  const close = () => { reset(); onClose(); };

  const submit = () => {
    setTouched(true);
    if (errs.assembly || errs.qty) return;
    add.mutate(
      { assembly_id: assembly.trim(), quantity_received: n, ...(dcLine.trim() ? { customer_dc_line: dcLine.trim() } : {}) },
      { onSuccess: () => { reset(); onClose(); } },
    );
  };
  const step = (d: number) => setQty((q) => String(Math.max(1, (Number.isInteger(Number(q)) ? Number(q) : 1) + d)));

  return (
    <Drawer
      open={open}
      onClose={close}
      busy={add.isPending}
      title="Add equipment group"
      subtitle={receipt.jin_number}
      onSubmit={submit}
      footer={
        <>
          <Button kind="secondary" onClick={close} disabled={add.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={add.isPending}>Add group</Button>
        </>
      }
    >
      <TextInput
        label="Equipment (assembly) *"
        mono
        autoFocus
        placeholder="Assembly ID (UUID)"
        value={assembly}
        onChange={(e) => setAssembly(e.target.value)}
        error={touched ? errs.assembly : null}
        helper="Only APPROVED / ACTIVE assemblies"
      />
      <GapNote code="G19">No list of customer-equipment assemblies in the API — enter the assembly ID.</GapNote>
      <Field
        label="Quantity received *"
        error={touched ? errs.qty : null}
        helper="Each unit becomes its own record — and later its own Job ID."
      >
        <div className="flex items-center gap-[10px] overflow-clip">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => step(-1)}
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-clip rounded-[14px] border border-line-strong text-[18px] font-semibold leading-[24px] text-fg hover:bg-subtle"
          >
            −
          </button>
          <input
            aria-label="Quantity received"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-[90px] shrink-0 bg-transparent text-center font-mono text-[14px] font-semibold leading-[20px] text-fg focus:outline-none"
          />
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => step(1)}
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-clip rounded-[14px] border border-line-strong text-[18px] font-semibold leading-[24px] text-fg hover:bg-subtle"
          >
            +
          </button>
        </div>
      </Field>
      <TextInput label="Customer DC line" mono placeholder="Line 1" value={dcLine} onChange={(e) => setDcLine(e.target.value)} />
      <FormErrors error={add.error} />
    </Drawer>
  );
}
