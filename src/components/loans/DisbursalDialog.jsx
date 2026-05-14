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
import { formatINR } from '@/lib/mis';
import { Banknote, Loader2, ClipboardPaste } from 'lucide-react';

export default function DisbursalDialog({ loan, open, onOpenChange, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    debit_note_number: '',
    debit_note_date: format(new Date(), 'yyyy-MM-dd'),
    payment_mode: 'bank_transfer',
    debit_note_image_url: '',
    notes: '',
  });

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const pasteField = async (field) => {
    const text = await navigator.clipboard.readText();
    setForm(p => ({ ...p, [field]: text.trim() }));
  };

  const handleSave = async () => {
    setSaving(true);
    const me = await base44.auth.me();
    await base44.entities.Disbursal.create({
      loan_id: loan.id,
      loan_number: loan.loan_number,
      disbursal_id: loan.disbursal_id,
      borrower_name: loan.borrower_name,
      branch: loan.branch,
      cluster: loan.cluster,
      principal: loan.principal,
      bank_name: loan.bank_name,
      account_number: loan.account_number,
      ...form,
      recorded_by: me?.full_name || me?.email || '',
    });
    setSaving(false);
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote size={16} className="text-primary" />
            Record Disbursal — {loan?.borrower_name}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted rounded-lg p-3 text-sm space-y-1 mt-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Disbursal ID</span><span className="font-mono font-semibold">{loan?.disbursal_id || '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span className="font-semibold">{formatINR(loan?.principal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Transfer To</span><span>{loan?.bank_name} · {loan?.account_number}</span></div>
        </div>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Debit Note / UTR No.</Label>
              <div className="flex gap-1">
                <Input value={form.debit_note_number} onChange={set('debit_note_number')} placeholder="e.g. UTR123456" />
                <Button type="button" variant="outline" size="icon" onClick={() => pasteField('debit_note_number')} title="Paste from clipboard">
                  <ClipboardPaste size={14} />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Debit Note Date</Label>
              <Input type="date" value={form.debit_note_date} onChange={set('debit_note_date')} />
            </div>
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
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Upload Debit Note (Bank Screenshot / Scan)</Label>
            <ImageUploadField
              label="Debit Note"
              imageUrl={form.debit_note_image_url}
              onUpload={url => setForm(p => ({ ...p, debit_note_image_url: url }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Any additional notes…" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />}
            {saving ? 'Saving…' : 'Save Disbursal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}