import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.2.1';
import { format } from 'npm:date-fns@3.6.0';

function calcCharges(l) {
  return l.charges != null ? l.charges : (l.principal || 0) * (l.rate || 0.5) / 100;
}

function calcGST(charges) {
  return charges * 0.18;
}

function calcOutstanding(l) {
  const charges = calcCharges(l);
  const gst = l.gst != null ? l.gst : calcGST(charges);
  return (l.principal || 0) + charges + gst - (l.amount_collected || 0);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { reportType } = await req.json();

    const [loans, collections, disbursals] = await Promise.all([
      base44.entities.Loan.list(),
      base44.entities.Collection.list(),
      base44.entities.Disbursal.list(),
    ]);

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 15;

    // Header
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('BridgeLine Partners', 15, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 15, yPos);
    yPos += 10;

    if (reportType === 'daily_mis') {
      // Daily MIS Report
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Daily MIS Report', 15, yPos);
      yPos += 8;

      // Group collections and disbursals by date
      const dailyData = {};
      
      collections.forEach(c => {
        const date = c.credit_note_date || format(new Date(), 'yyyy-MM-dd');
        if (!dailyData[date]) dailyData[date] = { collections: [], disbursals: [], loanCount: 0 };
        dailyData[date].collections.push(c);
      });

      disbursals.forEach(d => {
        const date = d.debit_note_date || format(new Date(), 'yyyy-MM-dd');
        if (!dailyData[date]) dailyData[date] = { collections: [], disbursals: [], loanCount: 0 };
        dailyData[date].disbursals.push(d);
      });

      const sortedDates = Object.keys(dailyData).sort().reverse();

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');

      sortedDates.forEach(date => {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 15;
        }

        const data = dailyData[date];
        const collectionAmt = data.collections.reduce((s, c) => s + (c.amount_collected || 0), 0);
        const disbursalAmt = data.disbursals.reduce((s, d) => s + (d.principal || 0), 0);

        doc.setFont(undefined, 'bold');
        doc.text(`${date}`, 15, yPos);
        yPos += 6;

        doc.setFont(undefined, 'normal');
        doc.text(`Collections: ₹${collectionAmt.toLocaleString('en-IN')} (${data.collections.length} txns)`, 20, yPos);
        yPos += 5;
        doc.text(`Disbursals: ₹${disbursalAmt.toLocaleString('en-IN')} (${data.disbursals.length} txns)`, 20, yPos);
        yPos += 7;
      });

      // Summary table
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 15;
      }

      doc.setFont(undefined, 'bold');
      doc.text('Summary Statistics', 15, yPos);
      yPos += 8;

      const totalCollections = collections.reduce((s, c) => s + (c.amount_collected || 0), 0);
      const totalDisbursals = disbursals.reduce((s, d) => s + (d.principal || 0), 0);

      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(`Total Collections: ₹${totalCollections.toLocaleString('en-IN')}`, 15, yPos);
      yPos += 5;
      doc.text(`Total Disbursals: ₹${totalDisbursals.toLocaleString('en-IN')}`, 15, yPos);
      yPos += 5;
      doc.text(`Collection Count: ${collections.length}`, 15, yPos);
      yPos += 5;
      doc.text(`Disbursal Count: ${disbursals.length}`, 15, yPos);
    } else if (reportType === 'cluster_performance') {
      // Cluster-wise Performance Report
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Cluster-wise Performance Report', 15, yPos);
      yPos += 8;

      const clusters = {};
      loans.forEach(l => {
        const cluster = l.cluster || 'Unassigned';
        if (!clusters[cluster]) {
          clusters[cluster] = { loans: [], principal: 0, charges: 0, outstanding: 0, closed: 0 };
        }
        clusters[cluster].loans.push(l);
        clusters[cluster].principal += l.principal || 0;
        clusters[cluster].charges += calcCharges(l);
        clusters[cluster].outstanding += calcOutstanding(l);
        if (l.status === 'closed') clusters[cluster].closed++;
      });

      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');

      Object.entries(clusters).sort().forEach(([cluster, data]) => {
        if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = 15;
        }

        doc.setFont(undefined, 'bold');
        doc.text(`${cluster}`, 15, yPos);
        yPos += 5;

        doc.setFont(undefined, 'normal');
        const roi = data.principal > 0 ? ((data.charges / data.principal) * 100).toFixed(2) : '0';
        const openCases = data.loans.length - data.closed;

        doc.text(`Cases: ${data.loans.length} | Open: ${openCases} | Closed: ${data.closed}`, 18, yPos);
        yPos += 4;
        doc.text(`Principal: ₹${data.principal.toLocaleString('en-IN')}`, 18, yPos);
        yPos += 4;
        doc.text(`Charges: ₹${data.charges.toLocaleString('en-IN')} | ROI: ${roi}%`, 18, yPos);
        yPos += 4;
        doc.text(`Outstanding: ₹${data.outstanding.toLocaleString('en-IN')}`, 18, yPos);
        yPos += 6;

        // Aging breakdown for this cluster
        const agingBuckets = [
          { label: '0-7 days', min: 0, max: 7 },
          { label: '8-14 days', min: 8, max: 14 },
          { label: '15-30 days', min: 15, max: 30 },
          { label: '31-60 days', min: 31, max: 60 },
          { label: '60+ days', min: 61, max: Infinity },
        ];

        const today = new Date();
        const ageBreakdown = agingBuckets.map(bucket => {
          const count = data.loans.filter(l => {
            if (l.status === 'closed') return false;
            const days = l.disbursement_date ? Math.floor((today - new Date(l.disbursement_date)) / 86400000) : 0;
            return days >= bucket.min && days <= bucket.max;
          }).length;
          return count;
        });

        doc.setFont(undefined, 'normal');
        doc.text(`Aging: 0-7d:${ageBreakdown[0]} | 8-14d:${ageBreakdown[1]} | 15-30d:${ageBreakdown[2]} | 31-60d:${ageBreakdown[3]} | 60+d:${ageBreakdown[4]}`, 18, yPos);
        yPos += 6;
      });
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=bridgeline-${reportType}-${format(new Date(), 'yyyyMMdd')}.pdf`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});