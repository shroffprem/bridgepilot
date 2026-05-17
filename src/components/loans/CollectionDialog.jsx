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
import { BadgeCheck, Loader2, ClipboardPaste } from 'lucide-react';

export default function CollectionDialog({ loan, open, onOpenChange, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [noteTab, setNoteTab] = useState('paste'); // 'paste' | 'upload'
  const [pastedImage, setPastedImage] = useState(null);
  const charges = calcCharges(loan || {});
  const gst = loan?.gst != null ? loan.gst : calcGST(charges);
  // Use same charges+gst values for total (not calcOutstanding which may round differently)
  const totalDue = loan?.status === 'closed' ? 0 :
    (loan?.outstanding != null && loan?.outstanding > 0)
      ? loan.outstanding
      : (loan?.principal || 0) + charges + gst;

  const [form, setForm] = useState({
    amount_collected: totalDue || '',
    principal_component: loan?.principal || '',
    charges_component: charges || '',
    gst_component: gst || '',
    penalty_component: 0,
    credit_note_number: '',
    credit_note_date: format(new Date(), 'yyyy-MM-dd'),
    payment_mode: 'bank_transfer',
    credit_note_image_url: '',
    close_loan: true,
    closure_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const amountCollected = parseFloat(form.amount_collected) || 0;
  const isPartPayment = amountCollected > 0 && amountCollected < totalDue;
  const remainingAfter = Math.max(0, totalDue - amountCollected);
  const penaltyAmount = amountCollected > totalDue ? amountCollected - totalDue : 0;

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const pasteField = async (field) => {
    const text = await navigator.clipboard.readText();
    
    // Auto-extract UTR and amount if pasting into credit_note_number
    if (field === 'credit_note_number') {
      try {
        // Extract amount (e.g. "INR 9,55,605.00" or "9,55,605.00" or "955605.00")
        const amountMatch = text.match(/INR\s*([\d,]+\.?\d*)/i) || text.match(/([\d,]+\.?\d*)\s*(?:deposited|transferred|credited)/i);
        if (amountMatch) {
          const cleanAmount = amountMatch[1].replace(/,/g, '');
          setForm(p => ({ ...p, amount_collected: cleanAmount }));
        }
        
        // Extract UTR — for RTGS/NEFT credit notes like:
        // "RTGS Cr-IOBA0000971-VIJAYA-BRIDGELINE PARTNERS-IOBAR52026051600616422"
        // The real UTR is always the LAST hyphen-separated segment (longest alphanumeric token)
        let utr = null;

        // 1. Try the very last hyphen-separated segment (bank credit note format)
        // e.g. "RTGS Cr-IOBA0000971-VIJAYA-BRIDGELINE PARTNERS-IOBAR52026051600616422"
        // Split on hyphens, take the last token (trim whitespace/newlines)
        const segments = text.split('-');
        const lastSeg = segments[segments.length - 1].trim().split(/\s/)[0];
        if (lastSeg && lastSeg.length >= 10 && /^[A-Z0-9]+$/i.test(lastSeg)) {
          utr = lastSeg;
        }

        // 2. Fallback: standard UTR pattern (22-char alphanumeric)
        if (!utr) {
          utr = text.match(/[A-Z]{4}[A-Z0-9]{18}/i)?.[0];
        }

        // 3. Fallback: known bank prefix patterns
        if (!utr) {
          utr = text.match(/(?:CNRB|HDFC|ICIC|AXIS|IDBI|SBI|BKID|UTIB|IDFB|AUBL|IOBA|KKBK)\d+[A-Z0-9]*/i)?.[0];
        }

        if (utr) {
          setForm(p => ({ ...p, [field]: utr.trim() }));
          return;
        }
      } catch {}
    }
    
    setForm(p => ({ ...p, [field]: text.trim() }));
  };

  const handleImagePaste = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'credit_note.png', { type: imageType });
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          setForm(p => ({ ...p, credit_note_image_url: file_url }));
          setPastedImage(file_url);
          return;
        }
      }
      alert('No image found in clipboard. Copy an image first.');
    } catch {
      alert('Could not read clipboard. Please allow clipboard access.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const me = await base44.auth.me();
    const collectionRecord = await base44.entities.Collection.create({
      loan_id: loan.id,
      loan_number: loan.loan_number,
      borrower_name: loan.borrower_name,
      branch: loan.branch,
      cluster: loan.cluster,
      ...form,
      amount_collected: amountCollected,
      principal_component: parseFloat(form.principal_component) || 0,
      charges_component: parseFloat(form.charges_component) || 0,
      gst_component: parseFloat(form.gst_component) || 0,
      penalty_component: parseFloat(form.penalty_component) || 0,
      recorded_by: me?.full_name || me?.email || '',
    });
    if (form.close_loan) {
      // Full closure
      await base44.entities.Loan.update(loan.id, {
        status: 'closed',
        closure_date: form.closure_date,
        outstanding: 0,
      });
      base44.functions.invoke('generateMemo', {
        loan_id: loan.id,
        collection_id: collectionRecord?.id,
      }).catch(() => {});
    } else {
      // Part payment — reduce outstanding
      await base44.entities.Loan.update(loan.id, {
        outstanding: remainingAfter,
      });
    }
    setSaving(false);
    onOpenChange(false);
    onSaved?.();
  };

  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck size={16} className="text-green-600" />
            Record Collection — {loan?.borrower_name}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span className="font-semibold">{formatINR(loan.principal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Charges + GST</span><span>{formatINR(charges + gst)}</span></div>
            <div className="flex justify-between font-bold border-t border-border pt-1 mt-1"><span>Total Due</span><span className="text-red-600">{formatINR(totalDue)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount Collected (₹)</Label>
              <Input
                type="number"
                value={form.amount_collected}
                onChange={e => {
                  const val = e.target.value;
                  const amt = parseFloat(val) || 0;
                  setForm(p => ({
                    ...p,
                    amount_collected: val,
                    penalty_component: amt > totalDue ? parseFloat((amt - totalDue).toFixed(2)) : 0,
                    close_loan: amt >= totalDue ? p.close_loan : false,
                  }));
                }}
              />
              {isPartPayment && (
                <p className="text-xs text-amber-600 font-medium">Part payment — {formatINR(remainingAfter)} will remain outstanding</p>
              )}
              {penaltyAmount > 0 && (
                <p className="text-xs text-purple-700 font-medium">+{formatINR(penaltyAmount)} recorded as penalty</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Credit Note / UTR No.</Label>
              <div className="flex gap-1">
                <Input value={form.credit_note_number} onChange={set('credit_note_number')} placeholder="e.g. UTR789012" />
                <Button type="button" variant="outline" size="icon" onClick={() => pasteField('credit_note_number')} title="Paste from clipboard">
                  <ClipboardPaste size={14} />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
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
            <div className="space-y-1">
              <Label>Penalty (₹)</Label>
              <Input type="number" value={form.penalty_component} onChange={set('penalty_component')}
                className={form.penalty_component > 0 ? 'border-purple-400 bg-purple-50' : ''} />
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

          {/* Credit Note Image — Paste or Upload tabs */}
          <div className="space-y-2">
            <Label>Credit Note (Bank Screenshot)</Label>
            <div className="flex border border-border rounded-lg overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setNoteTab('paste')}
                className={`flex-1 py-1.5 font-medium transition-colors ${noteTab === 'paste' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                Paste Image
              </button>
              <button
                type="button"
                onClick={() => setNoteTab('upload')}
                className={`flex-1 py-1.5 font-medium transition-colors ${noteTab === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                Upload File
              </button>
            </div>
            {noteTab === 'paste' ? (
              <div className="space-y-2">
                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleImagePaste}>
                  <ClipboardPaste size={14} />
                  Paste from Clipboard (Ctrl+V / Cmd+V screenshot)
                </Button>
                {(pastedImage || form.credit_note_image_url) && (
                  <div className="relative">
                    <img src={pastedImage || form.credit_note_image_url} alt="Credit Note" className="w-full rounded-lg border border-border max-h-32 object-contain bg-muted" />
                    <button
                      type="button"
                      onClick={() => { setPastedImage(null); setForm(p => ({ ...p, credit_note_image_url: '' })); }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded"
                    >Remove</button>
                  </div>
                )}
              </div>
            ) : (
              <ImageUploadField
                label="Credit Note"
                imageUrl={form.credit_note_image_url}
                onUpload={url => { setForm(p => ({ ...p, credit_note_image_url: url })); setPastedImage(url); }}
              />
            )}
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

        {/* Sticky footer */}
        <div className="flex justify-end gap-2 pt-3 border-t border-border shrink-0">
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