import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { IndianRupee, AlertTriangle, CheckSquare, CreditCard, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount}`;
}

// Filter loans based on team member's scope
function scopeFilter(loans, member) {
  if (!member) return loans;
  const role = member.role;
  if (role === 'zonal_manager' || role === 'managing_partner') return loans;
  if (role === 'cluster_manager' && member.cluster) {
    return loans.filter(l => l.cluster === member.cluster || l.branch === member.branch);
  }
  if (role === 'branch_manager' && member.branch) {
    return loans.filter(l => l.branch === member.branch);
  }
  return loans;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [borrowers, setBorrowers] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [teamMember, setTeamMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Loan.list(),
      base44.entities.Borrower.list(),
      base44.entities.Repayment.list(),
      base44.entities.TeamMember.list(),
    ]).then(([l, b, r, team]) => {
      setLoans(l);
      setBorrowers(b);
      // Match logged-in user by email to their TeamMember record
      const me = user?.email ? team.find(t => t.email?.toLowerCase() === user.email.toLowerCase()) : null;
      setTeamMember(me || null);
      // Filter repayments to match scoped loans
      const scopedLoanIds = new Set(scopeFilter(l, me).map(x => x.id));
      setRepayments(r.filter(rep => scopedLoanIds.has(rep.loan_id)));
      setLoading(false);
    });
  }, [user]);

  // Apply scope filter based on the current user's team member record
  const scopedLoans = scopeFilter(loans, teamMember);

  const today = new Date();
  const activeLoans = scopedLoans.filter(l => l.status === 'disbursed');
  const overdueLoans = scopedLoans.filter(l => l.status === 'overdue');
  const pendingApprovals = scopedLoans.filter(l => ['pending_cluster_approval', 'pending_zonal_approval'].includes(l.status));
  const dueSoon = activeLoans.filter(l => {
    if (!l.maturity_date) return false;
    const mat = new Date(l.maturity_date);
    return isAfter(mat, today) && isBefore(mat, addDays(today, 7));
  });

  const totalDisbursed = activeLoans.reduce((s, l) => s + (l.amount || 0), 0);
  const totalOverdue = overdueLoans.reduce((s, l) => s + (l.total_repayable || l.amount || 0), 0);
  const totalRepaid = repayments.reduce((s, r) => s + (r.amount_received || 0), 0);

  // Status distribution for pie chart
  const statusData = [
    { name: 'Disbursed', value: scopedLoans.filter(l => l.status === 'disbursed').length },
    { name: 'Approved', value: scopedLoans.filter(l => l.status === 'approved').length },
    { name: 'Pending', value: pendingApprovals.length },
    { name: 'Overdue', value: overdueLoans.length },
    { name: 'Repaid', value: scopedLoans.filter(l => l.status === 'repaid').length },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const scopeLabel = !teamMember ? null
    : teamMember.role === 'branch_manager'  ? `Branch: ${teamMember.branch}`
    : teamMember.role === 'cluster_manager' ? `Cluster: ${teamMember.cluster}`
    : null;

  return (
    <div className="space-y-6">
      {/* Scope banner for restricted users */}
      {scopeLabel && (
        <div className="flex items-center gap-2 text-xs bg-accent text-accent-foreground px-4 py-2.5 rounded-lg border border-border">
          <MapPin size={13} /> Showing data for your scope — <span className="font-semibold">{scopeLabel}</span>
        </div>
      )}
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Portfolio"
          value={formatINR(totalDisbursed)}
          subtitle={`${activeLoans.length} active loans`}
          icon={IndianRupee}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Overdue Amount"
          value={formatINR(totalOverdue)}
          subtitle={`${overdueLoans.length} loans overdue`}
          icon={AlertTriangle}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
        <StatCard
          title="Pending Approvals"
          value={pendingApprovals.length}
          subtitle="Awaiting action"
          icon={CheckSquare}
          iconBg="bg-yellow-50"
          iconColor="text-yellow-600"
        />
        <StatCard
          title="Total Repaid"
          value={formatINR(totalRepaid)}
          subtitle={`${repayments.length} transactions`}
          icon={CreditCard}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
      </div>

      {/* Charts + Due Soon */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Portfolio Status Pie */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-syne font-semibold text-sm text-foreground mb-4">Portfolio Status</h3>
          {statusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {statusData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {statusData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </div>

        {/* Due Soon */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-syne font-semibold text-sm text-foreground mb-4">Due in Next 7 Days</h3>
          {dueSoon.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No loans due soon</div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {dueSoon.map(loan => (
                <Link key={loan.id} to={`/loans/${loan.id}`} className="flex items-center justify-between p-2.5 rounded-lg bg-muted hover:bg-accent transition-colors">
                  <div>
                    <div className="text-sm font-medium text-foreground">{loan.borrower_name}</div>
                    <div className="text-xs text-muted-foreground">{loan.loan_number}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">{formatINR(loan.total_repayable)}</div>
                    <div className="text-xs text-muted-foreground">{loan.maturity_date && format(new Date(loan.maturity_date), 'dd MMM')}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pending Approvals */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-syne font-semibold text-sm text-foreground">Pending Approvals</h3>
            <Link to="/approvals">
              <Button variant="ghost" size="sm" className="text-xs h-7">View All</Button>
            </Link>
          </div>
          {pendingApprovals.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">All clear!</div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {pendingApprovals.slice(0, 5).map(loan => (
                <Link key={loan.id} to={`/approvals`} className="flex items-center justify-between p-2.5 rounded-lg bg-muted hover:bg-accent transition-colors">
                  <div>
                    <div className="text-sm font-medium text-foreground">{loan.borrower_name}</div>
                    <div className="text-xs text-muted-foreground">{formatINR(loan.amount)}</div>
                  </div>
                  <StatusBadge status={loan.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Overdue */}
      {overdueLoans.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-syne font-semibold text-sm text-foreground flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" /> Overdue Loans
            </h3>
            <Link to="/collections">
              <Button variant="ghost" size="sm" className="text-xs h-7">Manage Collections</Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left py-2 font-medium">Borrower</th>
                  <th className="text-left py-2 font-medium">Loan #</th>
                  <th className="text-right py-2 font-medium">Amount Due</th>
                  <th className="text-right py-2 font-medium">Maturity Date</th>
                </tr>
              </thead>
              <tbody>
                {overdueLoans.slice(0, 5).map(loan => (
                  <tr key={loan.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="py-2.5 font-medium">{loan.borrower_name}</td>
                    <td className="py-2.5 text-muted-foreground">{loan.loan_number}</td>
                    <td className="py-2.5 text-right text-red-600 font-semibold">{formatINR(loan.total_repayable)}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{loan.maturity_date && format(new Date(loan.maturity_date), 'dd MMM yyyy')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}