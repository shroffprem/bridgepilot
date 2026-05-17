import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Banknote, BadgeCheck, FileText, Download, Loader2, ArrowDownLeft, Pencil } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatINR, calcCharges, calcGST, calcOutstanding, calcDays } from '@/lib/mis';
import ApprovalTrail from '@/components/loans/ApprovalTrail';
import DisbursalDialog from '@/components/loans/DisbursalDialog';
import CollectionDialog from '@/components/loans/CollectionDialog';

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-medium text-foreground">{value || '—'}</div>
    </div>
  );
}

const STATUS_LABELS = {
  pending_cluster_approval: 'Pending Cluster Approval',
  pending_zonal_approval: 'Pending Zonal Approval',
  open: 'Open',
  closed: 'Closed',
  overdue: 'Overdue',
  rejected: 'Rejected',
  follow_up: 'Open',
};

// Normalize status values
function normalizeStatus(status) {
  if (!status) return 'open';
  if (status === 'Follow Up!' || status === 'follow_up') return 'open';
  if (status === 'open' || status === 'Open') return 'open';
  if (status === 'closed' || status === 'Closed') return 'closed';
  if (status === 'overdue' || status === 'Overdue') return 'overdue';
  if (status === 'pending_cluster_approval') return 'pending_cluster_approval';
  if (status === 'pending_zonal_approval') return 'pending_zonal_approval';
  if (status === 'rejected' || status === 'Rejected') return 'rejected';
  return 'open';
}
const STATUS_STYLES = {
  pending_cluster_approval: 'bg-blue-100 text-blue-800',
  pending_zonal_approval: 'bg-orange-100 text-orange-800',
  open: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-700',
};

