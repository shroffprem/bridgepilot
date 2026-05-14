import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, CreditCard, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ui/StatusBadge';

function formatINR(n) {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n?.toLocaleString('en-IN')}`;
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-medium text-foreground">{value || '—'}</div>
    </div>
  );
}

export default function LoanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState(null);
  const [repayments, setRepayments] = useState([]);
  const [repayForm, setRepayForm] = useState({ amount_received: '', payment_date: format(new Date(), 'yyyy-MM-dd'), payment_mode: 'bank_transfer', reference_number: '', notes: '' });
  const [repayOpen, setRepayOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [l, r] = await Promise.all([
      base44.entities.Loan.filter({ id }),
      base44.entities.Repayment.filter({ loan_id: id }),
    ]);
    setLoan(l[0]);
    setRepayments(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleApproveCluster = async () => {
    const requiresZonal = loan.amount >= 1000000;
    const update = requiresZonal
      ? { status: 'pending_zonal_approval', approval_stage: 'zonal', cluster_manager_notes: approveNotes, approved_by_cluster: 'Current User' }
      : { status: 'approved', approval_stage: 'complete', cluster_manager_notes: approveNotes, approved_by_cluster: 'Current User' };
    await base44.entities.Loan.update(id, update);
    setApproveNotes('');
    load();
  };

  const handleApproveZonal = async () => {
    await base44.entities.Loan.update(id, { status: 'approved', approval_stage: 'complete', zonal_manager_notes: approveNotes, approved_by_zonal: 'Current User' });
    setApproveNotes('');
    load();
  };

  const handleReject = async () => {
    await base44.entities.Loan.update(id, { status: 'rejected', rejection_reason: rejectNotes });
    setRejectNotes('');
    load();
  };

  const handleDisburse = async () => {
    await base44.entities.Loan.update(id, { status: 'disbursed' });
    load();
  };

  const handleMarkOverdue = async () => {
    await base44.entities.Loan.update(id, { status: 'overdue' });
    load();
  };

  const handleRepayment = async () => {
    const amount = parseFloat(repayForm.amount_received);
    const interest = ((loan.amount || 0) * (loan.interest_rate || 0) * (loan.tenure_days || 0)) / (100 * 365);
    await base44.entities.Repayment.create({
      ...repayForm,
      loan_id: id,
      loan_number: loan.loan_number,
      borrower_name: loan.borrower_name,
      amount_received: amount,
      principal_component: loan.amount,
      interest_component: interest,
      recorded_by: 'Current User',
    });
    await base44.entities.Loan.update(id, { status: 'repaid' });
    setRepayOpen(false);
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!loan) return <div className="text-muted-foreground py-20 text-center">Loan not found</div>;

  const totalRepaid = repayments.reduce((s, r) => s + (r.amount_received || 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/loans')} className="gap-2 text-muted-foreground"><ArrowLeft size={16} /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="font-syne font-bold text-xl">{loan.borrower_name}</h2>
            <StatusBadge status={loan.status} />
          </div>
          <div className="text-sm text-muted-foreground font-mono">{loan.loan_number}</div>
        </div>
        <div className="flex gap-2">
          {loan.status === 'pending_cluster_approval' && (
            <>
              <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={handleApproveCluster}><CheckCircle2 size={14} /> Approve (Cluster)</Button>
              <Button size="sm" variant="destructive" className="gap-1" onClick={handleReject}><XCircle size={14} /> Reject</Button>
            </>
          )}
          {loan.status === 'pending_zonal_approval' && (
            <>
              <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={handleApproveZonal}><CheckCircle2 size={14} /> Approve (Zonal)</Button>
              <Button size="sm" variant="destructive" className="gap-1" onClick={handleReject}><XCircle size={14} /> Reject</Button>
            </>
          )}
          {loan.status === 'approved' && (
            <Button size="sm" className="gap-1" onClick={handleDisburse}>Mark Disbursed</Button>
          )}
          {loan.status === 'disbursed' && (
            <>
              <Button size="sm" className="gap-1" onClick={() => setRepayOpen(true)}><CreditCard size={14} /> Record Repayment</Button>
              <Button size="sm" variant="destructive" className="gap-1" onClick={handleMarkOverdue}><AlertTriangle size={14} /> Mark Overdue</Button>
            </>
          )}
          {loan.status === 'overdue' && (
            <Button size="sm" className="gap-1" onClick={() => setRepayOpen(true)}><CreditCard size={14} /> Record Repayment</Button>
          )}
        </div>
      </div>

      {/* Loan Details */}
      <div className="bg-card rounded-xl border border-border p-5 grid grid-cols-2 md:grid-cols-4 gap-5">
        <Field label="Principal" value={formatINR(loan.amount)} />
        <Field label="Interest Rate" value={`${loan.interest_rate}% p.a.`} />
        <Field label="Tenure" value={`${loan.tenure_days} days`} />
        <Field label="Total Repayable" value={formatINR(loan.total_repayable)} />
        <Field label="Disbursement Date" value={loan.disbursement_date} />
        <Field label="Maturity Date" value={loan.maturity_date} />
        <Field label="Branch" value={loan.branch} />
        <Field label="Zone" value={loan.zone} />
        <Field label="Purpose" value={loan.purpose} />
        <Field label="Security" value={loan.security_details} />
        <Field label="Processing Fee" value={formatINR(loan.processing_fee)} />
        <Field label="Cluster" value={loan.cluster} />
      </div>

      {/* Approval Notes */}
      {(loan.cluster_manager_notes || loan.zonal_manager_notes || loan.rejection_reason) && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-3">
          <h3 className="font-syne font-semibold text-sm">Approval Notes</h3>
          {loan.cluster_manager_notes && <div className="text-sm"><span className="text-muted-foreground">Cluster: </span>{loan.cluster_manager_notes}</div>}
          {loan.zonal_manager_notes && <div className="text-sm"><span className="text-muted-foreground">Zonal: </span>{loan.zonal_manager_notes}</div>}
          {loan.rejection_reason && <div className="text-sm text-destructive"><span className="font-medium">Rejection reason: </span>{loan.rejection_reason}</div>}
        </div>
      )}

      {/* Approval action notes area */}
      {['pending_cluster_approval', 'pending_zonal_approval'].includes(loan.status) && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-3">
          <Label>Notes (optional)</Label>
          <Textarea value={approveNotes} onChange={e => setApproveNotes(e.target.value)} rows={2} placeholder="Add any notes for your decision…" />
          {loan.status === 'pending_cluster_approval' && (
            <div className="flex gap-2">
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleApproveCluster}>Approve</Button>
              <Button variant="destructive" onClick={handleReject}>Reject</Button>
            </div>
          )}
          {loan.status === 'pending_zonal_approval' && (
            <div className="flex gap-2">
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleApproveZonal}>Approve</Button>
              <Button variant="destructive" onClick={handleReject}>Reject</Button>
            </div>
          )}
        </div>
      )}

      {/* Repayment History */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-syne font-semibold text-sm">Repayment History</h3>
          <div className="text-sm text-muted-foreground">Total received: <span className="font-semibold text-foreground">{formatINR(totalRepaid)}</span></div>
        </div>
        {repayments.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No repayments recorded yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left py-2 font-medium">Date</th>
                <th className="text-right py-2 font-medium">Amount</th>
                <th className="text-left py-2 font-medium">Mode</th>
                <th className="text-left py-2 font-medium">Reference</th>
                <th className="text-left py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {repayments.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-2.5">{r.payment_date}</td>
                  <td className="py-2.5 text-right font-semibold text-green-600">{formatINR(r.amount_received)}</td>
                  <td className="py-2.5 capitalize text-muted-foreground">{r.payment_mode?.replace('_', ' ')}</td>
                  <td className="py-2.5 font-mono text-xs text-muted-foreground">{r.reference_number || '—'}</td>
                  <td className="py-2.5 text-muted-foreground">{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Repayment Dialog */}
      <Dialog open={repayOpen} onOpenChange={setRepayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Repayment</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-muted rounded-lg p-3 text-sm">
              <span className="text-muted-foreground">Total due: </span>
              <span className="font-bold text-foreground">{formatINR(loan.total_repayable)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Amount Received (₹)</Label><Input type="number" value={repayForm.amount_received} onChange={e => setRepayForm(p => ({...p, amount_received: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Payment Date</Label><Input type="date" value={repayForm.payment_date} onChange={e => setRepayForm(p => ({...p, payment_date: e.target.value}))} /></div>
              <div className="space-y-1 col-span-2">
                <Label>Payment Mode</Label>
                <Select value={repayForm.payment_mode} onValueChange={v => setRepayForm(p => ({...p, payment_mode: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['bank_transfer', 'cash', 'cheque', 'upi', 'other'].map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2"><Label>Reference Number</Label><Input value={repayForm.reference_number} onChange={e => setRepayForm(p => ({...p, reference_number: e.target.value}))} /></div>
              <div className="space-y-1 col-span-2"><Label>Notes</Label><Input value={repayForm.notes} onChange={e => setRepayForm(p => ({...p, notes: e.target.value}))} /></div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setRepayOpen(false)}>Cancel</Button>
            <Button onClick={handleRepayment}>Save Repayment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}