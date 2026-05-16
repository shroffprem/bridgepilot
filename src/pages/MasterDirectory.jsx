import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, Building2, Users, Search, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';

const ROLE_LABELS = {
  zonal_manager:    'Zonal Manager',
  cluster_manager:  'Cluster Manager',
  branch_manager:   'Branch Manager',
  managing_partner: 'Managing Partner',
  other:            'Other',
};

const ROLE_COLORS = {
  zonal_manager:    'bg-purple-100 text-purple-800',
  cluster_manager:  'bg-blue-100 text-blue-800',
  branch_manager:   'bg-green-100 text-green-800',
  managing_partner: 'bg-yellow-100 text-yellow-800',
  other:            'bg-gray-100 text-gray-600',
};

const STATUS_COLORS = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
};

const COMPANY_TYPE_LABELS = {
  lender: 'Lender', partner: 'Partner', nbfc: 'NBFC', bank: 'Bank', other: 'Other',
};

// ─── Default form states ───────────────────────────────────────────
const defaultMember = { full_name: '', role: 'branch_manager', employee_id: '', phone: '', email: '', zone: '', cluster: '', branch: '', reports_to: '', company_id: '', joined_date: '', status: 'active', notes: '' };
const defaultCompany = { name: '', type: 'lender', cin: '', gstin: '', registered_address: '', operational_address: '', website: '', primary_contact_name: '', primary_contact_phone: '', primary_contact_email: '', notes: '' };

// ─── Access guard ─────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
        <ShieldAlert size={26} className="text-red-500" />
      </div>
      <div>
        <div className="font-syne font-bold text-lg text-foreground">Access Restricted</div>
        <div className="text-sm text-muted-foreground mt-1">Only Managing Partners and Admins can view and edit this directory.</div>
      </div>
    </div>
  );
}

// ─── Team Members tab ─────────────────────────────────────────────
function TeamTab({ companies }) {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultMember);
  const [saving, setSaving] = useState(false);

  const load = () => base44.entities.TeamMember.list('-created_date').then(setMembers);
  useEffect(() => { load(); }, []);

  const filtered = members.filter(m => {
    const matchSearch = !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase()) || m.branch?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || m.role === filterRole;
    return matchSearch && matchRole;
  });

  const openAdd = () => { setEditing(null); setForm(defaultMember); setDialogOpen(true); };
  const openEdit = (m) => { setEditing(m); setForm({ ...defaultMember, ...m }); setDialogOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    if (editing) await base44.entities.TeamMember.update(editing.id, form);
    else await base44.entities.TeamMember.create(form);
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this team member?')) return;
    await base44.entities.TeamMember.delete(id);
    load();
  };

  const companyName = (id) => companies.find(c => c.id === id)?.name || '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, email, branch…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-2 shrink-0" onClick={openAdd}><Plus size={15} /> Add Member</Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No team members found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Branch / Zone</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Company</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-semibold">{m.full_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role] || 'bg-muted text-muted-foreground'}`}>
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{m.phone || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{m.email || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {[m.branch, m.cluster, m.zone].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {companyName(m.company_id)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.status] || ''}`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(m)}><Pencil size={13} /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)}><Trash2 size={13} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Company</Label>
              <Select value={form.company_id || ''} onValueChange={v => setForm(f => ({ ...f, company_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select company…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— None —</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Employee ID</Label>
              <Input value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Zone</Label>
              <Input value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} placeholder="e.g. South Zone" />
            </div>
            <div className="space-y-1">
              <Label>Cluster</Label>
              <Input value={form.cluster} onChange={e => setForm(f => ({ ...f, cluster: e.target.value }))} placeholder="e.g. Cluster A" />
            </div>
            <div className="space-y-1">
              <Label>Branch</Label>
              <Input value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} placeholder="e.g. Koramangala" />
            </div>
            <div className="space-y-1">
              <Label>Reports To</Label>
              <Input value={form.reports_to} onChange={e => setForm(f => ({ ...f, reports_to: e.target.value }))} placeholder="Manager name" />
            </div>
            <div className="space-y-1">
              <Label>Joined Date</Label>
              <Input type="date" value={form.joined_date} onChange={e => setForm(f => ({ ...f, joined_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} disabled={saving || !form.full_name}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Member'}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Companies tab ────────────────────────────────────────────────
function CompaniesTab() {
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultCompany);
  const [saving, setSaving] = useState(false);

  const load = () => base44.entities.Company.list('-created_date').then(setCompanies);
  useEffect(() => { load(); }, []);

  const filtered = companies.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.primary_contact_email?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditing(null); setForm(defaultCompany); setDialogOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...defaultCompany, ...c }); setDialogOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    if (editing) await base44.entities.Company.update(editing.id, form);
    else await base44.entities.Company.create(form);
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this company?')) return;
    await base44.entities.Company.delete(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search companies…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button className="gap-2 shrink-0" onClick={openAdd}><Plus size={15} /> Add Company</Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No companies found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase">
                <th className="text-left px-4 py-3 font-medium">Company Name</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Contact Person</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                      {COMPANY_TYPE_LABELS[c.type] || c.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.primary_contact_name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.primary_contact_phone || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{c.primary_contact_email || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil size={13} /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}><Trash2 size={13} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Company' : 'Add Company'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Company Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPANY_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>CIN</Label>
              <Input value={form.cin} onChange={e => setForm(f => ({ ...f, cin: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>GSTIN</Label>
              <Input value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://…" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Registered Address</Label>
              <Textarea rows={2} value={form.registered_address} onChange={e => setForm(f => ({ ...f, registered_address: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Operational Address</Label>
              <Textarea rows={2} value={form.operational_address} onChange={e => setForm(f => ({ ...f, operational_address: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Primary Contact Name</Label>
              <Input value={form.primary_contact_name} onChange={e => setForm(f => ({ ...f, primary_contact_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Primary Contact Phone</Label>
              <Input value={form.primary_contact_phone} onChange={e => setForm(f => ({ ...f, primary_contact_phone: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Primary Contact Email</Label>
              <Input value={form.primary_contact_email} onChange={e => setForm(f => ({ ...f, primary_contact_email: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Company'}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function MasterDirectory() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    base44.entities.Company.list().then(setCompanies);
  }, []);

  // Only admin users can access
  if (user && user.role !== 'admin') return <AccessDenied />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 size={18} className="text-primary" />
        </div>
        <div>
          <h2 className="font-syne font-bold text-lg text-foreground">Master Directory</h2>
          <p className="text-xs text-muted-foreground">Companies, managers & contact details — restricted to admins only</p>
        </div>
      </div>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team" className="gap-2"><Users size={14} /> Team Members</TabsTrigger>
          <TabsTrigger value="companies" className="gap-2"><Building2 size={14} /> Companies</TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="mt-4">
          <TeamTab companies={companies} />
        </TabsContent>
        <TabsContent value="companies" className="mt-4">
          <CompaniesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}