export default function LoanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState(null);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closureDate, setClosureDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [disbursalOpen, setDisbursalOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [memoLoading, setMemoLoading] = useState({ disbursal: false, collection: false });
  const [memoPdfs, setMemoPdfs] = useState({ disbursal: null, collection: null });
  const [confirmOverdue, setConfirmOverdue] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    const [[l], cols] = await Promise.all([
      base44.entities.Loan.filter({ id }),
      base44.entities.Collection.filter({ loan_id: id }),
    ]);
    if (l) {
      l.status = normalizeStatus(l.status);
    }
    setLoan(l);
    setCollections(cols.sort((a, b) => (a.credit_note_date > b.credit_note_date ? 1 : -1)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleClose = async () => {
    await base44.entities.Loan.update(id, { status: 'closed', closure_date: closureDate, outstanding: 0 });
    setCloseOpen(false);
    load();
  };

  const handleMarkOverdue = async () => {
    await base44.entities.Loan.update(id, { status: 'overdue' });
    load();
  };

  const handleReopen = async () => {
    await base44.entities.Loan.update(id, { status: 'open', closure_date: null });
    load();
  };

  const handleEditOpen = () => {
    setEditData({
      principal: loan.principal,
      charges: loan.charges || calcCharges(loan),
      gst: loan.gst != null ? loan.gst : calcGST(loan.charges || calcCharges(loan)),
      rate: loan.rate || 0.5,
    });
    setEditOpen(true);
  };

  const handleDelete = async () => {
    await base44.entities.Loan.delete(id);
    navigate('/loans');
  };

  const handleEditSave = async () => {
    await base44.entities.Loan.update(id, {
      principal: parseFloat(editData.principal) || 0,
      charges: parseFloat(editData.charges) || 0,
      gst: parseFloat(editData.gst) || 0,
      rate: parseFloat(editData.rate) || 0.5,
    });
    setEditOpen(false);
    load();
  };

  const generateMemoPDF = async (type) => {
    setMemoLoading(p => ({ ...p, [type]: true }));
    const payload = { loan_id: id };
    if (type === 'collection') {
      // fetch latest collection record for this loan
      const cols = await base44.entities.Collection.filter({ loan_id: id });
      if (cols.length > 0) payload.collection_id = cols[cols.length - 1].id;
    }
    const res = await base44.functions.invoke('generateMemo', payload);
    if (res.data?.pdf_url) {
      setMemoPdfs(p => ({ ...p, [type]: res.data.pdf_url }));
    }
    setMemoLoading(p => ({ ...p, [type]: false }));
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!loan) return <div className="text-muted-foreground py-20 text-center">Case not found</div>;

  const charges = calcCharges(loan);
  const gst = loan.gst != null ? loan.gst : calcGST(charges);
  const outstanding = calcOutstanding(loan);
  const days = calcDays(loan);
  const totalBilled = (loan.principal || 0) + charges + gst;
  const roi = loan.principal > 0 ? ((charges / loan.principal) * 100).toFixed(3) : '0';

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/loans')} className="gap-2 text-muted-foreground"><ArrowLeft size={16} /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-syne font-bold text-xl">{loan.borrower_name}</h2>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[loan.status] || 'bg-muted text-muted-foreground'}`}>
              {STATUS_LABELS[loan.status] || loan.status?.toUpperCase()}
            </span>
          </div>
          <div className="text-sm text-muted-foreground font-mono">{loan.loan_number} {loan.disbursal_id && `· ${loan.disbursal_id}`} {loan.branch && `· ${loan.branch}`} {loan.cluster && `· ${loan.cluster}`}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
           <Button size="sm" variant="outline" className="gap-1" onClick={handleEditOpen}><Pencil size={14} /> Edit</Button>
           {/* Disbursal recording — available for active cases */}
           {['pending_cluster_approval', 'pending_zonal_approval', 'open', 'overdue'].includes(loan.status) && (
             <Button size="sm" variant="outline" className="gap-1" onClick={() => setDisbursalOpen(true)}>
               <Banknote size={14} /> Debit Note
             </Button>
           )}
           {['open'].includes(loan.status) && (
             <>
               <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={() => setCollectionOpen(true)}><BadgeCheck size={14} /> Credit Note</Button>
               <Button size="sm" variant="destructive" className="gap-1" onClick={() => setConfirmOverdue(true)}><AlertTriangle size={14} /> Mark Overdue</Button>
             </>
           )}
           {['overdue'].includes(loan.status) && (
             <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={() => setCollectionOpen(true)}><BadgeCheck size={14} /> Credit Note</Button>
           )}
          {loan.status === 'closed' && (
            <Button size="sm" variant="outline" onClick={() => setConfirmReopen(true)}>Re-open</Button>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Principal', value: formatINR(loan.principal), accent: true },
          { label: 'Charges', value: formatINR(charges) },
          { label: 'GST', value: formatINR(gst) },
          { label: 'Total Billed', value: formatINR(totalBilled) },
          { label: 'Outstanding', value: formatINR(outstanding), highlight: loan.status !== 'closed' },
          { label: 'Days Open', value: days },
          { label: 'Rate', value: loan.rate ? `${loan.rate}%` : '—' },
          { label: 'ROI', value: `${roi}%` },
        ].map(({ label, value, accent, highlight }) => (
          <div key={label} className={`bg-card rounded-xl border p-4 ${accent ? 'border-l-4 border-l-primary border-border' : 'border-border'}`}>
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`font-syne font-bold text-lg ${highlight ? 'text-red-600' : 'text-foreground'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Case Details */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-syne font-semibold text-sm mb-4">Case Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Disbursement Date" value={loan.disbursement_date ? format(new Date(loan.disbursement_date), 'dd MMM yyyy') : null} />
          <Field label="Closure Date" value={loan.closure_date ? format(new Date(loan.closure_date), 'dd MMM yyyy') : null} />
          <Field label="Branch" value={loan.branch} />
          <Field label="Cluster" value={loan.cluster} />
          <Field label="Zone" value={loan.zone} />
          <Field label="SO Name" value={loan.so_name} />
          <Field label="Customer Mobile" value={loan.customer_mobile} />
          <Field label="Purpose" value={loan.purpose} />
        </div>
      </div>

      {/* Gold / Pledge Details */}
      {(loan.net_weight || loan.value_pledged || loan.security_details) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-syne font-semibold text-sm mb-4">Pledge / Gold Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Net Weight (g)" value={loan.net_weight} />
            <Field label="Value Pledged" value={loan.value_pledged ? formatINR(loan.value_pledged) : null} />
            <Field label="Approx Value Offered" value={loan.approx_value_offered} />
            <Field label="Security Details" value={loan.security_details} />
          </div>
        </div>
      )}

      {/* Bank Details */}
      {(loan.bank_name || loan.account_number) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-syne font-semibold text-sm mb-4">Bank Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Bank Name" value={loan.bank_name} />
            <Field label="Account Number" value={loan.account_number} />
            <Field label="IFSC Code" value={loan.ifsc_code} />
          </div>
        </div>
      )}

      {/* KYC Documents */}
      {(loan.aadhar_number || loan.pan_number || loan.aadhar_image_url || loan.pan_image_url) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-syne font-semibold text-sm mb-4">KYC Documents</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Aadhar Number" value={loan.aadhar_number} />
            <Field label="PAN Number" value={loan.pan_number} />
            <Field label="Pledge Card No." value={loan.pledge_card_number} />
            <Field label="Security Cheque" value={loan.security_cheque} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {[['Aadhar', loan.aadhar_image_url], ['PAN', loan.pan_image_url], ['Pledge Card', loan.pledge_card_image_url], ['Security Cheque', loan.security_cheque_image_url]].map(([label, url]) => url && (
              <div key={label}>
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <a href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={label} className="h-20 w-full object-cover rounded-lg border border-border hover:opacity-80 transition-opacity" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Trail — visible for pending/rejected loans */}
      {['pending_cluster_approval', 'pending_zonal_approval', 'rejected'].includes(loan.status) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-syne font-semibold text-sm mb-4">Approval Trail</h3>
          <ApprovalTrail loan={loan} />
        </div>
      )}

      {/* Collections History */}
      {collections.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-syne font-semibold text-sm mb-4 flex items-center gap-2">
            <ArrowDownLeft size={15} className="text-green-600" /> Collections History ({collections.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="text-left px-3 py-2 font-medium">Mode</th>
                  <th className="text-left px-3 py-2 font-medium">UTR / Ref</th>
                  <th className="text-left px-3 py-2 font-medium">Notes</th>
                  <th className="text-center px-3 py-2 font-medium">Proof</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((c, i) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{c.credit_note_date ? format(new Date(c.credit_note_date), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-green-600">{formatINR(c.amount_collected)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground capitalize text-xs">{(c.payment_mode || '').replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{c.credit_note_number || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.notes || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      {c.credit_note_image_url
                        ? <a href={c.credit_note_image_url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">View</a>
                        : <span className="text-muted-foreground text-xs">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 border-t-2 border-border font-bold text-sm">
                  <td colSpan={2} className="px-3 py-2.5 text-muted-foreground">Total Collected</td>
                  <td className="px-3 py-2.5 text-right text-green-600">{formatINR(collections.reduce((s, c) => s + (c.amount_collected || 0), 0))}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Memos */}
      {['pending_cluster_approval', 'pending_zonal_approval', 'open', 'closed', 'overdue'].includes(loan.status) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-syne font-semibold text-sm mb-4 flex items-center gap-2">
            <FileText size={15} className="text-primary" /> Memos
          </h3>
          <div className="flex flex-wrap gap-3">
            {/* Disbursement Memo */}
            <div className="flex items-center gap-2">
              <Button
                size="sm" variant="outline" className="gap-2"
                onClick={() => generateMemoPDF('disbursal')}
                disabled={memoLoading.disbursal}
              >
                {memoLoading.disbursal ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                Disbursement Memo
              </Button>
              {memoPdfs.disbursal && (
                <a href={memoPdfs.disbursal} target="_blank" rel="noreferrer">
                  <Button size="sm" className="gap-2 bg-primary">
                    <Download size={13} /> View PDF
                  </Button>
                </a>
              )}
            </div>

            {/* Collection Memo — only if closed */}
            {loan.status === 'closed' && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm" variant="outline" className="gap-2"
                  onClick={() => generateMemoPDF('collection')}
                  disabled={memoLoading.collection}
                >
                  {memoLoading.collection ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                  Collection Memo
                </Button>
                {memoPdfs.collection && (
                  <a href={memoPdfs.collection} target="_blank" rel="noreferrer">
                    <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                      <Download size={13} /> View PDF
                    </Button>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this case?"
        description={`This will permanently delete the case for ${loan.borrower_name}. This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={confirmOverdue}
        onOpenChange={setConfirmOverdue}
        title="Mark as Overdue?"
        description={`This will flag the case for ${loan.borrower_name} as overdue. You can reverse this later.`}
        confirmLabel="Mark Overdue"
        confirmVariant="destructive"
        onConfirm={() => { setConfirmOverdue(false); handleMarkOverdue(); }}
      />
      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={setConfirmReopen}
        title="Re-open this case?"
        description="The loan will be marked as Open and the closure date will be cleared."
        confirmLabel="Re-open"
        onConfirm={() => { setConfirmReopen(false); handleReopen(); }}
      />
      <DisbursalDialog loan={loan} open={disbursalOpen} onOpenChange={setDisbursalOpen} onSaved={load} />
      <CollectionDialog loan={loan} open={collectionOpen} onOpenChange={setCollectionOpen} onSaved={load} />

      {/* Close Case Dialog */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Close Case — {loan.borrower_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span className="font-semibold">{formatINR(loan.principal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Charges</span><span className="font-semibold">{formatINR(charges)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-semibold">{formatINR(gst)}</span></div>
              <div className="flex justify-between font-bold border-t border-border pt-1 mt-1"><span>Total to Collect</span><span>{formatINR(totalBilled)}</span></div>
            </div>
            <div className="space-y-1">
              <Label>Closure Date</Label>
              <Input type="date" value={closureDate} onChange={e => setClosureDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button>
            <Button onClick={handleClose}>Confirm Closure</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Case Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Case — {loan.borrower_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Principal (₹)</Label>
                <Input type="number" value={editData.principal} onChange={e => setEditData(p => ({ ...p, principal: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Rate (%)</Label>
                <Input type="number" step="0.01" value={editData.rate} onChange={e => setEditData(p => ({ ...p, rate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Charges (₹)</Label>
                <Input type="number" value={editData.charges} onChange={e => setEditData(p => ({ ...p, charges: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>GST (₹)</Label>
                <Input type="number" value={editData.gst} onChange={e => setEditData(p => ({ ...p, gst: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-2">
            <Button variant="destructive" onClick={() => { setEditOpen(false); setConfirmDelete(true); }}>Delete Case</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleEditSave}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}