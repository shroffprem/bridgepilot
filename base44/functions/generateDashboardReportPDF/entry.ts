import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.2.1';
import { format, getYear, endOfMonth, differenceInDays } from 'npm:date-fns@3.6.0';

// ── BridgeLine Partners brand constants ──────────────────────
const NAVY = [26, 39, 68];
const GOLD = [201, 168, 76];
const LOGO_URL = 'https://media.base44.com/images/public/6a056f02e19305d21d34b219/fa91ede9e_BLPLogo.png';

async function fetchLogoBase64() {
  try {
    const res = await fetch(LOGO_URL);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return 'data:image/png;base64,' + btoa(binary);
  } catch { return null; }
}

function drawLetterhead(doc, logoBase64, W, margin) {
  const pageH = doc.internal.pageSize.height;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 42, 'F');

  if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, 5, 26, 26);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const logoRight = logoBase64 ? margin + 29 : margin;
  doc.text('BridgeLine', logoRight, 25);
  const blW = doc.getTextWidth('BridgeLine');
  doc.setFont('helvetica', 'normal');
  doc.text('Partners', logoRight + blW + 1, 25);

  const rx = W - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...GOLD);
  doc.setCharSpace(1.5);
  doc.text('A D D R E S S', rx, 9, { align: 'right' });
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('2nd Floor, 3282/1, Apt No 5, Ashraya Residency,', rx, 14, { align: 'right' });
  doc.text('Vijaynagar 3rd Stage, E Block, Garudachar Layout,', rx, 18.5, { align: 'right' });
  doc.text('Mysuru, Karnataka \u2013 570030', rx, 23, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...GOLD);
  doc.setCharSpace(1.5);
  doc.text('C O N T A C T', rx, 28.5, { align: 'right' });
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('+91 96862 88166  \u00B7  +91 98451 22023', rx, 33.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...GOLD);
  doc.setCharSpace(1.5);
  doc.text('G S T I N', rx, 38.5, { align: 'right' });
  doc.setCharSpace(0);

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const reportType = body.reportType || 'mtd'; // 'mtd' or 'ytd'

    const [rawLoans, capitalEntries] = await Promise.all([
      base44.entities.Loan.list(),
      base44.entities.CapitalEntry.list(),
    ]);

    const loans = rawLoans.map(l => ({ ...l, status: normalizeStatus(l.status) }));

    const today = new Date();
    const currentYear = getYear(today);
    const currentMonthKey = today.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    // Filter loans for the period
    const periodLoans = reportType === 'mtd'
      ? loans.filter(l => l.disbursement_date && monthKey(l.disbursement_date) === currentMonthKey)
      : loans.filter(l => l.disbursement_date && getYear(new Date(l.disbursement_date)) === currentYear);

    // Capital deployed
    const capitalDeployed = capitalEntries.reduce((s, e) => e.type === 'addition' ? s + e.amount : s - e.amount, 0);

    // Build monthly breakdown
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

    // Summary totals
    const totalCases = periodLoans.length;
    const totalVolume = periodLoans.reduce((s, l) => s + (l.principal || 0), 0);
    const totalCharges = periodLoans.reduce((s, l) => s + calcCharges(l), 0);
    const totalGST = periodLoans.reduce((s, l) => s + (l.gst != null ? l.gst : calcGST(calcCharges(l))), 0);
    const totalOutstanding = periodLoans.filter(l => l.status !== 'closed').reduce((s, l) => s + calcOutstanding(l), 0);
    const totalCollected = periodLoans.filter(l => l.status === 'closed').reduce((s, l) => s + (l.principal || 0) + calcCharges(l), 0);
    const totalClosed = periodLoans.filter(l => l.status === 'closed').length;
    const totalOpen = periodLoans.filter(l => l.status === 'open' || l.status === 'overdue').length;

    // Monthly goalpost (only for MTD)
    const monthlyTarget = capitalDeployed * 0.04;
    const mtdCharges = periodLoans.reduce((s, l) => s + calcCharges(l), 0);
    const pctAchieved = monthlyTarget > 0 ? Math.min(100, (mtdCharges / monthlyTarget) * 100) : 0;
    const daysLeftInMonth = differenceInDays(endOfMonth(today), today) + 1;
    const remaining = Math.max(0, monthlyTarget - mtdCharges);
    const dailyChargeNeeded = daysLeftInMonth > 0 ? remaining / daysLeftInMonth : 0;

    // Cluster breakdown for the period
    const clusterMap = {};
    for (const l of periodLoans) {
      const key = l.cluster || 'Other';
      if (!clusterMap[key]) clusterMap[key] = { cluster: key, cases: 0, closed: 0, volume: 0, charges: 0 };
      clusterMap[key].cases++;
      if (l.status === 'closed') clusterMap[key].closed++;
      clusterMap[key].volume += l.principal || 0;
      clusterMap[key].charges += calcCharges(l);
    }
    const clusterRows = Object.values(clusterMap).sort((a, b) => b.charges - a.charges);

    // ── Build PDF ──────────────────────────────────────────────────
    const logoBase64 = await fetchLogoBase64();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.height;
    const margin = 14;
    const contentW = W - margin * 2;
    const todayStr = format(today, 'dd-MMM-yyyy');
    const periodLabel = reportType === 'mtd'
      ? format(today, 'MMMM yyyy')
      : `January – December ${currentYear}`;

    // ── Page 1 ─────────────────────────────────────────────────────
    drawLetterhead(doc, logoBase64, W, margin);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text('29ABGFB6346P1ZR', W - margin, 48.5, { align: 'right' });

    let y = 52;

    // Report title band
    doc.setFillColor(...NAVY);
    doc.roundedRect(margin, y, contentW, 10, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`PORTFOLIO OVERVIEW — ${reportType.toUpperCase()}  (${periodLabel})`, margin + 4, y + 7);
    doc.setFontSize(8);
    doc.text(`As of ${todayStr}`, W - margin - 2, y + 7, { align: 'right' });
    y += 14;

    // KPI boxes
    const kpis = [
      { label: 'CASES DISBURSED', value: `${totalCases}  (${totalOpen} open · ${totalClosed} closed)` },
      { label: 'TOTAL DISBURSED', value: 'Rs ' + formatINR(totalVolume) },
      { label: 'CHARGES EARNED', value: 'Rs ' + formatINR(totalCharges) },
      { label: 'OUTSTANDING', value: 'Rs ' + formatINR(totalOutstanding) },
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

    // ── Month-wise breakdown table ─────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text('MONTH-WISE BREAKDOWN', margin, y);
    y += 5;

    const mHeaders = ['MONTH', 'CASES', 'VOLUME', 'CHARGES', 'COLLECTED', 'OUTSTANDING', 'CL/OP', 'ROI%'];
    const mWidths  = [24, 13, 24, 22, 24, 26, 14, 16];

    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    let xPos = margin + 1;
    mHeaders.forEach((h, i) => {
      const align = i >= 1 ? 'right' : 'left';
      doc.text(h, align === 'right' ? xPos + mWidths[i] - 2 : xPos, y + 5, { align });
      xPos += mWidths[i];
    });
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    monthlyRows.forEach((m, idx) => {
      if (y > pageH - 20) {
        doc.addPage();
        drawLetterhead(doc, logoBase64, W, margin);
        y = 52;
      }
      const roi = capitalDeployed > 0 ? ((m.charges / capitalDeployed) * 100).toFixed(2) : '0';
      const rowData = [
        m.month,
        String(m.cases),
        'Rs ' + formatINR(m.volume),
        'Rs ' + formatINR(m.charges),
        'Rs ' + formatINR(m.collected),
        'Rs ' + formatINR(m.outstanding),
        `${m.closed}/${m.open}`,
        roi + '%',
      ];
      if (idx % 2 === 0) {
        doc.setFillColor(245, 247, 252);
        doc.rect(margin, y - 3, contentW, 5.5, 'F');
      }
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

    // Totals row (if multiple months)
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

    // ── MTD Goalpost (only for MTD) ────────────────────────────────
    if (reportType === 'mtd') {
      y += 4;
      if (y > pageH - 50) {
        doc.addPage();
        drawLetterhead(doc, logoBase64, W, margin);
        y = 52;
      }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(`MONTHLY ROI GOALPOST — ${format(today, 'MMM yyyy')}  (4% of deployed capital)`, margin, y);
      y += 5;

      // Progress bar
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
        { label: 'CHARGES EARNED', value: 'Rs ' + formatINR(mtdCharges) },
        { label: 'REMAINING', value: 'Rs ' + formatINR(remaining) },
        { label: 'DAYS LEFT', value: String(daysLeftInMonth) },
        { label: 'DAILY NEEDED', value: 'Rs ' + formatINR(dailyChargeNeeded) },
        { label: 'TARGET (4%)', value: 'Rs ' + formatINR(monthlyTarget) },
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
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 30, 50);
        doc.text(kpi.value, kx + 2, y + 11, { maxWidth: gkpiW - 3 });
      });
      y += 20;
    }

    // ── Cluster Analytics ──────────────────────────────────────────
    y += 4;
    if (y > pageH - 60) {
      doc.addPage();
      drawLetterhead(doc, logoBase64, W, margin);
      y = 52;
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(`CLUSTER ANALYTICS — ${reportType.toUpperCase()}`, margin, y);
    y += 5;

    const cHeaders = ['CLUSTER', 'CASES', 'CLOSED', 'VOLUME', 'CHARGES', 'ROI%'];
    const cWidths  = [38, 16, 16, 30, 28, 18];
    const cContentW = cWidths.reduce((a, b) => a + b);

    doc.setFillColor(...NAVY);
    doc.rect(margin, y, cContentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    xPos = margin + 1;
    cHeaders.forEach((h, i) => {
      const align = i >= 1 ? 'right' : 'left';
      doc.text(h, align === 'right' ? xPos + cWidths[i] - 2 : xPos, y + 5, { align });
      xPos += cWidths[i];
    });
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 50);

    clusterRows.forEach((c, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(245, 247, 252);
        doc.rect(margin, y - 3, cContentW, 6, 'F');
      }
      const roi = capitalDeployed > 0 ? ((c.charges / capitalDeployed) * 100).toFixed(2) : '0';
      const rowData = [c.cluster, String(c.cases), String(c.closed), 'Rs ' + formatINR(c.volume), 'Rs ' + formatINR(c.charges), roi + '%'];
      xPos = margin + 1;
      rowData.forEach((cell, i) => {
        const align = i >= 1 ? 'right' : 'left';
        doc.text(cell, align === 'right' ? xPos + cWidths[i] - 2 : xPos, y, { align });
        xPos += cWidths[i];
      });
      doc.setDrawColor(220, 225, 235);
      doc.line(margin, y + 2, margin + cContentW, y + 2);
      y += 6;
    });

    // Timestamp
    y += 4;
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