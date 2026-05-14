import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Trash2, ShieldCheck, User } from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Admin',
  user: 'User',
};

const ROLE_STYLES = {
  admin: 'bg-purple-100 text-purple-800',
  user: 'bg-blue-100 text-blue-800',
};

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
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
    setInviteMsg(`Invitation sent to ${email}`);
    setEmail('');
    setRole('user');
    setInviting(false);
    fetchUsers();
  };

  const handleRoleChange = async (userId, newRole) => {
    await base44.entities.User.update(userId, { role: newRole });
    fetchUsers();
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="font-syne font-bold text-xl text-foreground">Admin Panel</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage user access and roles for BridgeLine Partners.</p>
      </div>

      {/* Invite User */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus size={18} className="text-primary" />
          <h3 className="font-syne font-semibold text-sm">Invite New User</h3>
        </div>
        <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1 flex-1 min-w-48">
            <Label>Email Address</Label>
            <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="manager@example.com" />
          </div>
          <div className="space-y-1 w-40">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={inviting} className="gap-2">
            <UserPlus size={15} />{inviting ? 'Sending…' : 'Send Invite'}
          </Button>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium">Email</th>
                <th className="text-left px-5 py-3 font-medium">Role</th>
                <th className="text-left px-5 py-3 font-medium">Joined</th>
                <th className="text-center px-5 py-3 font-medium">Change Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <User size={13} className="text-primary" />
                    </div>
                    {u.full_name || '—'}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[u.role] || 'bg-muted text-muted-foreground'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">
                    {u.created_date ? new Date(u.created_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <Select value={u.role} onValueChange={val => handleRoleChange(u.id, val)}>
                      <SelectTrigger className="w-28 h-7 text-xs mx-auto"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}