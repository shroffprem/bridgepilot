import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TYPE_COLORS = {
  zone:    'bg-purple-100 text-purple-800',
  cluster: 'bg-blue-100 text-blue-800',
  branch:  'bg-green-100 text-green-800',
};

const EMPTY_FORM = { type: 'zone', name: '', parent_name: '', company: '', manager_name: '', manager_phone: '', notes: '', status: 'active' };

function TerritoryForm({ initial, onSave, onCancel, companies, territories }) {
  const [form, setForm] = useState(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));
  const setVal = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const parentType = form.type === 'cluster' ? 'zone' : form.type === 'branch' ? 'cluster' : null;
  const parentOptions = parentType ? territories.filter(t => t.type === parentType) : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Type <span className="text-destructive">*</span></Label>
          <Select value={form.type} onValueChange={v => setVal('type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="zone">Zone</SelectItem>
              <SelectItem value="cluster">Cluster</SelectItem>
              <SelectItem value="branch">Branch</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Name <span className="text-destructive">*</span></Label>
          <Input value={form.name} onChange={set('name')} placeholder={`e.g. ${form.type === 'zone' ? 'South Karnataka' : form.type === 'cluster' ? 'Mysore' : 'Vijay Nagar'}`} required />
        </div>
        {parentType && (
          <div className="space-y-1">
            <Label>Parent {parentType.charAt(0).toUpperCase() + parentType.slice(1)}</Label>
            <Select value={form.parent_name} onValueChange={v => setVal('parent_name', v)}>
              <SelectTrigger><SelectValue placeholder={`Select ${parentType}`} /></SelectTrigger>
              <SelectContent>
                {parentOptions.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label>Company</Label>
          <Select value={form.company} onValueChange={v => setVal('company', v)}>
            <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>— None —</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Manager Name</Label>
          <Input value={form.manager_name} onChange={set('manager_name')} placeholder="e.g. Ravi Kumar" />
        </div>
        <div className="space-y-1">
          <Label>Manager Phone</Label>
          <Input value={form.manager_phone} onChange={set('manager_phone')} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Notes</Label>
        <Input value={form.notes} onChange={set('notes')} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update' : 'Add'}</Button>
      </div>
    </form>
  );
}

export default function TerritoriesTab() {
  const [territories, setTerritories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedZones, setExpandedZones] = useState({});

  const fetchAll = () => {
    Promise.all([
      base44.entities.Territory.list(),
      base44.entities.Company.list(),
    ]).then(([t, c]) => { setTerritories(t); setCompanies(c); setLoading(false); });
  };
  useEffect(fetchAll, []);

  const handleSave = async (form) => {
    if (editing) {
      await base44.entities.Territory.update(editing.id, form);
    } else {
      await base44.entities.Territory.create(form);
    }
    setShowForm(false);
    setEditing(null);
    fetchAll();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this territory?')) return;
    await base44.entities.Territory.delete(id);
    fetchAll();
  };

  const openEdit = (t) => { setEditing(t); setShowForm(true); };
  const openAdd = () => { setEditing(null); setShowForm(true); };
  const toggleZone = (id) => setExpandedZones(p => ({ ...p, [id]: !p[id] }));

  const filtered = typeFilter === 'all' ? territories : territories.filter(t => t.type === typeFilter);

  // Build hierarchy view for 'all' mode
  const zones = territories.filter(t => t.type === 'zone');
  const clusters = territories.filter(t => t.type === 'cluster');
  const branches = territories.filter(t => t.type === 'branch');

  if (loading) return <div className="flex justify-center py-12"><div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const TerritoryRow = ({ t, indent = 0 }) => (
    <div className={`border-t border-border ${indent > 0 ? 'bg-muted/10' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ paddingLeft: `${16 + indent * 20}px` }}>
        <MapPin size={13} className="text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm">{t.name}</span>
          {t.manager_name && <span className="text-xs text-muted-foreground ml-2">· {t.manager_name}</span>}
          {t.company && <span className="text-xs text-primary/70 ml-2">{t.company}</span>}
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[t.type]}`}>{t.type}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(t)}><Pencil size={11} /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(t.id)}><Trash2 size={11} /></Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Type filter tabs */}
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
          {['all', 'zone', 'cluster', 'branch'].map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                typeFilter === f ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Hierarchy View' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
            </button>
          ))}
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus size={15} /> Add Territory
        </Button>
      </div>

      {territories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No territories yet. Add zones, clusters, and branches.</div>
      ) : typeFilter === 'all' ? (
        /* Hierarchical tree view */
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {zones.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground">No zones defined — territories will appear flat.</div>
          )}
          {zones.map(zone => {
            const zoneClusters = clusters.filter(c => c.parent_name === zone.name);
            const isOpen = expandedZones[zone.id] !== false; // default open
            return (
              <div key={zone.id}>
                {/* Zone row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => toggleZone(zone.id)}>
                  {isOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                  <div className="flex-1 font-semibold text-sm">{zone.name}</div>
                  {zone.manager_name && <span className="text-xs text-muted-foreground">{zone.manager_name}</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS.zone}`}>zone</span>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(zone)}><Pencil size={11} /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(zone.id)}><Trash2 size={11} /></Button>
                  </div>
                </div>
                {isOpen && zoneClusters.map(cluster => {
                  const clusterBranches = branches.filter(b => b.parent_name === cluster.name);
                  return (
                    <div key={cluster.id}>
                      <TerritoryRow t={cluster} indent={1} />
                      {clusterBranches.map(branch => <TerritoryRow key={branch.id} t={branch} indent={2} />)}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {/* Orphan clusters (no zone parent) */}
          {clusters.filter(c => !c.parent_name || !zones.find(z => z.name === c.parent_name)).map(cluster => {
            const clusterBranches = branches.filter(b => b.parent_name === cluster.name);
            return (
              <div key={cluster.id}>
                <TerritoryRow t={cluster} indent={0} />
                {clusterBranches.map(branch => <TerritoryRow key={branch.id} t={branch} indent={1} />)}
              </div>
            );
          })}
          {/* Orphan branches */}
          {branches.filter(b => !b.parent_name || !clusters.find(c => c.name === b.parent_name)).map(branch => (
            <TerritoryRow key={branch.id} t={branch} indent={0} />
          ))}
        </div>
      ) : (
        /* Flat list for filtered view */
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {filtered.map(t => <TerritoryRow key={t.id} t={t} />)}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Territory' : 'Add Territory'}</DialogTitle>
          </DialogHeader>
          <TerritoryForm
            initial={editing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            companies={companies}
            territories={territories}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}