import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImageUploadField from '@/components/loans/ImageUploadField';
import { formatINR, calcCharges, calcGST, calcOutstanding } from '@/lib/mis';
import { BadgeCheck, Loader2 } from 'lucide-react';

export default function CollectionDialog({ loan, open, onOpenChange, onSaved }) {
  const [saving, setSaving] = useState(false);
  const charges = calcCharges(loan || {});
  const gst = loan?.gst != null ? loan.gst : calcGST(charges);
  const totalDue = calcOutstanding(loan || {});

  const [form, setForm] = useState({
    amount_collected: totalDue || '',
    principal_component: loan?.principal || '',
    charges_component: charges || '',
    gst_component: gst || '',
    credit_note_number: '',
    credit_note_date: format(new Date(), 'yyyy-MM-dd'),
    payment_mode: 'bank_transfer',
    credit_note_image_url: '',
    close_loan: true,
    closure_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    const me = await base44.auth.me();
    await base44.entities.Collection.create({
      loan_id: loan.id,
      loan_number: loan.loan_number,
      borrower_name: loan.borrower_name,
      branch: loan.branch,
      cluster: loan.cluster,
      ...form,
      amount_collected: parseFloat(form.amount_collected) || 0,
      principal_component: parseFloat(form.principal_component) || 0,
      charges_component: parseFloat(form.charges_component) || 0,
      gst_component: parseFloat(form.gst_component) || 0,
      recorded_by: me?.full_name || me?.email || '',
    });
    // Close loan if checkbox ticked
    if (form.close_loan) {
      await base44.entities.Loan.update(loan.id, {
        status: 'closed',
        closure_date: form.closure_date,
        outstanding: 0,
      });
    }
    setSaving(false);
    onOpenChange(false);
    onSaved?.();
  };

  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck size={16} className="text-green-600" />
            Record Collection — {loan?.borrower_name}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted rounded-lg p-3 text-sm space-y-1 mt-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span className="font-semibold">{formatINR(loan.principal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Charges + GST</span><span>{formatINR(charges + gst)}</span></div>
          <div className="flex justify-between font-bold border-t border-border pt-1 mt-1"><span>Total Due</span><span className="text-red-600">{formatINR(totalDue)}</span></div>
        </div>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount Collected (₹)</Label>
              <Input type="number" value={form.amount_collected} onChange={set('amount_collected')} />
            </div>
            <div className="space-y-1">
              <Label>Credit Note / UTR No.</Label>
              <Input value={form.credit_note_number} onChange={set('credit_note_number')} placeholder="e.g. UTR789012" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Principal (₹)</Label>
              <Input type="number" value={form.principal_component} onChange={set('principal_component')} />
            </div>
            <div className="space-y-1">
              <Label>Charges (₹)</Label>
              <Input type="number" value={form.charges_component} onChange={set('charges_component')} />
            </div>
            <div className="space-y-1">
              <Label>GST (₹)</Label>
              <Input type="number" value={form.gst_component} onChange={set('gst_component')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Credit Note Date</Label>
              <Input type="date" value={form.credit_note_date} onChange={set('credit_note_date')} />
            </div>
            <div className="space-y-1">
              <Label>Payment Mode</Label>
              <Select value={form.payment_mode} onValueChange={v => setForm(p => ({ ...p, payment_mode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="neft">NEFT</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="imps">IMPS</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Upload Credit Note (Bank Screenshot / Scan)</Label>
            <ImageUploadField
              label="Credit Note"
              imageUrl={form.credit_note_image_url}
              onUpload={url => setForm(p => ({ ...p, credit_note_image_url: url }))}
            />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
            <input
              type="checkbox"
              id="close_loan"
              checked={form.close_loan}
              onChange={e => setForm(p => ({ ...p, close_loan: e.target.checked }))}
              className="w-4 h-4 accent-green-600"
            />
            <label htmlFor="close_loan" className="text-sm text-green-800 font-medium">Mark loan as Closed after this collection</label>
            {form.close_loan && (
              <Input type="date" value={form.closure_date} onChange={set('closure_date')} className="ml-auto w-36 h-7 text-xs" />
            )}
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Any additional notes…" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
            {saving ? 'Saving…' : 'Save Collection'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}