import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.2.1';
import { format, differenceInDays } from 'npm:date-fns@3.6.0';

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

// Draw the BridgeLine Partners letterhead header + gold divider + footer on current page
function drawLetterhead(doc, logoBase64, W, margin) {
  const pageH = doc.internal.pageSize.height;

  // Navy header block
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 42, 'F');

  // Logo
  if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, 5, 26, 26);

  // "BridgeLine" bold white + "Partners" regular white
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const logoRight = logoBase64 ? margin + 29 : margin;
  doc.text('BridgeLine', logoRight, 25);
  const blW = doc.getTextWidth('BridgeLine');
  doc.setFont('helvetica', 'normal');
  doc.text('Partners', logoRight + blW + 1, 25);

  // Right: ADDRESS / CONTACT / GSTIN labels in gold, values in white
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

  // Gold divider line below header
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(margin, 43.5, W - margin, 43.5);
  doc.setLineWidth(0.2);

  // Footer gold divider + wordmark
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(margin, pageH - 14, W - margin, pageH - 14);
  doc.setLineWidth(0.2);

  // Footer: "BridgeLine" navy bold + "Partners" gold
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
  return l.charges != null ? l.charges : (l.principal || 0) * (l.rate || 0.5) / 100;
}
function calcGST(charges) { return charges * 0.18; }
function calcOutstanding(l) {
  const charges = calcCharges(l);
  const gst = l.gst != null ? l.gst : calcGST(charges);
  return (l.principal || 0) + charges + gst;
}
function formatINR(n) {
  if (!n) return '0';
  return Math.round(n).toLocaleString('en-IN');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const loans = await base44.entities.Loan.list();
    const openLoans = loans.filter(l => l.status === 'open' || l.status === 'Follow Up!' || l.status === 'follow_up');
    const sortedLoans = openLoans.sort((a, b) => new Date(a.disbursement_date) - new Date(b.disbursement_date));

    const logoBase64 = await fetchLogoBase64();

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.height;
    const margin = 14;
    const contentW = W - margin * 2;
    const today = format(new Date(), 'dd-MMM-yyyy');

    // ── Page 1: Letterhead ────────────────────────────────────────
    drawLetterhead(doc, logoBase64, W, margin);

    // GSTIN value (just below gold divider)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text('29ABGFB6346P1ZR', W - margin, 48.5, { align: 'right' });

    let y = 52;

    // ── Report title band ──────────────────────────────────────────
    doc.setFillColor(...NAVY);
    doc.roundedRect(margin, y, contentW, 10, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CONSOLIDATED MIS REPORT - ALL CLUSTERS', margin + 4, y + 7);
    doc.setFontSize(8);
    doc.text(`As of ${today}`, W - margin - 2, y + 7, { align: 'right' });
    y += 14;

    // ── KPI boxes ─────────────────────────────────────────────────
    const totalPrincipal = openLoans.reduce((s, l) => s + (l.principal || 0), 0);
    const totalOutstanding = openLoans.reduce((s, l) => s + calcOutstanding(l), 0);
    const totalCharges = openLoans.reduce((s, l) => s + calcCharges(l), 0);

    const kpis = [
      { label: 'OPEN CASES', value: String(openLoans.length) },
      { label: 'TOTAL PRINCIPAL', value: 'Rs ' + formatINR(totalPrincipal) },
      { label: 'TOTAL CHARGES', value: 'Rs ' + formatINR(totalCharges) },
      { label: 'TOTAL OUTSTANDING', value: 'Rs ' + formatINR(totalOutstanding) },
    ];
    const kpiW = contentW / kpis.length - 2;
    kpis.forEach((kpi, i) => {
      const kx = margin + i * (kpiW + 2.7);
      doc.setFillColor(...NAVY);
      doc.roundedRect(kx, y, kpiW, 14, 1, 1, 'F');
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(kpi.label, kx + 3, y + 5);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(kpi.value, kx + 3, y + 11);
    });
    y += 20;

    // ── Open cases table ──────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text('OPEN CASES', margin, y);
    y += 5;

    // Table header
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);

    const headers = ['#', 'DATE', 'CUSTOMER', 'CLUSTER', 'BRANCH', 'PRINCIPAL', 'CHARGES', 'GST', 'OUTSTANDING', 'DAYS', 'RATE'];
    const colWidths = [6, 17, 22, 17, 17, 18, 15, 12, 20, 9, 9];

    let xPos = margin + 1;
    headers.forEach((h, i) => {
      const align = i >= 5 ? 'right' : 'left';
      const tx = align === 'right' ? xPos + colWidths[i] - 2 : xPos;
      doc.text(h, tx, y + 5, { align });
      xPos += colWidths[i];
    });
    y += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);

    sortedLoans.forEach((l, idx) => {
      if (y > pageH - 20) {
        doc.addPage();
        drawLetterhead(doc, logoBase64, W, margin);
        y = 52;
      }

      const charges = calcCharges(l);
      const gst = l.gst != null ? l.gst : calcGST(charges);
      const outstanding = calcOutstanding(l);
      const days = l.disbursement_date ? differenceInDays(new Date(), new Date(l.disbursement_date)) : 0;

      const rowData = [
        String(idx + 1),
        l.disbursement_date ? format(new Date(l.disbursement_date), 'dd-MMM-yy') : '-',
        l.borrower_name || '-',
        l.cluster || '-',
        l.branch || '-',
        'Rs ' + formatINR(l.principal),
        'Rs ' + formatINR(charges),
        'Rs ' + formatINR(gst),
        'Rs ' + formatINR(outstanding),
        String(days),
        (l.rate || 0.5) + '%',
      ];

      // Alternate row bg
      if (idx % 2 === 0) {
        doc.setFillColor(245, 247, 252);
        doc.rect(margin, y - 3, contentW, 5.5, 'F');
      }

      doc.setTextColor(30, 30, 50);
      xPos = margin + 1;
      rowData.forEach((cell, i) => {
        const align = i >= 5 ? 'right' : 'left';
        const tx = align === 'right' ? xPos + colWidths[i] - 2 : xPos;
        doc.text(cell, tx, y, { maxWidth: colWidths[i] - 2, align });
        xPos += colWidths[i];
      });

      // Bottom border
      doc.setDrawColor(220, 225, 235);
      doc.line(margin, y + 2, margin + contentW, y + 2);
      y += 5.5;
    });

    // Totals row
    y += 2;
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('TOTAL', margin + 1, y + 5);
    const totalCols = [totalPrincipal, totalCharges, totalOutstanding.valueOf() - totalPrincipal - totalCharges, totalOutstanding];
    const totalColIdx = [5, 6, 7, 8];
    let txBase = margin + 1;
    colWidths.forEach((w, i) => {
      if (totalColIdx.includes(i)) {
        const val = i === 7 ? totalCharges * 0.18 : totalCols[totalColIdx.indexOf(i)];
        doc.text('Rs ' + formatINR(val), txBase + w - 2, y + 5, { align: 'right' });
      }
      txBase += w;
    });
    y += 12;

    // ── Cluster summary ───────────────────────────────────────────
    if (y > pageH - 60) {
      doc.addPage();
      drawLetterhead(doc, logoBase64, W, margin);
      y = 52;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text('CLUSTER SUMMARY', margin, y);
    y += 5;

    doc.setFillColor(...NAVY);
    const clHeaders = ['CLUSTER', 'CASES', 'PRINCIPAL', 'CHARGES', 'GST', 'OUTSTANDING'];
    const clWidths = [38, 16, 30, 27, 22, 32];
    const clContentW = clWidths.reduce((a, b) => a + b);
    doc.rect(margin, y, clContentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    xPos = margin + 1;
    clHeaders.forEach((h, i) => {
      const align = i >= 2 ? 'right' : 'left';
      doc.text(h, align === 'right' ? xPos + clWidths[i] - 2 : xPos, y + 5, { align });
      xPos += clWidths[i];
    });
    y += 8;

    const clusterMap = {};
    openLoans.forEach(l => {
      const cluster = l.cluster || 'Unassigned';
      if (!clusterMap[cluster]) clusterMap[cluster] = { cases: 0, principal: 0, charges: 0, gst: 0, outstanding: 0 };
      clusterMap[cluster].cases++;
      clusterMap[cluster].principal += l.principal || 0;
      const ch = calcCharges(l);
      clusterMap[cluster].charges += ch;
      clusterMap[cluster].gst += (l.gst != null ? l.gst : calcGST(ch));
      clusterMap[cluster].outstanding += calcOutstanding(l);
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 50);

    Object.entries(clusterMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([cluster, data], idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(245, 247, 252);
        doc.rect(margin, y - 3, clContentW, 6, 'F');
      }
      const rowData = [
        cluster,
        String(data.cases),
        'Rs ' + formatINR(data.principal),
        'Rs ' + formatINR(data.charges),
        'Rs ' + formatINR(data.gst),
        'Rs ' + formatINR(data.outstanding),
      ];
      xPos = margin + 1;
      rowData.forEach((cell, i) => {
        const align = i >= 2 ? 'right' : 'left';
        doc.text(cell, align === 'right' ? xPos + clWidths[i] - 2 : xPos, y, { align });
        xPos += clWidths[i];
      });
      doc.setDrawColor(220, 225, 235);
      doc.line(margin, y + 2, margin + clContentW, y + 2);
      y += 6;
    });

    // Generated timestamp
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 160);
    doc.text(`Generated: ${today}  |  Confidential`, W / 2, y, { align: 'center' });

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=BridgeLine-MIS-${format(new Date(), 'yyyyMMdd')}.pdf`,
        'Content-Length': pdfBytes.byteLength.toString(),
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});