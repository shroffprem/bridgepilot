import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calculator } from 'lucide-react';
import SmartPasteBox from '@/components/loans/SmartPasteBox';
import ImageUploadField from '@/components/loans/ImageUploadField';
import { formatINR, calcGST } from '@/lib/mis';

function Field({ label, required, children }) {
  return (
    <div className="space-y-1">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
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

const COMPANIES = [
  'HDB Financials',
  'ICICI Bank',
];

const EMPTY_FORM = {
  company: '',
  borrower_name: '',
  customer_mobile: '',
  principal: '',
  rate: '0.5',
  charges: '',
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
  const { user, isBranchManager } = useCurrentUser();

  // Pre-fill branch/cluster for branch managers
  useEffect(() => {
    if (isBranchManager && user) {
      setForm(p => ({
        ...p,
        branch: user.branch || p.branch,
        cluster: user.cluster || p.cluster,
      }));
    }
  }, [isBranchManager, user]);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const setVal = (field, value) => setForm(p => ({ ...p, [field]: value }));
  const merge = (obj) => setForm(p => ({ ...p, ...Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '')) }));

  const principal = parseFloat(form.principal) || 0;
  const rate = parseFloat(form.rate) || 0;
  // Charges = principal * rate / 100 (fixed at disbursement)
  const autoCharges = rate > 0 ? principal * rate / 100 : parseFloat(form.charges) || 0;
  const charges = rate > 0 ? autoCharges : parseFloat(form.charges) || 0;
  const gst = calcGST(charges);
  const outstanding = principal + charges + gst;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ts = Date.now().toString().slice(-8);
    const loanNumber = `BLP-${ts}`;
    const dateStr = format(new Date(), 'ddMMyy');
    const disbursalId = `BLP/${dateStr}/${ts}`;
    const me = await base44.auth.me();
    const myRole = me?.role;
    // Branch managers & above skip branch stage; SOs/others start at branch approval
    const initialStatus = (myRole === 'branch_manager')
      ? 'pending_cluster_approval'
      : 'pending_branch_approval';
    const initialStage = (myRole === 'branch_manager') ? 'cluster' : 'branch';

    await base44.entities.Loan.create({
      ...form,
      principal,
      rate: parseFloat(form.rate) || 0,
      charges,
      gst,
      outstanding,
      value_pledged: parseFloat(form.value_pledged) || 0,
      net_weight: parseFloat(form.net_weight) || 0,
      loan_number: loanNumber,
      disbursal_id: disbursalId,
      status: initialStatus,
      approval_stage: initialStage,
      submitted_by: me?.full_name || me?.email || '',
    });
    navigate('/loans');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/loans')} className="mb-4 gap-2 text-muted-foreground">
        <ArrowLeft size={16} /> Back
      </Button>

      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="font-syne font-bold text-lg text-foreground mb-6">New Loan Application — BridgeLine Partners</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <SmartPasteBox onParsed={merge} />

          {/* Company */}
          <SectionHeader title="Partner Company" />
          <Field label="Company / Lender" required>
            <select
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.company}
              onChange={set('company')}
              required
            >
              <option value="">Select company…</option>
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          {/* Customer */}
          <SectionHeader title="Customer Details" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer Name">
              <Input value={form.borrower_name} onChange={set('borrower_name')} placeholder="e.g. Pavana Kumara" />
            </Field>
            <Field label="Mobile No.">
              <Input value={form.customer_mobile} onChange={set('customer_mobile')} placeholder="e.g. 98451 22023" />
            </Field>
          </div>

          {/* Branch & Officer */}
          <SectionHeader title="Branch & Officer" />
          <div className="grid grid-cols-3 gap-4">
            <Field label="Branch"><Input value={form.branch} onChange={set('branch')} placeholder="e.g. Vijay Nagar" /></Field>
            <Field label="Cluster"><Input value={form.cluster} onChange={set('cluster')} placeholder="e.g. Mysore" /></Field>
            <Field label="Zone"><Input value={form.zone} onChange={set('zone')} /></Field>
          </div>
          <Field label="SO / Handled By">
            <Input value={form.so_name} onChange={set('so_name')} placeholder="e.g. Vanishree" />
          </Field>

          {/* Pledge */}
          <SectionHeader title="Pledge / Gold Details" />
          <div className="grid grid-cols-3 gap-4">
            <Field label="Net Weight (g)"><Input type="number" step="0.01" value={form.net_weight} onChange={set('net_weight')} placeholder="e.g. 129.88" /></Field>
            <Field label="Value Pledged (₹)"><Input type="number" value={form.value_pledged} onChange={set('value_pledged')} /></Field>
            <Field label="Approx Value Offered"><Input value={form.approx_value_offered} onChange={set('approx_value_offered')} placeholder="e.g. Normal BT" /></Field>
          </div>
          <Field label="Security / Collateral Details">
            <Textarea value={form.security_details} onChange={set('security_details')} rows={2} />
          </Field>

          {/* Loan Terms */}
          <SectionHeader title="Loan Terms" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Principal (₹)" required>
              <Input type="number" value={form.principal} onChange={set('principal')} placeholder="e.g. 500000" required />
            </Field>
            <Field label="Disbursement Date">
              <Input type="date" value={form.disbursement_date} onChange={set('disbursement_date')} />
            </Field>
            <Field label="Charge Rate (% of principal)">
              <Input type="number" step="0.01" value={form.rate} onChange={set('rate')} placeholder="e.g. 0.50" />
            </Field>
            <Field label="Fixed Charges (₹) — if rate not used">
              <Input type="number" value={form.charges} onChange={set('charges')} placeholder="Auto-calculated from rate" disabled={rate > 0} />
            </Field>
          </div>

          {principal > 0 && (charges > 0 || rate > 0) && (
            <div className="bg-accent rounded-xl p-4">
              <div className="flex items-center gap-2 text-accent-foreground font-semibold text-sm mb-3">
                <Calculator size={15} /> Case Summary
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span className="font-medium">{formatINR(principal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Charges</span><span className="font-medium">{formatINR(charges)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span className="font-medium">{formatINR(gst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Outstanding</span><span className="font-bold text-primary">{formatINR(outstanding)}</span></div>
              </div>
            </div>
          )}

          <Field label="Purpose of Loan">
            <Textarea value={form.purpose} onChange={set('purpose')} rows={2} placeholder="Describe the business purpose…" />
          </Field>

          {/* Bank Account */}
          <SectionHeader title="Bank Account (Transfer To)" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank Name"><Input value={form.bank_name} onChange={set('bank_name')} placeholder="e.g. Canara Bank" /></Field>
            <Field label="Account Number"><Input value={form.account_number} onChange={set('account_number')} /></Field>
            <Field label="IFSC Code"><Input value={form.ifsc_code} onChange={set('ifsc_code')} placeholder="e.g. CNRB0000636" /></Field>
          </div>

          {/* KYC */}
          <SectionHeader title="KYC & Documents" />
          <p className="text-xs text-muted-foreground -mt-2">Upload document images — details will be extracted automatically.</p>
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <ImageUploadField label="Aadhar Card" imageUrl={form.aadhar_image_url} onUpload={url => setVal('aadhar_image_url', url)}
                extractFields={['aadhar_number', 'name']} onExtract={d => merge({ aadhar_number: d.aadhar_number })} />
              <Field label="Aadhar Number"><Input value={form.aadhar_number} onChange={set('aadhar_number')} placeholder="Auto-filled or type manually" /></Field>
            </div>
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <ImageUploadField label="PAN Card" imageUrl={form.pan_image_url} onUpload={url => setVal('pan_image_url', url)}
                extractFields={['pan_number', 'name']} onExtract={d => merge({ pan_number: d.pan_number })} />
              <Field label="PAN Number"><Input value={form.pan_number} onChange={set('pan_number')} placeholder="Auto-filled or type manually" /></Field>
            </div>
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <ImageUploadField label="Pledge Card" imageUrl={form.pledge_card_image_url} onUpload={url => setVal('pledge_card_image_url', url)}
                extractFields={['pledge_card_number', 'pledge_amount', 'pledge_date']} onExtract={d => merge({ pledge_card_number: d.pledge_card_number })} />
              <Field label="Pledge Card Number"><Input value={form.pledge_card_number} onChange={set('pledge_card_number')} placeholder="Auto-filled or type manually" /></Field>
            </div>
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <ImageUploadField label="Security Cheque" imageUrl={form.security_cheque_image_url} onUpload={url => setVal('security_cheque_image_url', url)}
                extractFields={['cheque_number', 'bank_name', 'amount', 'date', 'account_number']}
                onExtract={d => merge({ security_cheque: [d.cheque_number, d.bank_name, d.date].filter(Boolean).join(' | ') })} />
              <Field label="Cheque Details"><Input value={form.security_cheque} onChange={set('security_cheque')} placeholder="Auto-filled or type manually" /></Field>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate('/loans')}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Case'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}