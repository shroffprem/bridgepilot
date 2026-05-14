// Shared MIS computation helpers

export function formatINR(n) {
  if (!n && n !== 0) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export function formatINRFull(n) {
  if (!n && n !== 0) return '₹0';
  return `₹${Math.abs(n).toLocaleString('en-IN')}`;
}

// Days elapsed from disbursement_date to today (or closure_date if closed)
export function calcDays(loan) {
  if (!loan.disbursement_date) return 0;
  const start = new Date(loan.disbursement_date);
  const end = loan.closure_date ? new Date(loan.closure_date) : new Date();
  return Math.max(0, Math.round((end - start) / 86400000));
}

// Compute charges = principal * rate/100 (rate is per-disbursement fixed charge %)
export function calcCharges(loan) {
  if (loan.charges != null && loan.charges > 0) return loan.charges;
  return (loan.principal || 0) * (loan.rate || 0) / 100;
}

export function calcGST(charges) {
  return Math.round(charges * 0.18);
}

// Outstanding for open case = principal + charges + gst
export function calcOutstanding(loan) {
  if (loan.status === 'closed') return 0;
  if (loan.outstanding != null && loan.outstanding > 0) return loan.outstanding;
  const charges = calcCharges(loan);
  return (loan.principal || 0) + charges + calcGST(charges);
}

// ROI = charges / principal (%)
export function calcROI(principal, charges) {
  if (!principal) return 0;
  return (charges / principal) * 100;
}

// Average TAT for a set of loans (days from disbursement to closure)
export function avgTAT(loans) {
  const closed = loans.filter(l => l.closure_date && l.disbursement_date);
  if (!closed.length) return null;
  const total = closed.reduce((s, l) => s + calcDays(l), 0);
  return (total / closed.length).toFixed(1);
}

// Group loans by cluster and compute summary
export function clusterSummary(loans) {
  const map = {};
  for (const l of loans) {
    const key = l.cluster || 'Other';
    if (!map[key]) map[key] = { cluster: key, cases: 0, closed: 0, principal: 0, charges: 0, gst: 0, outstanding: 0, loans: [] };
    const charges = calcCharges(l);
    const gst = l.gst != null ? l.gst : calcGST(charges);
    map[key].cases++;
    if (l.status === 'closed') map[key].closed++;
    map[key].principal += l.principal || 0;
    map[key].charges += charges;
    map[key].gst += gst;
    map[key].outstanding += calcOutstanding(l);
    map[key].loans.push(l);
  }
  return Object.values(map).sort((a, b) => b.charges - a.charges);
}

// Month key: "Apr 2026"
export function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

// Group loans by disbursement month
export function monthlyBreakdown(loans) {
  const map = {};
  for (const l of loans) {
    const key = monthKey(l.disbursement_date);
    if (!key) continue;
    if (!map[key]) map[key] = { month: key, cases: 0, volume: 0, charges: 0, gst: 0, collected: 0, outstanding: 0, closed: 0, open: 0, tats: [] };
    const charges = calcCharges(l);
    const gst = l.gst != null ? l.gst : calcGST(charges);
    map[key].cases++;
    map[key].volume += l.principal || 0;
    map[key].charges += charges;
    map[key].gst += gst;
    if (l.status === 'closed') {
      map[key].closed++;
      map[key].collected += (l.principal || 0) + charges + gst;
      if (l.disbursement_date && l.closure_date) {
        map[key].tats.push(calcDays(l));
      }
    } else {
      map[key].open++;
      map[key].outstanding += calcOutstanding(l);
    }
  }
  return Object.values(map).sort((a, b) => new Date(a.month) - new Date(b.month));
}