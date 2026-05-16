import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@2.5.1';
import { format, getYear, endOfMonth, differenceInDays } from 'npm:date-fns@3.6.0';

// ── BridgeLine Partners brand constants ──────────────────────
const NAVY = [26, 39, 68];
const GOLD = [201, 168, 76];
const LOGO_URL = 'https://media.base44.com/images/public/6a056f02e19305d21d34b219/fa91ede9e_BLPLogo.png';

async function fetchLogoBase64() {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Validate PNG magic bytes
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) return null;
    const CHUNK = 4096;
    let base64 = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      base64 += btoa(String.fromCharCode(...Array.from(slice)));
    }
    return 'data:image/png;base64,' + base64;
  } catch { return null; }
}

function drawLetterhead(doc, logoBase64, W, margin) {
  const pageH = doc.internal.pageSize.height;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 42, 'F');

  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', margin, 7, 24, 24); } catch (_) { /* skip logo if corrupt */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const logoRight = margin + 27;
  doc.text('BridgeLine', logoRight, 22);
  const blW = doc.getTextWidth('BridgeLine');
  doc.setFont('helvetica', 'normal');
  doc.text('Partners', logoRight + blW + 1.5, 22);

  const rx = W - margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...GOLD);
  doc.text('ADDRESS', rx, 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('2nd Floor, 3282/1, Apt No 5, Ashraya Residency,', rx, 13, { align: 'right' });
  doc.text('Vijaynagar 3rd Stage, E Block, Garudachar Layout,', rx, 17.5, { align: 'right' });
  doc.text('Mysuru, Karnataka - 570030', rx, 22, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...GOLD);
  doc.text('CONTACT', rx, 27.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('+91 96862 88166  |  +91 98451 22023', rx, 32.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...GOLD);
  doc.text('GSTIN', rx, 38, { align: 'right' });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(margin, 43.5, W - margin, 43.5);
  doc.setLineWidth(0.2);

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(margin, pageH - 14, W - margin, pageH - 14);
  doc.setLineWidth(0.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  const bText = 'BridgeLine';
  const pText = 'Partners';
  const bW2 = doc.getTextWidth(bText);
  const pW = doc.getTextWidth(pText);
  const totalFW = bW2 + pW + 0.5;
  const footerX = W / 2;
  doc.text(bText, footerX - totalFW / 2, pageH - 8);
  doc.setTextColor(...GOLD);
  doc.text(pText, footerX - totalFW / 2 + bW2 + 0.5, pageH - 8);
}

// ── Helpers ──────────────────────────────────────────────────
function calcCharges(l) {
  if (l.charges != null && l.charges > 0) return l.charges;
  return (l.principal || 0) * (l.rate || 0) / 100;
}
function calcGST(charges) { return Math.round(charges * 0.18); }
function calcOutstanding(l) {
  if (l.status === 'closed') return 0;
  if (l.outstanding != null && l.outstanding > 0) return l.outstanding;
  const charges = calcCharges(l);
  return (l.principal || 0) + charges + calcGST(charges);
}
function formatINR(n) {
  if (!n) return '0';
  return Math.round(n).toLocaleString('en-IN');
}
function normalizeStatus(status) {
  if (!status) return 'pending_cluster_approval';
  if (status === 'Follow Up!' || status === 'follow_up') return 'follow_up';
  if (status === 'open' || status === 'Open') return 'open';
  if (status === 'closed' || status === 'Closed') return 'closed';
  if (status === 'overdue' || status === 'Overdue') return 'overdue';
  return status;
}
function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
function avgTAT(loanList) {
  const closed = loanList.filter(l => l.closure_date && l.disbursement_date);
  if (!closed.length) return '-';
  const total = closed.reduce((s, l) => {
    const days = Math.max(0, Math.round((new Date(l.closure_date) - new Date(l.disbursement_date)) / 86400000));
    return s + days;
  }, 0);
  return (total / closed.length).toFixed(1);
}

// ── Section drawing helpers ───────────────────────────────────
function checkPageBreak(doc, logoBase64, W, margin, y, needed) {
  const pageH = doc.internal.pageSize.height;
  if (y + needed > pageH - 20) {
    doc.addPage();
    drawLetterhead(doc, logoBase64, W, margin);
    return 52;
  }
  return y;
}

function drawSectionHeader(doc, text, margin, y, W) {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(text, margin, y);
  return y + 5;
}

function drawTableHeader(doc, headers, widths, margin, y, fullW) {
  const useW = fullW || widths.reduce((a, b) => a + b, 0);
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, useW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  let xPos = margin + 1;
  headers.forEach((h, i) => {
    const align = i >= 1 ? 'right' : 'left';
    doc.text(h, align === 'right' ? xPos + widths[i] - 2 : xPos, y + 5, { align });
    xPos += widths[i];
  });
  return y + 8;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const reportType = body.reportType || 'mtd';

    const [rawLoans, capitalEntries] = await Promise.all([
      base44.entities.Loan.list(),
      base44.entities.CapitalEntry.list(),
    ]);

    const loans = rawLoans.map(l => ({ ...l, status: normalizeStatus(l.status) }));

    const today = new Date();
    const currentYear = getYear(today);
    const currentMonthKey = today.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    // Period loans
    const periodLoans = reportType === 'mtd'
      ? loans.filter(l => l.disbursement_date && monthKey(l.disbursement_date) === currentMonthKey)
      : loans.filter(l => l.disbursement_date && getYear(new Date(l.disbursement_date)) === currentYear);

    // Capital deployed
    const capitalDeployed = capitalEntries.reduce((s, e) => e.type === 'addition' ? s + e.amount : s - e.amount, 0);

    // ── Monthly breakdown ─────────────────────────────────────
    const monthMap = {};
    for (const l of periodLoans) {
      const key = monthKey(l.disbursement_date);
      if (!key) continue;
      if (!monthMap[key]) monthMap[key] = { month: key, cases: 0, volume: 0, charges: 0, gst: 0, collected: 0, outstanding: 0, closed: 0, open: 0 };
      const charges = calcCharges(l);
      const gst = l.gst != null ? l.gst : calcGST(charges);
      monthMap[key].cases++;
      monthMap[key].volume += l.principal || 0;
      monthMap[key].charges += charges;
      monthMap[key].gst += gst;
      if (l.status === 'closed') {
        monthMap[key].closed++;
        monthMap[key].collected += (l.principal || 0) + charges + gst;
      } else {
        monthMap[key].open++;
        monthMap[key].outstanding += calcOutstanding(l);
      }
    }
    const monthlyRows = Object.values(monthMap).sort((a, b) => new Date(a.month) - new Date(b.month));

    // ── Summary totals ────────────────────────────────────────
    const totalCases = periodLoans.length;
    const totalVolume = periodLoans.reduce((s, l) => s + (l.principal || 0), 0);
    const totalCharges = periodLoans.reduce((s, l) => s + calcCharges(l), 0);
    const totalOutstanding = periodLoans.filter(l => l.status !== 'closed').reduce((s, l) => s + calcOutstanding(l), 0);
    const totalCollected = periodLoans.filter(l => l.status === 'closed').reduce((s, l) => s + (l.principal || 0) + calcCharges(l), 0);
    const totalClosed = periodLoans.filter(l => l.status === 'closed').length;
    const totalOpen = periodLoans.filter(l => l.status === 'open' || l.status === 'overdue').length;

    // ── MTD Goalpost ──────────────────────────────────────────
    const monthlyTarget = capitalDeployed * 0.04;
    const mtdCharges = periodLoans.reduce((s, l) => s + calcCharges(l), 0);
    const pctAchieved = monthlyTarget > 0 ? Math.min(100, (mtdCharges / monthlyTarget) * 100) : 0;
    const daysLeftInMonth = differenceInDays(endOfMonth(today), today) + 1;
    const remaining = Math.max(0, monthlyTarget - mtdCharges);
    const dailyChargeNeeded = daysLeftInMonth > 0 ? remaining / daysLeftInMonth : 0;

    // ── Open Cases (all clusters) ─────────────────────────────
    const openStatuses = ['open', 'overdue', 'pending_cluster_approval', 'pending_zonal_approval', 'follow_up'];
    const openCases = loans
      .filter(l => openStatuses.includes(l.status))
      .map(l => {
        const charges = calcCharges(l);
        const outstanding = calcOutstanding(l);
        const days = l.disbursement_date ? Math.round((today - new Date(l.disbursement_date)) / 86400000) : 0;
        return { ...l, _charges: charges, _outstanding: outstanding, _days: days };
      })
      .sort((a, b) => a._days - b._days);

    // ── Overdue Ageing ────────────────────────────────────────
    const overdueLoans = loans.filter(l => l.status === 'overdue');
    const ageBuckets = [
      { label: '1-7 days',   min: 1,  max: 7  },
      { label: '8-15 days',  min: 8,  max: 15 },
      { label: '16-30 days', min: 16, max: 30 },
      { label: '31-60 days', min: 31, max: 60 },
      { label: '61-90 days', min: 61, max: 90 },
      { label: '> 90 days',  min: 91, max: 9999 },
    ];
    const ageingRows = ageBuckets.map(b => {
      const bucket = overdueLoans.filter(l => {
        const d = l.disbursement_date ? differenceInDays(today, new Date(l.disbursement_date)) : 0;
        return d >= b.min && d <= b.max;
      });
      return { label: b.label, count: bucket.length, outstanding: bucket.reduce((s, l) => s + calcOutstanding(l), 0) };
    });

    // ── Cluster Summary (open cases only) ─────────────────────
    const clusterSummaryMap = {};
    openCases.forEach(l => {
      const key = l.cluster || 'Other';
      if (!clusterSummaryMap[key]) clusterSummaryMap[key] = { cluster: key, count: 0, principal: 0, charges: 0, outstanding: 0 };
      clusterSummaryMap[key].count++;
      clusterSummaryMap[key].principal += l.principal || 0;
      clusterSummaryMap[key].charges += l._charges;
      clusterSummaryMap[key].outstanding += l._outstanding;
    });
    const clusterSummaryRows = Object.values(clusterSummaryMap).sort((a, b) => b.outstanding - a.outstanding);

    // ── Cluster Analytics (all loans, YTD-style) ──────────────
    const analyticsMap = {};
    loans.forEach(l => {
      const key = l.cluster || 'Other';
      if (!analyticsMap[key]) analyticsMap[key] = { cluster: key, loans: [], cases: 0, closed: 0, principal: 0, charges: 0 };
      analyticsMap[key].cases++;
      if (l.status === 'closed') analyticsMap[key].closed++;
      analyticsMap[key].principal += l.principal || 0;
      analyticsMap[key].charges += calcCharges(l);
      analyticsMap[key].loans.push(l);
    });
    const analyticsRows = Object.values(analyticsMap).sort((a, b) => b.charges - a.charges);

    // ── Build PDF ─────────────────────────────────────────────
    const logoBase64 = await fetchLogoBase64();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.height;
    const margin = 14;
    const contentW = W - margin * 2;
    const todayStr = format(today, 'dd-MMM-yyyy');
    const periodLabel = reportType === 'mtd'
      ? format(today, 'MMMM yyyy')
      : `January - December ${currentYear}`;

    drawLetterhead(doc, logoBase64, W, margin);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text('29ABGFB6346P1ZR', W - margin, 48.5, { align: 'right' });

    let y = 52;
    let xPos;

    // ── 1. Report title band ───────────────────────────────────
    doc.setFillColor(...NAVY);
    doc.roundedRect(margin, y, contentW, 10, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`PORTFOLIO OVERVIEW - ${reportType.toUpperCase()}  (${periodLabel})`, margin + 4, y + 7);
    doc.setFontSize(8);
    doc.text(`As of ${todayStr}`, W - margin - 2, y + 7, { align: 'right' });
    y += 14;

    // ── 2. KPI boxes ──────────────────────────────────────────
    const kpis = [
      { label: 'CASES DISBURSED', value: `${totalCases}  (${totalOpen} open / ${totalClosed} closed)` },
      { label: 'TOTAL DISBURSED', value: 'Rs ' + formatINR(totalVolume) },
      { label: 'CHARGES EARNED',  value: 'Rs ' + formatINR(totalCharges) },
      { label: 'OUTSTANDING',     value: 'Rs ' + formatINR(totalOutstanding) },
    ];
    const kpiW = contentW / kpis.length - 2;
    kpis.forEach((kpi, i) => {
      const kx = margin + i * (kpiW + 2.7);
      doc.setFillColor(...NAVY);
      doc.roundedRect(kx, y, kpiW, 14, 1, 1, 'F');
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text(kpi.label, kx + 3, y + 5);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.text(kpi.value, kx + 3, y + 11, { maxWidth: kpiW - 4 });
    });
    y += 20;

    // ── 3. Month-wise breakdown table ─────────────────────────
    y = checkPageBreak(doc, logoBase64, W, margin, y, 50);
    y = drawSectionHeader(doc, 'MONTH-WISE BREAKDOWN', margin, y, W);

    const mHeaders = ['MONTH', 'CASES', 'VOLUME', 'CHARGES', 'COLLECTED', 'OUTSTANDING', 'CL/OP', 'ROI%'];
    const mWidths  = [24, 13, 24, 22, 24, 26, 14, 16];
    y = drawTableHeader(doc, mHeaders, mWidths, margin, y, contentW);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    monthlyRows.forEach((m, idx) => {
      y = checkPageBreak(doc, logoBase64, W, margin, y, 8);
      const roi = capitalDeployed > 0 ? ((m.charges / capitalDeployed) * 100).toFixed(2) : '0';
      const rowData = [m.month, String(m.cases), 'Rs ' + formatINR(m.volume), 'Rs ' + formatINR(m.charges), 'Rs ' + formatINR(m.collected), 'Rs ' + formatINR(m.outstanding), `${m.closed}/${m.open}`, roi + '%'];
      if (idx % 2 === 0) { doc.setFillColor(245, 247, 252); doc.rect(margin, y - 3, contentW, 5.5, 'F'); }
      doc.setTextColor(30, 30, 50);
      xPos = margin + 1;
      rowData.forEach((cell, i) => {
        const align = i >= 1 ? 'right' : 'left';
        doc.text(cell, align === 'right' ? xPos + mWidths[i] - 2 : xPos, y, { align });
        xPos += mWidths[i];
      });
      doc.setDrawColor(220, 225, 235);
      doc.line(margin, y + 2, margin + contentW, y + 2);
      y += 5.5;
    });

    if (monthlyRows.length > 1) {
      y += 2;
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, contentW, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      const totROI = capitalDeployed > 0 ? ((totalCharges / capitalDeployed) * 100).toFixed(2) : '0';
      const totData = ['TOTAL', String(totalCases), 'Rs ' + formatINR(totalVolume), 'Rs ' + formatINR(totalCharges), 'Rs ' + formatINR(totalCollected), 'Rs ' + formatINR(totalOutstanding), `${totalClosed}/${totalOpen}`, totROI + '%'];
      xPos = margin + 1;
      totData.forEach((cell, i) => {
        const align = i >= 1 ? 'right' : 'left';
        doc.text(cell, align === 'right' ? xPos + mWidths[i] - 2 : xPos, y + 5, { align });
        xPos += mWidths[i];
      });
      y += 12;
    }

    // ── 4. Monthly Goalpost (MTD only) ────────────────────────
    if (reportType === 'mtd') {
      y += 4;
      y = checkPageBreak(doc, logoBase64, W, margin, y, 50);
      y = drawSectionHeader(doc, `MONTHLY ROI GOALPOST - ${format(today, 'MMM yyyy')}  (4% of deployed capital)`, margin, y, W);

      const barW = contentW;
      doc.setFillColor(230, 233, 240);
      doc.roundedRect(margin, y, barW, 6, 1, 1, 'F');
      const fillW = Math.max(2, (pctAchieved / 100) * barW);
      doc.setFillColor(...NAVY);
      doc.roundedRect(margin, y, fillW, 6, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...NAVY);
      doc.text(`${pctAchieved.toFixed(1)}% achieved`, W - margin, y + 4.5, { align: 'right' });
      y += 10;

      const goalKpis = [
        { label: 'CAPITAL DEPLOYED', value: 'Rs ' + formatINR(capitalDeployed) },
        { label: 'CHARGES EARNED',   value: 'Rs ' + formatINR(mtdCharges) },
        { label: 'REMAINING',        value: 'Rs ' + formatINR(remaining) },
        { label: 'DAYS LEFT',        value: String(daysLeftInMonth) },
        { label: 'DAILY NEEDED',     value: 'Rs ' + formatINR(dailyChargeNeeded) },
        { label: 'TARGET (4%)',       value: 'Rs ' + formatINR(monthlyTarget) },
      ];
      const gkpiW = (contentW - 5 * 2) / 6;
      goalKpis.forEach((kpi, i) => {
        const kx = margin + i * (gkpiW + 2);
        doc.setFillColor(245, 247, 252);
        doc.roundedRect(kx, y, gkpiW, 14, 1, 1, 'F');
        doc.setDrawColor(...NAVY);
        doc.setLineWidth(0.3);
        doc.roundedRect(kx, y, gkpiW, 14, 1, 1, 'S');
        doc.setLineWidth(0.2);
        doc.setTextColor(...NAVY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.text(kpi.label, kx + 2, y + 5);
        doc.setFontSize(7.5);
        doc.setTextColor(30, 30, 50);
        doc.text(kpi.value, kx + 2, y + 11, { maxWidth: gkpiW - 3 });
      });
      y += 20;
    }

    // ── 5. Overdue Ageing ─────────────────────────────────────
    y += 4;
    y = checkPageBreak(doc, logoBase64, W, margin, y, 60);
    y = drawSectionHeader(doc, 'OVERDUE AGEING ANALYSIS', margin, y, W);

    const aHeaders = ['AGE BUCKET', 'COUNT', 'OUTSTANDING (Rs)'];
    const aWidths  = [50, 20, 50];
    const aContentW = aWidths.reduce((a, b) => a + b, 0);
    y = drawTableHeader(doc, aHeaders, aWidths, margin, y, aContentW);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const totalOverdueAmt = ageingRows.reduce((s, r) => s + r.outstanding, 0);
    const totalOverdueCount = ageingRows.reduce((s, r) => s + r.count, 0);

    ageingRows.forEach((r, idx) => {
      if (r.count === 0) return;
      y = checkPageBreak(doc, logoBase64, W, margin, y, 8);
      if (idx % 2 === 0) { doc.setFillColor(245, 247, 252); doc.rect(margin, y - 3, aContentW, 6, 'F'); }
      doc.setTextColor(30, 30, 50);
      xPos = margin + 1;
      [r.label, String(r.count), 'Rs ' + formatINR(r.outstanding)].forEach((cell, i) => {
        const align = i >= 1 ? 'right' : 'left';
        doc.text(cell, align === 'right' ? xPos + aWidths[i] - 2 : xPos, y, { align });
        xPos += aWidths[i];
      });
      doc.setDrawColor(220, 225, 235);
      doc.line(margin, y + 2, margin + aContentW, y + 2);
      y += 6;
    });

    if (totalOverdueCount > 0) {
      y += 1;
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, aContentW, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      xPos = margin + 1;
      ['TOTAL', String(totalOverdueCount), 'Rs ' + formatINR(totalOverdueAmt)].forEach((cell, i) => {
        const align = i >= 1 ? 'right' : 'left';
        doc.text(cell, align === 'right' ? xPos + aWidths[i] - 2 : xPos, y + 5, { align });
        xPos += aWidths[i];
      });
      y += 12;
    }

    // ── 6. Cluster Summary (open cases) ──────────────────────
    y += 4;
    y = checkPageBreak(doc, logoBase64, W, margin, y, 60);
    y = drawSectionHeader(doc, 'CLUSTER SUMMARY - OPEN CASES', margin, y, W);

    const csHeaders = ['CLUSTER', 'CASES', 'PRINCIPAL', 'CHARGES', 'OUTSTANDING'];
    const csWidths  = [38, 16, 28, 26, 30];
    const csContentW = csWidths.reduce((a, b) => a + b, 0);
    y = drawTableHeader(doc, csHeaders, csWidths, margin, y, csContentW);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 50);

    clusterSummaryRows.forEach((c, idx) => {
      y = checkPageBreak(doc, logoBase64, W, margin, y, 8);
      if (idx % 2 === 0) { doc.setFillColor(245, 247, 252); doc.rect(margin, y - 3, csContentW, 6, 'F'); }
      const rowData = [c.cluster, String(c.count), 'Rs ' + formatINR(c.principal), 'Rs ' + formatINR(c.charges), 'Rs ' + formatINR(c.outstanding)];
      xPos = margin + 1;
      rowData.forEach((cell, i) => {
        const align = i >= 1 ? 'right' : 'left';
        doc.text(cell, align === 'right' ? xPos + csWidths[i] - 2 : xPos, y, { align });
        xPos += csWidths[i];
      });
      doc.setDrawColor(220, 225, 235);
      doc.line(margin, y + 2, margin + csContentW, y + 2);
      y += 6;
    });

    // ── 7. Open Cases Table ───────────────────────────────────
    y += 6;
    y = checkPageBreak(doc, logoBase64, W, margin, y, 50);
    y = drawSectionHeader(doc, 'OPEN CASES - ALL CLUSTERS', margin, y, W);

    const ocHeaders = ['DATE', 'CUSTOMER', 'CLUSTER/BRANCH', 'PRINCIPAL', 'CHARGES', 'OUTSTANDING', 'DAYS'];
    const ocWidths  = [18, 35, 30, 22, 20, 24, 14];
    const ocContentW = ocWidths.reduce((a, b) => a + b, 0);
    y = drawTableHeader(doc, ocHeaders, ocWidths, margin, y, ocContentW);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 30, 50);

    openCases.forEach((l, idx) => {
      y = checkPageBreak(doc, logoBase64, W, margin, y, 7);
      if (idx % 2 === 0) { doc.setFillColor(245, 247, 252); doc.rect(margin, y - 3, ocContentW, 5.5, 'F'); }
      const dateStr = l.disbursement_date ? format(new Date(l.disbursement_date), 'dd-MMM') : '-';
      const clBr = [l.cluster, l.branch].filter(Boolean).join('/') || '-';
      const rowData = [dateStr, l.borrower_name || '-', clBr, 'Rs ' + formatINR(l.principal), 'Rs ' + formatINR(l._charges), 'Rs ' + formatINR(l._outstanding), String(l._days)];
      xPos = margin + 1;
      rowData.forEach((cell, i) => {
        const align = i >= 1 ? 'right' : 'left';
        const cellText = doc.splitTextToSize(cell, i === 1 ? ocWidths[i] - 2 : ocWidths[i] - 1)[0];
        doc.text(cellText, align === 'right' ? xPos + ocWidths[i] - 2 : xPos, y, { align });
        xPos += ocWidths[i];
      });
      doc.setDrawColor(220, 225, 235);
      doc.line(margin, y + 2, margin + ocContentW, y + 2);
      y += 5.5;
    });

    // Open cases total row
    if (openCases.length > 0) {
      y += 1;
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, ocContentW, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      const ocTotPrincipal = openCases.reduce((s, l) => s + (l.principal || 0), 0);
      const ocTotCharges   = openCases.reduce((s, l) => s + l._charges, 0);
      const ocTotOut       = openCases.reduce((s, l) => s + l._outstanding, 0);
      const totRowData = [`TOTAL (${openCases.length})`, '', '', 'Rs ' + formatINR(ocTotPrincipal), 'Rs ' + formatINR(ocTotCharges), 'Rs ' + formatINR(ocTotOut), ''];
      xPos = margin + 1;
      totRowData.forEach((cell, i) => {
        const align = i >= 1 ? 'right' : 'left';
        if (cell) doc.text(cell, align === 'right' ? xPos + ocWidths[i] - 2 : xPos, y + 5, { align });
        xPos += ocWidths[i];
      });
      y += 12;
    }

    // ── 8. Cluster Analytics (all-time / YTD basis) ───────────
    y += 4;
    y = checkPageBreak(doc, logoBase64, W, margin, y, 60);
    y = drawSectionHeader(doc, `CLUSTER ANALYTICS - ${reportType.toUpperCase()}`, margin, y, W);

    const caHeaders = ['CLUSTER', 'CASES', 'CL.', 'VOLUME', 'CHARGES', 'AVG TAT', 'ROI%'];
    const caWidths  = [36, 14, 14, 28, 26, 18, 16];
    const caContentW = caWidths.reduce((a, b) => a + b, 0);
    y = drawTableHeader(doc, caHeaders, caWidths, margin, y, caContentW);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 50);

    analyticsRows.forEach((c, idx) => {
      y = checkPageBreak(doc, logoBase64, W, margin, y, 8);
      if (idx % 2 === 0) { doc.setFillColor(245, 247, 252); doc.rect(margin, y - 3, caContentW, 6, 'F'); }
      const roi = capitalDeployed > 0 ? ((c.charges / capitalDeployed) * 100).toFixed(2) : '0';
      const tat = avgTAT(c.loans);
      const rowData = [c.cluster, String(c.cases), String(c.closed), 'Rs ' + formatINR(c.principal), 'Rs ' + formatINR(c.charges), tat, roi + '%'];
      xPos = margin + 1;
      rowData.forEach((cell, i) => {
        const align = i >= 1 ? 'right' : 'left';
        doc.text(cell, align === 'right' ? xPos + caWidths[i] - 2 : xPos, y, { align });
        xPos += caWidths[i];
      });
      doc.setDrawColor(220, 225, 235);
      doc.line(margin, y + 2, margin + caContentW, y + 2);
      y += 6;
    });

    // ── Timestamp ─────────────────────────────────────────────
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 160);
    doc.text(`Generated: ${todayStr}  |  Confidential`, W / 2, y, { align: 'center' });

    const pdfBytes = doc.output('arraybuffer');
    const filename = `BridgeLine-Dashboard-${reportType.toUpperCase()}-${format(today, 'yyyyMMdd')}.pdf`;
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=${filename}`,
        'Content-Length': pdfBytes.byteLength.toString(),
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});