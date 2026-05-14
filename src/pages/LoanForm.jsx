import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import SmartPasteBox from '@/components/loans/SmartPasteBox';
import ImageUploadField from '@/components/loans/ImageUploadField';

function Field({ label, required, children }) {
  return (
    <div className="space-y-1">
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      {children}
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="border-b border-border pb-2 pt-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
    </div>
  );
}

const EMPTY_FORM = {
  borrower_name: '',
  customer_mobile: '',
  amount: '',
  disbursement_date: format(new Date(), 'yyyy-MM-dd'),
  purpose: '',
  branch: '',
  cluster: '',
  zone: '',
  so_name: '',
  value_pledged: '',
  approx_value_offered: '',
  net_weight: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  aadhar_number: '',
  aadhar_image_url: '',
  pan_number: '',
  pan_image_url: '',
  pledge_card_number: '',
  pledge_card_image_url: '',
  security_cheque: '',
  security_cheque_image_url: '',
  security_details: '',
};

export default function LoanForm() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const setVal = (field, value) => setForm(p => ({ ...p, [field]: value }));
  const merge = (obj) => setForm(p => ({ ...p, ...Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '')) }));

  const handleParsed = (parsed) => merge(parsed);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const loanNumber = `LN-${Date.now().toString().slice(-8)}`;
    await base44.entities.Loan.create({
      ...form,
      amount: parseFloat(form.amount) || 0,
      value_pledged: parseFloat(form.value_pledged) || 0,
      net_weight: parseFloat(form.net_weight) || 0,
      loan_number: loanNumber,
      status: 'pending_cluster_approval',
      approval_stage: 'cluster',
    });
    navigate('/loans');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/loans')} className="mb-4 gap-2 text-muted-foreground">
        <ArrowLeft size={16} /> Back
      </Button>

      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="font-syne font-bold text-lg text-foreground mb-6">New Loan Application</h2>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Smart Paste ── */}
          <SmartPasteBox onParsed={handleParsed} />

          {/* ── Customer Details ── */}
          <SectionHeader title="Customer Details" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer Name" required>
              <Input value={form.borrower_name} onChange={set('borrower_name')} placeholder="e.g. Asha" required />
            </Field>
            <Field label="Mobile No.">
              <Input value={form.customer_mobile} onChange={set('customer_mobile')} placeholder="e.g. 99016 66190" />
            </Field>
          </div>

          {/* ── Branch & Officer ── */}
          <SectionHeader title="Branch & Officer" />
          <div className="grid grid-cols-3 gap-4">
            <Field label="Branch Name"><Input value={form.branch} onChange={set('branch')} placeholder="e.g. Shankarpura" /></Field>
            <Field label="Cluster"><Input value={form.cluster} onChange={set('cluster')} /></Field>
            <Field label="Zone"><Input value={form.zone} onChange={set('zone')} /></Field>
          </div>
          <Field label="SO Name (Sales Officer)">
            <Input value={form.so_name} onChange={set('so_name')} placeholder="e.g. Vanishree" />
          </Field>

          {/* ── Pledge / Gold Details ── */}
          <SectionHeader title="Pledge / Gold Details" />
          <div className="grid grid-cols-3 gap-4">
            <Field label="Net Weight (grams)"><Input type="number" step="0.01" value={form.net_weight} onChange={set('net_weight')} placeholder="e.g. 129.88" /></Field>
            <Field label="Value Pledged (₹)"><Input type="number" value={form.value_pledged} onChange={set('value_pledged')} /></Field>
            <Field label="Approx Value Offered"><Input value={form.approx_value_offered} onChange={set('approx_value_offered')} placeholder="e.g. Normal BT" /></Field>
          </div>
          <Field label="Security / Collateral Details">
            <Textarea value={form.security_details} onChange={set('security_details')} rows={2} />
          </Field>

          {/* ── Loan Amount ── */}
          <SectionHeader title="Loan Amount" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount to be Transferred (₹)" required>
              <Input type="number" value={form.amount} onChange={set('amount')} placeholder="e.g. 1086800" required />
            </Field>
            <Field label="Disbursement Date">
              <Input type="date" value={form.disbursement_date} onChange={set('disbursement_date')} />
            </Field>
          </div>

          <Field label="Purpose of Loan">
            <Textarea value={form.purpose} onChange={set('purpose')} rows={2} placeholder="Describe the business purpose…" />
          </Field>

          {/* ── Bank Account Details ── */}
          <SectionHeader title="Bank Account (Transfer To)" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank Name"><Input value={form.bank_name} onChange={set('bank_name')} placeholder="e.g. Canara Bank" /></Field>
            <Field label="Account Number"><Input value={form.account_number} onChange={set('account_number')} placeholder="e.g. 0636101011367" /></Field>
            <Field label="IFSC Code"><Input value={form.ifsc_code} onChange={set('ifsc_code')} placeholder="e.g. CNRB0000636" /></Field>
          </div>

          {/* ── KYC & Documents ── */}
          <SectionHeader title="KYC & Documents" />
          <p className="text-xs text-muted-foreground -mt-2">Upload document images — details will be extracted automatically.</p>

          <div className="grid grid-cols-2 gap-5">
            {/* Aadhar */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <ImageUploadField
                label="Aadhar Card"
                imageUrl={form.aadhar_image_url}
                onUpload={(url) => setVal('aadhar_image_url', url)}
                extractFields={['aadhar_number', 'name']}
                onExtract={(data) => merge({ aadhar_number: data.aadhar_number })}
              />
              <Field label="Aadhar Number">
                <Input value={form.aadhar_number} onChange={set('aadhar_number')} placeholder="Auto-filled or type manually" />
              </Field>
            </div>

            {/* PAN */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <ImageUploadField
                label="PAN Card"
                imageUrl={form.pan_image_url}
                onUpload={(url) => setVal('pan_image_url', url)}
                extractFields={['pan_number', 'name']}
                onExtract={(data) => merge({ pan_number: data.pan_number })}
              />
              <Field label="PAN Number">
                <Input value={form.pan_number} onChange={set('pan_number')} placeholder="Auto-filled or type manually" />
              </Field>
            </div>

            {/* Pledge Card */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <ImageUploadField
                label="Pledge Card"
                imageUrl={form.pledge_card_image_url}
                onUpload={(url) => setVal('pledge_card_image_url', url)}
                extractFields={['pledge_card_number', 'pledge_amount', 'pledge_date']}
                onExtract={(data) => merge({ pledge_card_number: data.pledge_card_number })}
              />
              <Field label="Pledge Card Number">
                <Input value={form.pledge_card_number} onChange={set('pledge_card_number')} placeholder="Auto-filled or type manually" />
              </Field>
            </div>

            {/* Security Cheque */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <ImageUploadField
                label="Security Cheque"
                imageUrl={form.security_cheque_image_url}
                onUpload={(url) => setVal('security_cheque_image_url', url)}
                extractFields={['cheque_number', 'bank_name', 'amount', 'date', 'account_number']}
                onExtract={(data) => merge({ security_cheque: [data.cheque_number, data.bank_name, data.date].filter(Boolean).join(' | ') })}
              />
              <Field label="Cheque Details">
                <Input value={form.security_cheque} onChange={set('security_cheque')} placeholder="Auto-filled or type manually" />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate('/loans')}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit for Approval'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}