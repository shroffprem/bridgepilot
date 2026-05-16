import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Building2, Phone, Mail, Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CompanyForm from './CompanyForm';

const TYPE_STYLES = {
  lender:  'bg-blue-100 text-blue-800',
  bank:    'bg-green-100 text-green-800',
  nbfc:    'bg-purple-100 text-purple-800',
  partner: 'bg-yellow-100 text-yellow-800',
  other:   'bg-gray-100 text-gray-600',
};

export default function CompaniesTab() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const fetch = () => {
    base44.entities.Company.list().then(c => { setCompanies(c); setLoading(false); });
  };
  useEffect(fetch, []);

  const handleSave = async (form) => {
    if (editing) {
      await base44.entities.Company.update(editing.id, form);
    } else {
      await base44.entities.Company.create(form);
    }
    setShowForm(false);
    setEditing(null);
    fetch();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this company?')) return;
    await base44.entities.Company.delete(id);
    fetch();
  };

  const openEdit = (c) => { setEditing(c); setShowForm(true); };
  const openAdd = () => { setEditing(null); setShowForm(true); };

  if (loading) return <div className="flex justify-center py-12"><div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus size={15} /> Add Company
        </Button>
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No companies yet. Add your first partner.</div>
      ) : (
        <div className="grid gap-3">
          {companies.map(c => (
            <div key={c.id} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.gstin || c.cin || 'No registration details'}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLES[c.type] || TYPE_STYLES.other}`}>
                  {c.type}
                </span>
                <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                    <Pencil size={13} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>

              {/* Expanded details */}
              {expanded === c.id && (
                <div className="border-t border-border px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm bg-muted/10">
                  {c.primary_contact_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs w-28 shrink-0">Contact</span>
                      <span className="font-medium">{c.primary_contact_name}</span>
                    </div>
                  )}
                  {c.primary_contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="text-muted-foreground shrink-0" />
                      <span>{c.primary_contact_phone}</span>
                    </div>
                  )}
                  {c.primary_contact_email && (
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="text-muted-foreground shrink-0" />
                      <span>{c.primary_contact_email}</span>
                    </div>
                  )}
                  {c.website && (
                    <div className="flex items-center gap-2">
                      <Globe size={12} className="text-muted-foreground shrink-0" />
                      <a href={c.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{c.website}</a>
                    </div>
                  )}
                  {c.registered_address && (
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Registered Address: </span>
                      <span>{c.registered_address}</span>
                    </div>
                  )}
                  {c.operational_address && (
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Operational Address: </span>
                      <span>{c.operational_address}</span>
                    </div>
                  )}
                  {c.notes && (
                    <div className="col-span-2 text-muted-foreground italic text-xs">{c.notes}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Company' : 'Add New Company'}</DialogTitle>
          </DialogHeader>
          <CompanyForm
            initial={editing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}