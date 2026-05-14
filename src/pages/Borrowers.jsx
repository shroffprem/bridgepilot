import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, Phone, MapPin, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const businessTypes = ['sole_proprietorship', 'partnership', 'private_limited', 'llp', 'other'];
const empty = { business_name: '', owner_name: '', phone: '', email: '', address: '', business_type: '', gst_number: '', pan_number: '', annual_turnover: '', years_in_business: '', branch: '', notes: '' };

export default function Borrowers() {
  const [borrowers, setBorrowers] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => base44.entities.Borrower.list('-created_date').then(b => { setBorrowers(b); setLoading(false); });
  useEffect(() => { load(); }, []);

  const filtered = borrowers.filter(b =>
    b.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.phone?.includes(search)
  );

  const handleSave = async () => {
    const data = { ...form, annual_turnover: Number(form.annual_turnover) || 0, years_in_business: Number(form.years_in_business) || 0 };
    if (editing) {
      await base44.entities.Borrower.update(editing, data);
    } else {
      await base44.entities.Borrower.create(data);
    }
    setOpen(false);
    setForm(empty);
    setEditing(null);
    load();
  };

  const openEdit = (b) => { setForm({ ...b }); setEditing(b.id); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search borrowers…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => { setForm(empty); setEditing(null); setOpen(true); }} className="gap-2">
          <Plus size={16} /> Add Borrower
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Building2 size={40} className="mb-3 opacity-30" />
              <p>No borrowers found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Business</th>
                  <th className="text-left px-5 py-3 font-medium">Owner</th>
                  <th className="text-left px-5 py-3 font-medium">Phone</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium">Branch</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-foreground">{b.business_name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{b.owner_name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{b.phone}</td>
                    <td className="px-5 py-3.5 text-muted-foreground capitalize">{b.business_type?.replace('_', ' ')}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{b.branch || '—'}</td>
                    <td className="px-5 py-3.5">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(b)} className="h-7 text-xs">Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Borrower' : 'Add Borrower'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            {[['business_name','Business Name'], ['owner_name','Owner Name'], ['phone','Phone'], ['email','Email'], ['gst_number','GST Number'], ['pan_number','PAN Number'], ['branch','Branch'], ['annual_turnover','Annual Turnover (₹)'], ['years_in_business','Years in Business']].map(([k, l]) => (
              <div key={k}>
                <Label className="text-xs mb-1">{l}</Label>
                <Input value={form[k] || ''} onChange={e => setForm(p => ({...p, [k]: e.target.value}))} />
              </div>
            ))}
            <div>
              <Label className="text-xs mb-1">Business Type</Label>
              <Select value={form.business_type} onValueChange={v => setForm(p => ({...p, business_type: v}))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {businessTypes.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1">Address</Label>
              <Input value={form.address || ''} onChange={e => setForm(p => ({...p, address: e.target.value}))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1">Notes</Label>
              <Input value={form.notes || ''} onChange={e => setForm(p => ({...p, notes: e.target.value}))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Save Changes' : 'Add Borrower'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}