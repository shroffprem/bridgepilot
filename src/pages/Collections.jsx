import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, differenceInDays } from 'date-fns';
import { AlertTriangle, Plus, Phone, MapPin, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ui/StatusBadge';

function formatINR(n) {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n?.toLocaleString('en-IN')}`;
}

const activityTypes = ['call', 'visit', 'notice_sent', 'legal_notice', 'payment_promise', 'payment_received', 'note'];
const activityIcons = { call: Phone, visit: MapPin, notice_sent: FileText, legal_notice: FileText, payment_promise: AlertTriangle, payment_received: AlertTriangle, note: FileText };

const empty = { activity_type: 'call', activity_date: format(new Date(), 'yyyy-MM-dd'), outcome: '', next_action_date: '', promise_amount: '', promise_date: '', notes: '' };

export default function Collections() {
  const [overdueLoans, setOverdueLoans] = useState([]);
  const [activities, setActivities] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [actOpen, setActOpen] = useState(false);
  const [actLoan, setActLoan] = useState(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [loans, acts] = await Promise.all([
      base44.entities.Loan.filter({ status: 'overdue' }),
      base44.entities.CollectionActivity.list('-activity_date'),
    ]);
    setOverdueLoans(loans);
    setActivities(acts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAddActivity = async () => {
    await base44.entities.CollectionActivity.create({
      ...form,
      loan_id: actLoan.id,
      loan_number: actLoan.loan_number,
      borrower_name: actLoan.borrower_name,
      promise_amount: parseFloat(form.promise_amount) || 0,
      handled_by: 'Current User',
    });
    setActOpen(false);
    setForm(empty);
    load();
  };

  const openActivity = (loan) => { setActLoan(loan); setForm(empty); setActOpen(true); };
  const loanActivities = (loanId) => activities.filter(a => a.loan_id === loanId);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const totalOverdue = overdueLoans.reduce((s, l) => s + (l.total_repayable || l.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-xs text-red-700 font-medium">Overdue Loans</div>
          <div className="text-2xl font-bold font-syne text-red-700 mt-1">{overdueLoans.length}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-xs text-red-700 font-medium">Total Overdue Amount</div>
          <div className="text-2xl font-bold font-syne text-red-700 mt-1">{formatINR(totalOverdue)}</div>
        </div>
      </div>

      {overdueLoans.length === 0 ? (
        <div className="bg-card rounded-xl border border-border flex flex-col items-center justify-center py-24 text-muted-foreground">
          <AlertTriangle size={40} className="mb-3 opacity-20" />
          <p>No overdue loans — great job!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {overdueLoans.map(loan => {
            const daysPastDue = loan.maturity_date ? differenceInDays(new Date(), new Date(loan.maturity_date)) : 0;
            const loanActs = loanActivities(loan.id);
            const isExpanded = expanded === loan.id;
            return (
              <div key={loan.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Borrower</div>
                      <div className="font-semibold text-sm">{loan.borrower_name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Amount Due</div>
                      <div className="font-bold text-sm text-red-600">{formatINR(loan.total_repayable)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Days Overdue</div>
                      <div className="font-semibold text-sm text-red-600">{daysPastDue} days</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Activities</div>
                      <div className="font-semibold text-sm">{loanActs.length}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => openActivity(loan)}>
                      <Plus size={13} /> Log Activity
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpanded(isExpanded ? null : loan.id)}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-5 py-4 bg-muted/20">
                    <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Collection Activity Log</div>
                    {loanActs.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">No activities logged yet</div>
                    ) : (
                      <div className="space-y-2">
                        {loanActs.map(act => {
                          const Icon = activityIcons[act.activity_type] || FileText;
                          return (
                            <div key={act.id} className="flex gap-3 bg-card rounded-lg p-3 border border-border">
                              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                                <Icon size={13} className="text-muted-foreground" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold capitalize text-foreground">{act.activity_type.replace('_', ' ')}</span>
                                  <span className="text-xs text-muted-foreground">{act.activity_date}</span>
                                  {act.handled_by && <span className="text-xs text-muted-foreground">· {act.handled_by}</span>}
                                </div>
                                {act.outcome && <div className="text-xs text-muted-foreground mt-0.5">{act.outcome}</div>}
                                {act.notes && <div className="text-xs text-muted-foreground mt-0.5">{act.notes}</div>}
                                {act.promise_amount > 0 && (
                                  <div className="text-xs text-yellow-700 mt-0.5">
                                    Payment promise: {formatINR(act.promise_amount)} by {act.promise_date}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Log Activity Dialog */}
      <Dialog open={actOpen} onOpenChange={setActOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Collection Activity</DialogTitle>
          </DialogHeader>
          {actLoan && (
            <div className="space-y-4 mt-1">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">Loan: </span>
                <span className="font-semibold">{actLoan.borrower_name}</span>
                <span className="text-muted-foreground ml-2">· {formatINR(actLoan.total_repayable)} due</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Activity Type</Label>
                  <Select value={form.activity_type} onValueChange={v => setForm(p => ({...p, activity_type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {activityTypes.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={form.activity_date} onChange={e => setForm(p => ({...p, activity_date: e.target.value}))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Outcome</Label>
                  <Input value={form.outcome} onChange={e => setForm(p => ({...p, outcome: e.target.value}))} placeholder="What happened?" />
                </div>
                {form.activity_type === 'payment_promise' && (
                  <>
                    <div className="space-y-1">
                      <Label>Promise Amount (₹)</Label>
                      <Input type="number" value={form.promise_amount} onChange={e => setForm(p => ({...p, promise_amount: e.target.value}))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Promise Date</Label>
                      <Input type="date" value={form.promise_date} onChange={e => setForm(p => ({...p, promise_date: e.target.value}))} />
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label>Next Action Date</Label>
                  <Input type="date" value={form.next_action_date} onChange={e => setForm(p => ({...p, next_action_date: e.target.value}))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActOpen(false)}>Cancel</Button>
                <Button onClick={handleAddActivity}>Save Activity</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}