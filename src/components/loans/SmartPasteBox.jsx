import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wand2, X } from 'lucide-react';

// Extracts value after a label, ignoring case and common separators
function extract(text, patterns) {
  for (const pattern of patterns) {
    const re = new RegExp(pattern + '[\\s:：\\-]*([^\\n]+)', 'i');
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return '';
}

function extractNumber(text, patterns) {
  const val = extract(text, patterns);
  const num = parseFloat(val.replace(/[,₹\s]/g, ''));
  return isNaN(num) ? '' : String(num);
}

export function parseApplicationText(raw) {
  const text = raw;
  return {
    borrower_name:       extract(text, ['customer\\s*name', 'name']),
    customer_mobile:     extract(text, ['mobile\\s*no', 'mobile', 'phone']).replace(/\s+/g, ''),
    branch:              extract(text, ['branch\\s*name', 'branch']),
    so_name:             extract(text, ['so\\s*name', 'so:', 'so ']),
    value_pledged:       extractNumber(text, ['value\\s*pledged']),
    approx_value_offered: extract(text, ['approx\\s*value\\s*offered.*?charges?', 'approx\\s*value']),
    account_number:      extract(text, ['a\\/c\\s*number', 'account\\s*number', 'a\\/c\\s*no']).replace(/\s+/g, ''),
    ifsc_code:           extract(text, ['ifsc\\s*code', 'ifsc']).replace(/\s+/g, ''),
    bank_name:           extract(text, ['bank\\s*name', 'bank']),
    amount:              extractNumber(text, ['amount\\s*to\\s*be\\s*transferred', 'amount\\s*transferred', 'amount']),
    net_weight:          extractNumber(text, ['net\\s*wt', 'net\\s*weight']),
  };
}

export default function SmartPasteBox({ onParsed }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');

  const handleParse = () => {
    const parsed = parseApplicationText(raw);
    onParsed(parsed);
    setOpen(false);
    setRaw('');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary hover:border-primary hover:bg-accent transition-colors text-sm font-medium"
      >
        <Wand2 size={16} />
        Paste application details to auto-fill form
      </button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-primary/60 bg-accent/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-accent-foreground flex items-center gap-2"><Wand2 size={15} /> Paste Application Details</span>
        <button type="button" onClick={() => setOpen(false)}><X size={15} className="text-muted-foreground" /></button>
      </div>
      <Textarea
        value={raw}
        onChange={e => setRaw(e.target.value)}
        rows={8}
        placeholder={"Paste the full application text here, e.g.:\n\nCustomer name: Asha\nMobile no: 99016 66190\nBranch name: Shankarpura\nSO Name: Vanishree\nNet wt: 129.88\nAmount to be transferred: 1086800\nIFSC code: CNRB0000636\nA/c number: 0636101011367\nBank name: Canara Bank"}
        className="text-xs font-mono"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="button" size="sm" onClick={handleParse} disabled={!raw.trim()}>
          <Wand2 size={14} /> Auto-fill Fields
        </Button>
      </div>
    </div>
  );
}