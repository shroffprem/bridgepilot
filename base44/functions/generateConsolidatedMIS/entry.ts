import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.2.1';
import { format, differenceInDays } from 'npm:date-fns@3.6.0';

function calcCharges(l) {
  return l.charges != null ? l.charges : (l.principal || 0) * (l.rate || 0.5) / 100;
}

function calcGST(charges) {
  return charges * 0.18;
}

function calcOutstanding(l) {
  const charges = calcCharges(l);
  const gst = l.gst != null ? l.gst : calcGST(charges);
  return (l.principal || 0) + charges + gst;
}

function formatINR(n) {
  if (!n) return '₹0';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const loans = await base44.entities.Loan.list();
    const collections = await base44.entities.Collection.list();
    const capitalEntries = await base44.entities.CapitalEntry.list();

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 12;

    // Header
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Consolidated MIS Report - All Clusters', 15, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`REPORTING DATE`, 15, yPos);
    doc.text(format(new Date(), 'dd-MMM-yyyy'), 80, yPos, { align: 'left' });
    yPos += 5;

    doc.text(`ADDRESS`, 15, yPos);
    doc.text(`2nd Floor, 3282/1, Apt 5, Ashraya Residency`, 80, yPos, { align: 'left' });
    yPos += 4;
    doc.text(`Vijaynagar 3rd Stage E Block, Mysuru 570030`, 80, yPos, { align: 'left' });
    yPos += 5;

    doc.text(`CONTACT`, 15, yPos);
    doc.text(`+91 99862 88166 | +91 98451 22023`, 80, yPos, { align: 'left' });
    yPos += 5;

    doc.text(`GSTIN`, 15, yPos);
    doc.text(`29ABGFB6346P1ZR`, 80, yPos, { align: 'left' });
    yPos += 10;

    // KPI Cards
    const openLoans = loans.filter(l => l.status === 'open' || l.status === 'Follow Up!' || l.status === 'follow_up');
    const totalPrincipal = openLoans.reduce((s, l) => s + (l.principal || 0), 0);
    const totalOutstanding = openLoans.reduce((s, l) => s + calcOutstanding(l), 0);
    const totalCharges = collections.reduce((s, c) => s + (c.charges_component || 0), 0);

    doc.setFont(undefined, 'bold');
    doc.setFillColor(240, 240, 240);
    const kpiY = yPos;
    doc.rect(15, kpiY, 40, 15, 'F');
    doc.text('OPEN CASES', 19, kpiY + 4);
    doc.setFontSize(12);
    doc.text(String(openLoans.length), 19, kpiY + 10);

    doc.setFontSize(9);
    doc.rect(60, kpiY, 40, 15, 'F');
    doc.text('TOTAL PRINCIPAL', 64, kpiY + 4);
    doc.setFontSize(12);
    doc.text(formatINR(totalPrincipal), 64, kpiY + 10);

    doc.setFontSize(9);
    doc.rect(105, kpiY, 40, 15, 'F');
    doc.text('TOTAL OUTSTANDING', 109, kpiY + 4);
    doc.setFontSize(12);
    doc.text(formatINR(totalOutstanding), 109, kpiY + 10);

    doc.setFontSize(9);
    doc.rect(150, kpiY, 40, 15, 'F');
    doc.text('NET CHARGES (MTD)', 154, kpiY + 4);
    doc.setFontSize(12);
    doc.text(formatINR(totalCharges), 154, kpiY + 10);

    yPos = kpiY + 25;

    // Open Cases Table
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('OPEN CASES - ALL CLUSTERS', 15, yPos);
    yPos += 6;

    // Table header
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(30, 60, 114);
    doc.setTextColor(255, 255, 255);
    const tableHeaders = ['#', 'DATE', 'CUSTOMER', 'CLUSTER', 'BRANCH', 'PRINCIPAL', 'CHARGES', 'GST', 'OUTSTANDING', 'DAYS', 'RATE', 'STATUS'];
    const colWidths = [4, 12, 18, 12, 14, 16, 12, 10, 18, 8, 10, 15];
    let xPos = 15;
    tableHeaders.forEach((h, i) => {
      doc.text(h, xPos, yPos, { maxWidth: colWidths[i] - 1, fontSize: 7 });
      xPos += colWidths[i];
    });

    yPos += 5;
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);

    openLoans.sort((a, b) => new Date(a.disbursement_date) - new Date(b.disbursement_date)).forEach((l, idx) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 15;
      }

      const charges = calcCharges(l);
      const gst = l.gst != null ? l.gst : calcGST(charges);
      const outstanding = calcOutstanding(l);
      const days = l.disbursement_date ? differenceInDays(new Date(), new Date(l.disbursement_date)) : 0;

      xPos = 15;
      const row = [
        String(idx + 1),
        l.disbursement_date ? format(new Date(l.disbursement_date), 'dd-MMM-yyyy') : '-',
        l.borrower_name || '-',
        l.cluster || '-',
        l.branch || '-',
        formatINR(l.principal),
        formatINR(charges),
        formatINR(gst),
        formatINR(outstanding),
        String(days),
        `${l.rate || 0.5}%`,
        'Follow Up!'
      ];

      row.forEach((cell, i) => {
        doc.text(String(cell), xPos, yPos, { maxWidth: colWidths[i] - 1 });
        xPos += colWidths[i];
      });

      yPos += 4;
    });

    // Cluster Summary
    yPos += 5;
    doc.setFont(undefined, 'bold');
    doc.text('CLUSTER SUMMARY', 15, yPos);
    yPos += 5;

    const clusterMap = {};
    openLoans.forEach(l => {
      const cluster = l.cluster || 'Unassigned';
      if (!clusterMap[cluster]) {
        clusterMap[cluster] = { cases: 0, principal: 0, charges: 0, gst: 0, outstanding: 0 };
      }
      clusterMap[cluster].cases++;
      clusterMap[cluster].principal += l.principal || 0;
      const ch = calcCharges(l);
      clusterMap[cluster].charges += ch;
      clusterMap[cluster].gst += (l.gst != null ? l.gst : calcGST(ch));
      clusterMap[cluster].outstanding += calcOutstanding(l);
    });

    doc.setFillColor(30, 60, 114);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    doc.text('CLUSTER', 15, yPos);
    doc.text('CASES', 50, yPos);
    doc.text('PRINCIPAL', 75, yPos);
    doc.text('CHARGES', 110, yPos);
    doc.text('GST', 140, yPos);
    doc.text('OUTSTANDING', 155, yPos);
    yPos += 5;

    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);

    Object.entries(clusterMap).sort().forEach(([cluster, data]) => {
      doc.text(cluster, 15, yPos);
      doc.text(String(data.cases), 50, yPos);
      doc.text(formatINR(data.principal), 75, yPos);
      doc.text(formatINR(data.charges), 110, yPos);
      doc.text(formatINR(data.gst), 140, yPos);
      doc.text(formatINR(data.outstanding), 155, yPos);
      yPos += 4;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('BridgeLine Partners', 15, pageHeight - 10);
    doc.text(`Generated: ${format(new Date(), 'dd-MMM-yyyy')}`, 150, pageHeight - 10);

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=BridgeLine-MIS-${format(new Date(), 'yyyyMMdd')}.pdf`,
        'Content-Length': pdfBytes.byteLength.toString()
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});