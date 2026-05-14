import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calculator } from 'lucide-react';

function formatINR(n) {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n?.toLocaleString('en-IN')}`;
}

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

export default function LoanForm() {
  const navigate = useNavigate();
  const [borrowers, setBorrowers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    borrower_id: '',
    borrower_name: '',
    customer_mobile: '',
    amount: '',
    interest_rate: '',
    tenure_days: '',
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
    pan_number: '',
    pledge_card_number: '',
    security_cheque: '',
    security_details: '',
    processing_fee: '',
  });

  useEffect(() => {
    base44.entities.Borrower.list().then(setBorrowers);
  }, []);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const amount = parseFloat(form.amount) || 0;
  const rate = parseFloat(form.interest_rate) || 0;
  const days = parseInt(form.tenure_days) || 0;
  const interest = (amount * rate * days) / (100 * 365);
  const totalRepayable = amount + interest;
  const maturityDate = form.disbursement_date && days ? format(addDays(new Date(form.disbursement_date), days), 'yyyy-MM-dd') : '';
  const requiresZonal = amount >= 1000000;

  const handleBorrowerChange = (id) => {
    const b = borrowers.find(x => x.id === id);
    setForm(p => ({ ...p, borrower_id: id, borrower_name: b?.business_name || '', customer_mobile: b?.phone || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const loanNumber = `LN-${Date.now().toString().slice(-8)}`;
    await base44.entities.Loan.create({
      ...form,
      amount,
      interest_rate: rate,
      tenure_days: days,
      processing_fee: parseFloat(form.processing_fee) || 0,
      value_pledged: parseFloat(form.value_pledged) || 0,
      net_weight: parseFloat(form.net_weight) || 0,
      total_repayable: totalRepayable,
      maturity_date: maturityDate,
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

          {/* ── Customer Details ── */}
          <SectionHeader title="Customer Details" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer Name" required>
              <Select value={form.borrower_id} onValueChange={handleBorrowerChange} required>
                <SelectTrigger><SelectValue placeholder="Select borrower" /></SelectTrigger>
                <SelectContent>
                  {borrowers.map(b => <SelectItem key={b.id} value={b.id}>{b.business_name} – {b.owner_name}</SelectItem>)}
                </SelectContent>
              </Select>
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="SO Name (Sales Officer)"><Input value={form.so_name} onChange={set('so_name')} placeholder="e.g. Vanishree" /></Field>
            <Field label="Processing Fee (₹)"><Input type="number" value={form.processing_fee} onChange={set('processing_fee')} /></Field>
          </div>

          {/* ── Pledge / Gold Details ── */}
          <SectionHeader title="Pledge / Gold Details" />
          <div className="grid grid-cols-3 gap-4">
            <Field label="Net Weight (grams)"><Input type="number" step="0.01" value={form.net_weight} onChange={set('net_weight')} placeholder="e.g. 129.88" /></Field>
            <Field label="Value Pledged (₹)"><Input type="number" value={form.value_pledged} onChange={set('value_pledged')} /></Field>
            <Field label="Approx Value Offered (with charges)"><Input value={form.approx_value_offered} onChange={set('approx_value_offered')} placeholder="e.g. Normal BT" /></Field>
          </div>
          <div className="space-y-1">
            <Label>Security / Collateral Details</Label>
            <Textarea value={form.security_details} onChange={set('security_details')} rows={2} />
          </div>

          {/* ── Loan Terms ── */}
          <SectionHeader title="Loan Terms" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount to be Transferred (₹)" required>
              <Input type="number" value={form.amount} onChange={set('amount')} placeholder="e.g. 1086800" required />
            </Field>
            <Field label="Annual Interest Rate (%)" required>
              <Input type="number" step="0.1" value={form.interest_rate} onChange={set('interest_rate')} placeholder="e.g. 18" required />
            </Field>
            <Field label="Tenure (Days)" required>
              <Input type="number" value={form.tenure_days} onChange={set('tenure_days')} placeholder="e.g. 90" required />
            </Field>
            <Field label="Disbursement Date">
              <Input type="date" value={form.disbursement_date} onChange={set('disbursement_date')} />
            </Field>
          </div>

          {/* Loan Summary */}
          {amount > 0 && rate > 0 && days > 0 && (
            <div className="bg-accent rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-accent-foreground font-semibold text-sm mb-3">
                <Calculator size={15} /> Loan Summary
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span className="font-medium">{formatINR(amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Interest</span><span className="font-medium">{formatINR(interest)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Maturity Date</span><span className="font-medium">{maturityDate}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Repayable</span><span className="font-bold text-primary">{formatINR(totalRepayable)}</span></div>
              </div>
              {requiresZonal && (
                <div className="mt-2 text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg p-2">
                  ⚠ Loan amount exceeds ₹10L — requires Zonal Manager approval
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label>Purpose of Loan</Label>
            <Textarea value={form.purpose} onChange={set('purpose')} rows={2} placeholder="Describe the business purpose…" />
          </div>

          {/* ── Bank Account Details ── */}
          <SectionHeader title="Bank Account (Transfer To)" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank Name"><Input value={form.bank_name} onChange={set('bank_name')} placeholder="e.g. Canara Bank" /></Field>
            <Field label="Account Number"><Input value={form.account_number} onChange={set('account_number')} placeholder="e.g. 0636101011367" /></Field>
            <Field label="IFSC Code"><Input value={form.ifsc_code} onChange={set('ifsc_code')} placeholder="e.g. CNRB0000636" /></Field>
          </div>

          {/* ── KYC & Documents ── */}
          <SectionHeader title="KYC & Documents" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Aadhar Number"><Input value={form.aadhar_number} onChange={set('aadhar_number')} placeholder="XXXX XXXX XXXX" /></Field>
            <Field label="PAN Number"><Input value={form.pan_number} onChange={set('pan_number')} placeholder="ABCDE1234F" /></Field>
            <Field label="Pledge Card Number"><Input value={form.pledge_card_number} onChange={set('pledge_card_number')} /></Field>
            <Field label="Security Cheque Details"><Input value={form.security_cheque} onChange={set('security_cheque')} placeholder="Cheque no., bank, date…" /></Field>
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