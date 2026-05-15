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

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPos = 15;

    // Set font
    doc.setFont('Helvetica');

    // Title
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Consolidated MIS Report - All Clusters', 15, yPos);
    yPos += 8;

    // Header info
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text('REPORTING DATE', 15, yPos);
    doc.text(format(new Date(), 'dd-MMM-yyyy'), 50, yPos);
    yPos += 5;

    doc.text('ADDRESS', 15, yPos);
    doc.text('2nd Floor, 3282/1, Apt 5, Ashraya Residency', 50, yPos);
    yPos += 4;
    doc.text('Vijaynagar 3rd Stage E Block, Mysuru 570030', 50, yPos);
    yPos += 5;

    doc.text('CONTACT', 15, yPos);
    doc.text('+91 99862 88166 | +91 98451 22023', 50, yPos);
    yPos += 5;

    doc.text('GSTIN', 15, yPos);
    doc.text('29ABGFB6346P1ZR', 50, yPos);
    yPos += 10;

    // KPI section
    const totalPrincipal = openLoans.reduce((s, l) => s + (l.principal || 0), 0);
    const totalOutstanding = openLoans.reduce((s, l) => s + calcOutstanding(l), 0);

    doc.setFillColor(220, 220, 220);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);

    const kpiWidth = 35;
    const kpiX = [15, 15 + kpiWidth + 5, 15 + (kpiWidth + 5) * 2];
    doc.rect(kpiX[0], yPos, kpiWidth, 12, 'F');
    doc.text('OPEN CASES', kpiX[0] + 2, yPos + 4);
    doc.setFontSize(14);
    doc.text(String(openLoans.length), kpiX[0] + 2, yPos + 10);

    doc.setFontSize(9);
    doc.rect(kpiX[1], yPos, kpiWidth, 12, 'F');
    doc.text('TOTAL PRINCIPAL', kpiX[1] + 2, yPos + 4);
    doc.setFontSize(10);
    doc.text('Rs ' + formatINR(totalPrincipal), kpiX[1] + 2, yPos + 10);

    doc.setFontSize(9);
    doc.rect(kpiX[2], yPos, kpiWidth, 12, 'F');
    doc.text('TOTAL OUTSTANDING', kpiX[2] + 2, yPos + 4);
    doc.setFontSize(10);
    doc.text('Rs ' + formatINR(totalOutstanding), kpiX[2] + 2, yPos + 10);

    yPos += 20;

    // Table title
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.text('OPEN CASES - ALL CLUSTERS', 15, yPos);
    yPos += 6;

    // Table header
    doc.setFillColor(30, 60, 114);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('Helvetica', 'bold');

    const headers = ['#', 'DATE', 'CUSTOMER', 'CLUSTER', 'BRANCH', 'PRINCIPAL', 'CHARGES', 'GST', 'OUTSTANDING', 'DAYS', 'RATE', 'STATUS'];
    const colWidths = [5, 12, 15, 12, 14, 15, 12, 10, 18, 7, 8, 12];

    let xPos = 15;
    headers.forEach((h, i) => {
      doc.text(h, xPos + 1, yPos + 3, { maxWidth: colWidths[i] - 2, align: 'left' });
      xPos += colWidths[i];
    });

    doc.setLineWidth(0.3);
    doc.line(15, yPos + 4, 15 + colWidths.reduce((a, b) => a + b), yPos + 4);
    yPos += 5;

    // Table rows
    doc.setTextColor(0, 0, 0);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);

    const sortedLoans = openLoans.sort((a, b) => new Date(a.disbursement_date) - new Date(b.disbursement_date));

    sortedLoans.forEach((l, idx) => {
      if (yPos > pageHeight - 15) {
        doc.addPage();
        yPos = 15;
      }

      const charges = calcCharges(l);
      const gst = l.gst != null ? l.gst : calcGST(charges);
      const outstanding = calcOutstanding(l);
      const days = l.disbursement_date ? differenceInDays(new Date(), new Date(l.disbursement_date)) : 0;

      const rowData = [
        String(idx + 1),
        l.disbursement_date ? format(new Date(l.disbursement_date), 'dd-MMM-yyyy') : '-',
        l.borrower_name || '-',
        l.cluster || '-',
        l.branch || '-',
        'Rs ' + formatINR(l.principal),
        'Rs ' + formatINR(charges),
        'Rs ' + formatINR(gst),
        'Rs ' + formatINR(outstanding),
        String(days),
        (l.rate || 0.5) + '%',
        'Follow Up!'
      ];

      xPos = 15;
      rowData.forEach((cell, i) => {
        doc.text(cell, xPos + 1, yPos, { maxWidth: colWidths[i] - 2, align: i > 4 && i < 9 ? 'right' : 'left' });
        xPos += colWidths[i];
      });

      yPos += 4.5;
    });

    yPos += 3;

    // Cluster summary
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

    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.text('CLUSTER SUMMARY', 15, yPos);
    yPos += 6;

    // Cluster table header
    doc.setFillColor(30, 60, 114);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    const clusterHeaders = ['CLUSTER', 'CASES', 'PRINCIPAL', 'CHARGES', 'GST', 'OUTSTANDING'];
    const clusterColWidths = [35, 15, 28, 25, 20, 32];

    xPos = 15;
    clusterHeaders.forEach((h, i) => {
      doc.text(h, xPos + 1, yPos + 2, { maxWidth: clusterColWidths[i] - 2, align: 'left' });
      xPos += clusterColWidths[i];
    });

    doc.setLineWidth(0.3);
    doc.line(15, yPos + 4, 15 + clusterColWidths.reduce((a, b) => a + b), yPos + 4);
    yPos += 5;

    // Cluster rows
    doc.setTextColor(0, 0, 0);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);

    Object.entries(clusterMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([cluster, data]) => {
        const rowData = [
          cluster,
          String(data.cases),
          'Rs ' + formatINR(data.principal),
          'Rs ' + formatINR(data.charges),
          'Rs ' + formatINR(data.gst),
          'Rs ' + formatINR(data.outstanding)
        ];

        xPos = 15;
        rowData.forEach((cell, i) => {
          doc.text(cell, xPos + 1, yPos, { maxWidth: clusterColWidths[i] - 2, align: i > 1 ? 'right' : 'left' });
          xPos += clusterColWidths[i];
        });

        yPos += 4;
      });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('BridgeLine Partners', 15, pageHeight - 10);
    doc.text('Generated: ' + format(new Date(), 'dd-MMM-yyyy'), pageWidth - 50, pageHeight - 10);

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