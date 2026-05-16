import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY = {
  name: '', type: 'lender', cin: '', gstin: '',
  registered_address: '', operational_address: '', website: '',
  primary_contact_name: '', primary_contact_phone: '', primary_contact_email: '',
  notes: '',
};

function Field({ label, required, children }) {
  return (
    <div className="space-y-1">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

export default function CompanyForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));
  const setVal = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Company Name" required>
          <Input value={form.name} onChange={set('name')} placeholder="e.g. HDB Financials" required />
        </Field>
        <Field label="Type">
          <Select value={form.type} onValueChange={v => setVal('type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lender">Lender</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="nbfc">NBFC</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="CIN">
          <Input value={form.cin} onChange={set('cin')} placeholder="Corporate ID No." />
        </Field>
        <Field label="GSTIN">
          <Input value={form.gstin} onChange={set('gstin')} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Primary Contact Name">
          <Input value={form.primary_contact_name} onChange={set('primary_contact_name')} />
        </Field>
        <Field label="Primary Contact Phone">
          <Input value={form.primary_contact_phone} onChange={set('primary_contact_phone')} />
        </Field>
        <Field label="Primary Contact Email">
          <Input type="email" value={form.primary_contact_email} onChange={set('primary_contact_email')} />
        </Field>
        <Field label="Website">
          <Input value={form.website} onChange={set('website')} placeholder="https://..." />
        </Field>
      </div>

      <Field label="Registered Address">
        <Textarea value={form.registered_address} onChange={set('registered_address')} rows={2} />
      </Field>
      <Field label="Operational Address">
        <Textarea value={form.operational_address} onChange={set('operational_address')} rows={2} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={set('notes')} rows={2} />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update Company' : 'Add Company'}</Button>
      </div>
    </form>
  );
}