import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, ShieldCheck, User, TrendingUp, MessageSquare, Upload, BookOpen } from 'lucide-react';
import LoanCsvImport from '@/components/admin/LoanCsvImport';
import WhatsAppSettings from '@/components/admin/WhatsAppSettings';
import CapitalManager from '@/components/admin/CapitalManager';
import Ledger from '@/pages/Ledger';

const ROLE_LABELS = {
  admin: 'Admin',
  branch_manager: 'Branch Manager',
  cluster_manager: 'Cluster Manager',
  zonal_manager: 'Zonal Manager',
};

const ROLE_STYLES = {
  admin: 'bg-purple-100 text-purple-800',
  branch_manager: 'bg-blue-100 text-blue-800',
  cluster_manager: 'bg-yellow-100 text-yellow-800',
  zonal_manager: 'bg-orange-100 text-orange-800',
};

const TABS = [
  { key: 'users', label: 'Users', icon: ShieldCheck },
  { key: 'capital', label: 'Capital', icon: TrendingUp },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { key: 'import', label: 'Import', icon: Upload },
  { key: 'ledger', label: 'Cash Ledger', icon: BookOpen },
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('branch_manager');
  const [branch, setBranch] = useState('');
  const [cluster, setCluster] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const fetchUsers = () => {
    base44.entities.User.list().then(u => { setUsers(u); setLoading(false); });
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setInviteMsg('');
    await base44.users.inviteUser(email, role);
    // Also update the user record with branch/cluster after a short delay
    // (user record created upon invite acceptance, so we note it in a pending way)
    setInviteMsg(`Invitation sent to ${email}`);
    setEmail('');
    setBranch('');
    setCluster('');
    setRole('branch_manager');
    setInviting(false);
    fetchUsers();
  };

  const handleRoleChange = async (userId, newRole) => {
    await base44.entities.User.update(userId, { role: newRole });
    fetchUsers();
  };

  const handleFieldChange = async (userId, field, value) => {
    await base44.entities.User.update(userId, { [field]: value });
    fetchUsers();
  };

  const showBranch = role === 'branch_manager';
  const showCluster = role === 'cluster_manager' || role === 'branch_manager';

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="font-syne font-bold text-xl text-foreground">Admin Panel</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage users, capital, and system settings.</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {activeTab === 'capital' && <CapitalManager />}
      {activeTab === 'whatsapp' && <WhatsAppSettings />}
      {activeTab === 'import' && <LoanCsvImport />}
      {activeTab === 'ledger' && <Ledger />}

      {activeTab === 'users' && <div className="space-y-6">
      {/* Invite User */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus size={18} className="text-primary" />
          <h3 className="font-syne font-semibold text-sm">Invite New User</h3>
        </div>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 flex-1 min-w-48">
              <Label>Email Address</Label>
              <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="manager@example.com" />
            </div>
            <div className="space-y-1 w-44">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="branch_manager">Branch Manager</SelectItem>
                  <SelectItem value="cluster_manager">Cluster Manager</SelectItem>
                  <SelectItem value="zonal_manager">Zonal Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showCluster && (
              <div className="space-y-1 w-36">
                <Label>Cluster</Label>
                <Input value={cluster} onChange={e => setCluster(e.target.value)} placeholder="e.g. Mysore" />
              </div>
            )}
            {showBranch && (
              <div className="space-y-1 w-36">
                <Label>Branch</Label>
                <Input value={branch} onChange={e => setBranch(e.target.value)} placeholder="e.g. Vijay Nagar" />
              </div>
            )}
            <Button type="submit" disabled={inviting} className="gap-2">
              <UserPlus size={15} />{inviting ? 'Sending…' : 'Send Invite'}
            </Button>
          </div>
        </form>
        {inviteMsg && <p className="text-sm text-green-600 mt-3">{inviteMsg}</p>}
      </div>

      {/* User List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <h3 className="font-syne font-semibold text-sm">All Users</h3>
          <span className="ml-auto text-xs text-muted-foreground">{users.length} total</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Cluster</th>
                  <th className="text-left px-4 py-3 font-medium">Branch</th>
                  <th className="text-center px-4 py-3 font-medium">Change Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User size={13} className="text-primary" />
                        </div>
                        {u.full_name || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[u.role] || 'bg-muted text-muted-foreground'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        className="h-7 text-xs w-28"
                        defaultValue={u.cluster || ''}
                        placeholder="e.g. Mysore"
                        onBlur={e => { if (e.target.value !== (u.cluster || '')) handleFieldChange(u.id, 'cluster', e.target.value); }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        className="h-7 text-xs w-28"
                        defaultValue={u.branch || ''}
                        placeholder="e.g. Vijay Nagar"
                        onBlur={e => { if (e.target.value !== (u.branch || '')) handleFieldChange(u.id, 'branch', e.target.value); }}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Select value={u.role} onValueChange={val => handleRoleChange(u.id, val)}>
                        <SelectTrigger className="w-36 h-7 text-xs mx-auto"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="branch_manager">Branch Manager</SelectItem>
                          <SelectItem value="cluster_manager">Cluster Manager</SelectItem>
                          <SelectItem value="zonal_manager">Zonal Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>}
    </div>
  );
}