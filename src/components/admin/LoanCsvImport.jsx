import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Download, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

const EXPECTED_HEADERS = [
  'borrower_name', 'customer_mobile', 'principal', 'rate', 'charges',
  'disbursement_date', 'branch', 'cluster', 'zone', 'so_name',
  'purpose', 'net_weight', 'value_pledged', 'bank_name', 'account_number',
  'ifsc_code', 'aadhar_number', 'pan_number', 'pledge_card_number',
  'security_cheque', 'security_details', 'status',
];

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows = lines.slice(1).map(line => {
    const vals = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
  return { headers, rows };
}

const SAMPLE_CSV = `borrower_name,customer_mobile,principal,rate,charges,disbursement_date,branch,cluster,zone,so_name,purpose,bank_name,account_number,ifsc_code,status
Ravi Kumar,9845100001,500000,0.5,,2024-01-10,Vijay Nagar,Mysore,,Vanishree,Business,Canara Bank,123456789,CNRB0000636,open
Priya Sharma,9845100002,1200000,,,2024-02-15,Jayanagar,Bangalore,,Suresh,Gold loan,SBI,987654321,SBIN0001234,open`;

export default function LoanCsvImport() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { headers, rows }
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { success, failed }
  const inputRef = useRef();

  const handleFile = (f) => {
    setFile(f);
    setResult(null);
    setErrors([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCsv(e.target.result);
      const errs = [];
      if (!headers.includes('borrower_name')) errs.push('Missing required column: borrower_name');
      if (!headers.includes('principal')) errs.push('Missing required column: principal');
      if (rows.length === 0) errs.push('No data rows found');
      setErrors(errs);
      setPreview({ headers, rows: rows.slice(0, 5), totalRows: rows.length, allRows: rows });
    };
    reader.readAsText(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) handleFile(f);
  };

  const handleImport = async () => {
    if (!preview || errors.length > 0) return;
    setImporting(true);
    const { allRows } = preview;
    let success = 0, failed = 0;
    const VALID_STATUSES = ['pending_cluster_approval', 'pending_zonal_approval', 'open', 'closed', 'overdue', 'rejected'];

    for (const row of allRows) {
      if (!row.borrower_name && !row.principal) { failed++; continue; }
      const principal = parseFloat(row.principal) || 0;
      const rate = parseFloat(row.rate) || 0;
      const charges = parseFloat(row.charges) || (rate > 0 ? principal * rate / 100 : 0);
      const gst = charges * 0.18;
      const outstanding = principal + charges + gst;
      const statusRaw = row.status?.trim().toLowerCase();
      const status = VALID_STATUSES.includes(statusRaw) ? statusRaw : 'open';
      const loanNumber = `BLP-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
      await base44.entities.Loan.create({
        borrower_name: row.borrower_name,
        customer_mobile: row.customer_mobile || '',
        principal,
        rate,
        charges,
        gst,
        outstanding,
        disbursement_date: row.disbursement_date || '',
        branch: row.branch || '',
        cluster: row.cluster || '',
        zone: row.zone || '',
        so_name: row.so_name || '',
        purpose: row.purpose || '',
        net_weight: parseFloat(row.net_weight) || 0,
        value_pledged: parseFloat(row.value_pledged) || 0,
        bank_name: row.bank_name || '',
        account_number: row.account_number || '',
        ifsc_code: row.ifsc_code || '',
        aadhar_number: row.aadhar_number || '',
        pan_number: row.pan_number || '',
        pledge_card_number: row.pledge_card_number || '',
        security_cheque: row.security_cheque || '',
        security_details: row.security_details || '',
        loan_number: loanNumber,
        status,
      });
      success++;
    }
    setResult({ success, failed });
    setImporting(false);
    setFile(null);
    setPreview(null);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'loan_import_sample.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload size={18} className="text-primary" />
          <h3 className="font-syne font-semibold text-sm">Bulk Import Loans (CSV)</h3>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={downloadSample}>
          <Download size={13} /> Sample CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Upload a CSV with loan records. Required columns: <code className="bg-muted px-1 rounded">borrower_name</code>, <code className="bg-muted px-1 rounded">principal</code>. 
        See the sample for all supported columns.
      </p>

      {/* Drop Zone */}
      {!preview && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
        >
          <Upload size={28} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Drag & drop a CSV file here, or <span className="text-primary font-medium">click to browse</span>
          </p>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={13} /> {err}
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      {preview && errors.length === 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing first {Math.min(5, preview.rows.length)} of <strong>{preview.totalRows}</strong> rows from <strong>{file?.name}</strong>
            </p>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setFile(null); setPreview(null); }}>
              <X size={13} />
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border text-xs">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  {preview.headers.map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {preview.headers.map(h => (
                      <td key={h} className="px-3 py-2 whitespace-nowrap text-foreground">{row[h] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={handleImport} disabled={importing} className="gap-2">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {importing ? 'Importing…' : `Import ${preview.totalRows} Records`}
          </Button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            Import complete — <strong>{result.success}</strong> loans added
            {result.failed > 0 && `, ${result.failed} skipped (missing required fields)`}.
          </p>
        </div>
      )}
    </div>
  );
}