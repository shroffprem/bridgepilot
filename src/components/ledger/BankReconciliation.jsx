import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/mis';
import { format, parseISO } from 'date-fns';
import { Upload, CheckCircle2, AlertCircle, HelpCircle, FileSpreadsheet, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── helpers ──────────────────────────────────────────────────────────────────

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return 0;
  return parseFloat(String(val).replace(/[₹,\s]/g, '')) || 0;
}

function normaliseDate(raw) {
  // Try ISO first
  if (!raw) return null;
  const s = String(raw).trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function normaliseRef(s) {
  return String(s || '').replace(/\s+/g, '').toUpperCase();
}

// ── AI-powered parsing ────────────────────────────────────────────────────────

const ROW_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date:        { type: 'string', description: 'Transaction date in YYYY-MM-DD format' },
          description: { type: 'string', description: 'Narration / description' },
          debit:       { type: 'number', description: 'Amount debited (money going out). 0 if none.' },
          credit:      { type: 'number', description: 'Amount credited (money coming in). 0 if none.' },
          reference:   { type: 'string', description: 'UTR / cheque no / reference number if present' },
          balance:     { type: 'number', description: 'Closing balance after this transaction, if present. 0 if absent.' },
        },
        required: ['date', 'description', 'debit', 'credit']
      }
    }
  },
  required: ['rows']
};

async function extractBankRows(file) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  const isPdf = file.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    // Use InvokeLLM with file_urls — handles PDFs via vision model
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `This is a bank statement PDF. Extract ALL transactions from it into a structured list.
For each transaction row return:
- date: in YYYY-MM-DD format
- description: narration / merchant name
- debit: amount debited/withdrawn (number, 0 if none)
- credit: amount credited/deposited (number, 0 if none)
- reference: UTR / cheque number / reference ID (empty string if absent)
- balance: closing balance after this row (0 if not shown)

Return ONLY the JSON object with a "rows" array. Do not include any other text.`,
      file_urls: [file_url],
      response_json_schema: ROW_SCHEMA,
    });
    return result.rows || [];
  } else {
    // CSV / XLSX — use the structured extractor
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: ROW_SCHEMA,
    });
    if (result.status !== 'success') throw new Error(result.details || 'Could not parse file');
    return result.output.rows || [];
  }
}

// ── reconciliation logic ──────────────────────────────────────────────────────

function reconcile(bankRows, disbursals, collections) {
  const systemEntries = [
    ...disbursals.map(d => ({
      id: d.id, type: 'disbursal', date: d.debit_note_date,
      amount: d.principal || 0, ref: d.debit_note_number || '',
      label: d.borrower_name || '—', loan_number: d.loan_number || '—',
      branch: d.branch || '—',
    })),
    ...collections.map(c => ({
      id: c.id, type: 'collection', date: c.credit_note_date,
      amount: c.amount_collected || 0, ref: c.credit_note_number || '',
      label: c.borrower_name || '—', loan_number: c.loan_number || '—',
      branch: c.branch || '—',
    })),
  ];

  const usedBank = new Set();
  const usedSystem = new Set();
  const matched = [];

  for (const s of systemEntries) {
    const normRef = normaliseRef(s.ref);
    // Try ref + amount match first
    let bankIdx = bankRows.findIndex((b, i) => {
      if (usedBank.has(i)) return false;
      const bankAmt = s.type === 'disbursal' ? b.debit : b.credit;
      return Math.abs(bankAmt - s.amount) < 1 && normRef && normRef === normaliseRef(b.reference);
    });

    // Fall back: date + amount match (within 1 day)
    if (bankIdx === -1) {
      bankIdx = bankRows.findIndex((b, i) => {
        if (usedBank.has(i)) return false;
        const bankAmt = s.type === 'disbursal' ? b.debit : b.credit;
        if (Math.abs(bankAmt - s.amount) >= 1) return false;
        const bd = normaliseDate(b.date);
        if (!bd || !s.date) return false;
        const diff = Math.abs(new Date(bd) - new Date(s.date)) / 86400000;
        return diff <= 1;
      });
    }

    if (bankIdx !== -1) {
      usedBank.add(bankIdx);
      usedSystem.add(s.id);
      matched.push({ system: s, bank: bankRows[bankIdx] });
    }
  }

  const missingInBank = systemEntries.filter(s => !usedSystem.has(s.id));
  const extraInBank   = bankRows.filter((_, i) => !usedBank.has(i) && (bankRows[i].debit > 0 || bankRows[i].credit > 0));

  return { matched, missingInBank, extraInBank };
}

