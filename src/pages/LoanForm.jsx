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

export default function LoanForm() {
  const navigate = useNavigate();
  const [borrowers, setBorrowers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    borrower_id: '',
    borrower_name: '',
    amount: '',
    interest_rate: '',
    tenure_days: '',
    purpose: '',
    branch: '',
    cluster: '',
    zone: '',
    security_details: '',
    processing_fee: '',
    disbursement_date: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    base44.entities.Borrower.list().then(setBorrowers);
  }, []);

  const amount = parseFloat(form.amount) || 0;
  const rate = parseFloat(form.interest_rate) || 0;
  const days = parseInt(form.tenure_days) || 0;
  const interest = (amount * rate * days) / (100 * 365);
  const totalRepayable = amount + interest;
  const maturityDate = form.disbursement_date && days ? format(addDays(new Date(form.disbursement_date), days), 'yyyy-MM-dd') : '';
  const requiresZonal = amount >= 1000000; // 10 lakhs

  const handleBorrowerChange = (id) => {
    const b = borrowers.find(x => x.id === id);
    setForm(p => ({ ...p, borrower_id: id, borrower_name: b?.business_name || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const loanNumber = `LN-${Date.now().toString().slice(-8)}`;
    const data = {
      ...form,
      amount: amount,
      interest_rate: rate,
      tenure_days: days,
      processing_fee: parseFloat(form.processing_fee) || 0,
      total_repayable: totalRepayable,
      maturity_date: maturityDate,
      loan_number: loanNumber,
      status: 'pending_cluster_approval',
      approval_stage: 'cluster',
    };
    await base44.entities.Loan.create(data);
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
          {/* Borrower */}
          <div className="space-y-1">
            <Label>Borrower / Business <span className="text-destructive">*</span></Label>
            <Select value={form.borrower_id} onValueChange={handleBorrowerChange} required>
              <SelectTrigger><SelectValue placeholder="Select borrower" /></SelectTrigger>
              <SelectContent>
                {borrowers.map(b => <SelectItem key={b.id} value={b.id}>{b.business_name} – {b.owner_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Loan Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Loan Amount (₹) <span className="text-destructive">*</span></Label>
              <Input type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} placeholder="e.g. 500000" required />
            </div>
            <div className="space-y-1">
              <Label>Annual Interest Rate (%) <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.1" value={form.interest_rate} onChange={e => setForm(p => ({...p, interest_rate: e.target.value}))} placeholder="e.g. 18" required />
            </div>
            <div className="space-y-1">
              <Label>Tenure (Days) <span className="text-destructive">*</span></Label>
              <Input type="number" value={form.tenure_days} onChange={e => setForm(p => ({...p, tenure_days: e.target.value}))} placeholder="e.g. 90" required />
            </div>
            <div className="space-y-1">
              <Label>Disbursement Date</Label>
              <Input type="date" value={form.disbursement_date} onChange={e => setForm(p => ({...p, disbursement_date: e.target.value}))} />
            </div>
          </div>

          {/* Loan Summary Box */}
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

          {/* Other fields */}
          <div className="space-y-1">
            <Label>Purpose of Loan</Label>
            <Textarea value={form.purpose} onChange={e => setForm(p => ({...p, purpose: e.target.value}))} rows={2} placeholder="Describe the business purpose…" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1"><Label>Branch</Label><Input value={form.branch} onChange={e => setForm(p => ({...p, branch: e.target.value}))} /></div>
            <div className="space-y-1"><Label>Cluster</Label><Input value={form.cluster} onChange={e => setForm(p => ({...p, cluster: e.target.value}))} /></div>
            <div className="space-y-1"><Label>Zone</Label><Input value={form.zone} onChange={e => setForm(p => ({...p, zone: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Security / Collateral</Label><Input value={form.security_details} onChange={e => setForm(p => ({...p, security_details: e.target.value}))} /></div>
            <div className="space-y-1"><Label>Processing Fee (₹)</Label><Input type="number" value={form.processing_fee} onChange={e => setForm(p => ({...p, processing_fee: e.target.value}))} /></div>
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