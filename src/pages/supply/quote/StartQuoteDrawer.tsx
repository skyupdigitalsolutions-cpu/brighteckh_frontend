// PQ0 · Start quote drawer (PURCHASE). Not drawn in PS-D: Purchase must create the quote from an enquiry
// (POST /sales-quotes {enquiry_id, validity_until, payment_terms?, delivery_terms?, warranty_terms?, tax_terms?,
// currency_code?}) before PQ1 can price it. Built from the kit drawer + the PQ1 "Revision terms" fields (238:45661).
// Enquiry picker = RECEIVED enquiries from GET /sales-supply/enquiries?status=RECEIVED&search=.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCheck } from '@tabler/icons-react';
import { enumLabel } from '../../../lib/format';
import { Button, DateField, Drawer, FieldRow, FormErrors, Ic, LookupPicker, TextInput, type LookupSource } from '../../../ui/desktop';
import { supplyApi, useEnquiries, useSupplyMutation, type CreateQuoteBody, type EnquiryRow } from '../api';

const enquirySource: LookupSource<EnquiryRow> = {
  useSearch: (search, enabled) => useEnquiries({ status: ['RECEIVED'], page_size: 25, ...(search ? { search } : {}) }, enabled),
  useResolve: () => ({ data: {}, isPending: false, isFetching: false, isError: false, error: null, refetch: () => undefined }),
  getId: (r) => r.id,
  getLabel: (r) => `${r.enquiry_number} · ${r.customer_name}`,
  getSub: (r) => `${r.line_count} line${r.line_count === 1 ? '' : 's'} · ${enumLabel(r.enquiry_channel)}`,
  noun: 'received enquiries',
};

export function StartQuoteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [enquiry, setEnquiry] = useState<string | null>(null);
  const [validity, setValidity] = useState('');
  const [payment, setPayment] = useState('');
  const [delivery, setDelivery] = useState('');
  const [warranty, setWarranty] = useState('');
  const [tax, setTax] = useState('');
  const [tried, setTried] = useState(false);
  const m = useSupplyMutation((b: CreateQuoteBody) => supplyApi.createQuote(b));
  const reset = () => { setEnquiry(null); setValidity(''); setPayment(''); setDelivery(''); setWarranty(''); setTax(''); setTried(false); m.reset(); };
  const close = () => { reset(); onClose(); };
  const submit = () => {
    setTried(true);
    if (!enquiry || !validity) return;
    m.mutate({
      enquiry_id: enquiry,
      validity_until: validity,
      currency_code: 'INR',
      ...(payment.trim() ? { payment_terms: payment.trim() } : {}),
      ...(delivery.trim() ? { delivery_terms: delivery.trim() } : {}),
      ...(warranty.trim() ? { warranty_terms: warranty.trim() } : {}),
      ...(tax.trim() ? { tax_terms: tax.trim() } : {}),
    }, { onSuccess: (qd) => { reset(); onClose(); nav(`/p/supply/quotes/${qd.id}`); } });
  };
  return (
    <Drawer
      open={open}
      onClose={close}
      busy={m.isPending}
      bodyGap={16}
      title="Start quote"
      subtitle="Number SQ-BLR-###### is assigned when you save · revision 0 starts as DRAFT"
      onSubmit={submit}
      footer={(
        <>
          <Button kind="secondary" onClick={close} disabled={m.isPending}>Cancel</Button>
          <Button kind="primary" type="submit" busy={m.isPending} icon={<Ic icon={IconCheck} size={18} />}>Start quote</Button>
        </>
      )}
    >
      <LookupPicker
        label="Enquiry *"
        helper="RECEIVED enquiries from Sales"
        placeholder="Search enquiry number or customer"
        value={enquiry}
        onChange={(id) => setEnquiry(id)}
        source={enquirySource}
        error={tried && !enquiry ? 'Choose the enquiry to price.' : null}
      />
      <DateField label="Valid until *" value={validity} onChange={(e) => setValidity(e.target.value)} error={tried && !validity ? 'Required' : null} />
      <FieldRow gap={12}>
        <TextInput label="Payment terms" value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="30 days from invoice" />
        <TextInput label="Delivery terms" value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="Ex-works Bengaluru · 5 days" />
      </FieldRow>
      <FieldRow gap={12}>
        <TextInput label="Warranty" value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="6 months" />
        <TextInput label="Tax terms" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="GST extra as applicable" />
      </FieldRow>
      <FormErrors error={m.error} title="The quote wasn't started" />
    </Drawer>
  );
}