// ── component ─────────────────────────────────────────────────────────────────

export default function BankReconciliation({ disbursals, collections }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [activeSection, setActiveSection] = useState('matched');

  const handleFile = e => {
    setFile(e.target.files[0] || null);
    setResult(null);
    setError('');
  };

  const handleReconcile = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    const bankRows = await extractBankRows(file);
    const r = reconcile(bankRows, disbursals, collections);
    setResult({ ...r, bankRows });
    setLoading(false);
  };

  const sections = result ? [
    { key: 'matched',       label: 'Matched',            count: result.matched.length,       color: 'text-green-600' },
    { key: 'missingInBank', label: 'In System, Not Bank', count: result.missingInBank.length, color: 'text-yellow-600' },
    { key: 'extraInBank',   label: 'In Bank, Not System', count: result.extraInBank.length,   color: 'text-red-600' },
  ] : [];

  return (
    <div className="space-y-5">
      {/* Upload area */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-primary" />
          <h3 className="font-semibold text-sm">Upload Bank Statement</h3>
        </div>

        <div className="flex items-start gap-2 bg-accent/40 border border-accent rounded-lg px-3 py-2.5 text-xs text-accent-foreground">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>Upload a CSV, Excel, or PDF bank statement. The AI will auto-detect columns for Date, Debit, Credit, and Reference and match them against your disbursals and collections.</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <label className={`flex-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${file ? 'border-primary bg-accent/30' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}>
            <Upload size={22} className={file ? 'text-primary' : 'text-muted-foreground'} />
            <span className="text-sm text-center">
              {file ? file.name : 'Click to upload CSV / Excel bank statement'}
            </span>
            <span className="text-xs text-muted-foreground">.csv, .xlsx, .xls, .pdf supported</span>
            <input type="file" accept=".csv,.xlsx,.xls,.pdf" className="hidden" onChange={handleFile} />
          </label>

          <Button onClick={handleReconcile} disabled={!file || loading} className="gap-2 sm:self-end">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {loading ? 'Reconciling…' : 'Reconcile'}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary pills */}
          <div className="grid grid-cols-3 gap-3">
            {sections.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`rounded-xl border p-4 text-left transition-all ${activeSection === s.key ? 'border-primary bg-accent/30' : 'border-border bg-card hover:bg-muted/30'}`}
              >
                <div className={`text-2xl font-bold font-syne ${s.color}`}>{s.count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </button>
            ))}
          </div>

          {/* Matched table */}
          {activeSection === 'matched' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <CheckCircle2 size={15} className="text-green-600" />
                <span className="text-sm font-semibold">Matched Transactions</span>
              </div>
              {result.matched.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No matches found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground uppercase tracking-wide border-b border-border">
                        <th className="text-left px-4 py-2.5">Date</th>
                        <th className="text-left px-4 py-2.5">Type</th>
                        <th className="text-left px-4 py-2.5">Borrower</th>
                        <th className="text-left px-4 py-2.5">System Ref</th>
                        <th className="text-right px-4 py-2.5">System Amt</th>
                        <th className="text-left px-4 py-2.5">Bank Narration</th>
                        <th className="text-left px-4 py-2.5">Bank Ref</th>
                        <th className="text-right px-4 py-2.5">Bank Amt</th>
                        <th className="text-center px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.matched.map((m, i) => {
                        const bankAmt = m.system.type === 'disbursal' ? m.bank.debit : m.bank.credit;
                        const exact = Math.abs(bankAmt - m.system.amount) < 1 && normaliseRef(m.system.ref) === normaliseRef(m.bank.reference);
                        return (
                          <tr key={i} className="border-t border-border hover:bg-muted/20">
                            <td className="px-4 py-2.5 whitespace-nowrap">{m.system.date ? format(parseISO(m.system.date), 'dd MMM') : '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${m.system.type === 'disbursal' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {m.system.type === 'disbursal' ? 'Disbursal' : 'Collection'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-medium">{m.system.label}</td>
                            <td className="px-4 py-2.5 font-mono text-muted-foreground">{m.system.ref || '—'}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">{formatINR(m.system.amount)}</td>
                            <td className="px-4 py-2.5 text-muted-foreground max-w-[180px] truncate">{m.bank.description}</td>
                            <td className="px-4 py-2.5 font-mono text-muted-foreground">{m.bank.reference || '—'}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">{formatINR(bankAmt)}</td>
                            <td className="px-4 py-2.5 text-center">
                              {exact
                                ? <span className="text-green-600 flex items-center justify-center gap-1"><CheckCircle2 size={13} /> Exact</span>
                                : <span className="text-yellow-600 flex items-center justify-center gap-1"><AlertCircle size={13} /> Fuzzy</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Missing in bank */}
          {activeSection === 'missingInBank' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <AlertCircle size={15} className="text-yellow-600" />
                <span className="text-sm font-semibold">In System — Not Found in Bank Statement</span>
              </div>
              {result.missingInBank.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">All system entries found in bank. ✓</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground uppercase tracking-wide border-b border-border">
                        <th className="text-left px-4 py-2.5">Date</th>
                        <th className="text-left px-4 py-2.5">Type</th>
                        <th className="text-left px-4 py-2.5">Borrower</th>
                        <th className="text-left px-4 py-2.5">Case #</th>
                        <th className="text-left px-4 py-2.5">Ref</th>
                        <th className="text-left px-4 py-2.5">Branch</th>
                        <th className="text-right px-4 py-2.5">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.missingInBank.map((s, i) => (
                        <tr key={i} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-2.5 whitespace-nowrap">{s.date ? format(parseISO(s.date), 'dd MMM yyyy') : '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${s.type === 'disbursal' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                              {s.type === 'disbursal' ? 'Disbursal' : 'Collection'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-medium">{s.label}</td>
                          <td className="px-4 py-2.5 font-mono text-muted-foreground">{s.loan_number}</td>
                          <td className="px-4 py-2.5 font-mono text-muted-foreground">{s.ref || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{s.branch}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{formatINR(s.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Extra in bank */}
          {activeSection === 'extraInBank' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <HelpCircle size={15} className="text-red-600" />
                <span className="text-sm font-semibold">In Bank — No Matching System Entry</span>
              </div>
              {result.extraInBank.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No unmatched bank entries. ✓</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground uppercase tracking-wide border-b border-border">
                        <th className="text-left px-4 py-2.5">Date</th>
                        <th className="text-left px-4 py-2.5">Description</th>
                        <th className="text-left px-4 py-2.5">Reference</th>
                        <th className="text-right px-4 py-2.5">Debit (Out)</th>
                        <th className="text-right px-4 py-2.5">Credit (In)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.extraInBank.map((b, i) => (
                        <tr key={i} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-2.5 whitespace-nowrap">{b.date ? format(parseISO(normaliseDate(b.date) || b.date), 'dd MMM yyyy') : '—'}</td>
                          <td className="px-4 py-2.5 max-w-[220px] truncate">{b.description}</td>
                          <td className="px-4 py-2.5 font-mono text-muted-foreground">{b.reference || '—'}</td>
                          <td className="px-4 py-2.5 text-right text-red-600 font-semibold">{b.debit > 0 ? formatINR(b.debit) : '—'}</td>
                          <td className="px-4 py-2.5 text-right text-green-600 font-semibold">{b.credit > 0 ? formatINR(b.credit) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}