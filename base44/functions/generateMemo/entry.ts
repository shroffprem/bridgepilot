import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') || 'whatsapp:+14155238886';

// Format Indian currency
function fmtINR(n) {
  if (!n && n !== 0) return 'Rs 0.00';
  return `Rs ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcCharges(loan) {
  if (loan.charges != null && loan.charges > 0) return loan.charges;
  return (loan.principal || 0) * (loan.rate || 0) / 100;
}
function calcGST(charges, loan) {
  if (loan.gst != null && loan.gst > 0) return loan.gst;
  return Math.round(charges * 0.18);
}
function calcOutstanding(loan) {
  if (loan.status === 'closed') return 0;
  if (loan.outstanding != null && loan.outstanding > 0) return loan.outstanding;
  const ch = calcCharges(loan);
  return (loan.principal || 0) + ch + calcGST(ch, loan);
}
function calcDays(loan) {
  if (!loan.disbursement_date) return 0;
  const start = new Date(loan.disbursement_date);
  const end = loan.closure_date ? new Date(loan.closure_date) : new Date();
  return Math.max(0, Math.round((end - start) / 86400000));
}
function fmtDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const LOGO_URL = 'https://media.base44.com/images/public/6a056f02e19305d21d34b219/fa91ede9e_BLPLogo.png';

async function fetchLogoBase64() {
  try {
    const res = await fetch(LOGO_URL);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return 'data:image/png;base64,' + btoa(binary);
  } catch {
    return null;
  }
}

function buildPDF(loan, collection, logoBase64) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, pageH = 297;
  const margin = 14;
  const contentW = W - margin * 2;
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const isClosed = !!collection;
  const charges = calcCharges(loan);
  const gst = calcGST(charges, loan);
  const totalPayable = (loan.principal || 0) + charges + gst;
  const outstanding = isClosed ? 0 : calcOutstanding(loan);
  const days = calcDays(loan);

  // ── Navy header bar ──────────────────────────────────────────
  doc.setFillColor(31, 40, 70);
  doc.rect(0, 0, W, 38, 'F');

  // Logo or company name fallback
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 5, 28, 28);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('BridgeLine Partners', margin + 31, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(isClosed ? 'COLLECTION MEMO' : 'DISBURSEMENT MEMO', margin + 31, 23);
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('BridgeLine Partners', margin, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(isClosed ? 'COLLECTION MEMO' : 'DISBURSEMENT MEMO', margin, 22);
  }

  doc.setFontSize(7);
  doc.setTextColor(200, 210, 255);
  doc.text(`REPORTING DATE  ${today}`, margin, 29);

  // Right side: address block
  doc.setFontSize(7);
  doc.setTextColor(200, 210, 255);
  const addr = [
    '2nd Floor, 3282/1, Apt 5, Ashraya Residency',
    'Vijaynagar 3rd Stage E Block, Mysuru 570030',
    '+91 99862 88166 | +91 98451 22023',
    'GSTIN: 29ABGFB6346P1ZR',
  ];
  let ay = 10;
  addr.forEach(line => {
    doc.text(line, W - margin, ay, { align: 'right' });
    ay += 6;
  });

  // ── Title band ───────────────────────────────────────────────
  let y = 44;
  doc.setFillColor(31, 40, 70);
  doc.roundedRect(margin, y, contentW, 10, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(isClosed ? 'COLLECTION MEMO' : 'DISBURSEMENT MEMO', margin + 4, y + 7);
  const ref = loan.loan_number || loan.disbursal_id || '-';
  doc.setFontSize(8);
  doc.text(`Ref: ${ref}`, W - margin - 2, y + 7, { align: 'right' });

  // ── Status ribbon ─────────────────────────────────────────────
  y += 13;
  doc.setFillColor(31, 40, 70);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setTextColor(255, 193, 7);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  const ribbonItems = [
    `Date: ${fmtDate(loan.disbursement_date)}`,
    `Status: ${isClosed ? 'Closed ✓' : 'Follow Up!'}`,
    `Days Outstanding: ${days}`,
    `Charge Rate: ${loan.rate || 0}%`,
  ];
  const ribbonW = contentW / ribbonItems.length;
  ribbonItems.forEach((item, i) => {
    doc.text(item, margin + ribbonW * i + ribbonW / 2, y + 5.5, { align: 'center' });
  });

  // ── Disbursed To section ──────────────────────────────────────
  y += 12;
  doc.setFillColor(232, 236, 245);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setTextColor(31, 40, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DISBURSED TO', margin + 2, y + 4.5);

  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  const col1x = margin + 2, col2x = margin + 40;
  const col3x = margin + contentW / 2 + 2, col4x = margin + contentW / 2 + 35;

  const leftFields = [
    ['Customer:', loan.borrower_name || '-'],
    ['Company:', loan.company || loan.so_name || '-'],
    ['Cluster:', loan.cluster || '-'],
  ];
  const rightFields = [
    ['Branch:', loan.branch || '-'],
    ['Chq / Ref:', loan.pledge_card_number || '-'],
    ['Debit Note:', loan.disbursal_id || '-'],
  ];

  doc.setDrawColor(220, 220, 230);
  doc.rect(margin, y - 2, contentW, leftFields.length * 7 + 4, 'S');

  leftFields.forEach(([label, val], i) => {
    const row = y + i * 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 120);
    doc.text(label, col1x, row);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 50);
    doc.text(String(val), col2x, row);
  });
  rightFields.forEach(([label, val], i) => {
    const row = y + i * 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 120);
    doc.text(label, col3x, row);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 50);
    doc.text(String(val), col4x, row);
  });

  // ── Two-column: Description | Collection Details ──────────────
  y += leftFields.length * 7 + 8;
  const halfW = contentW / 2 - 2;

  // Left header: DESCRIPTION
  doc.setFillColor(31, 40, 70);
  doc.rect(margin, y, halfW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('DESCRIPTION', margin + 2, y + 5);
  doc.text('AMOUNT', margin + halfW - 2, y + 5, { align: 'right' });

  // Right header: COLLECTION DETAILS
  const cx = margin + halfW + 4;
  doc.setFillColor(31, 40, 70);
  doc.rect(cx, y, halfW, 7, 'F');
  doc.text('COLLECTION DETAILS', cx + 2, y + 5);

  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 60);

  const descRows = [
    ['Amount Disbursed', fmtINR(loan.principal), false],
    ['Service Charges', fmtINR(charges), false],
    ['GST (18%)', fmtINR(gst), false],
    ['TOTAL PAYABLE', fmtINR(totalPayable), true],
  ];

  const collRows = [
    ['Collected Date', isClosed ? fmtDate(collection?.credit_note_date || loan.closure_date) : '-', false],
    ['Collected Amount', isClosed ? fmtINR(collection?.amount_collected || totalPayable) : '-', false],
    ['Balance O/S', fmtINR(outstanding), true],
    ['Days Outstanding', String(days), false],
  ];

  const rowH = 7;
  const tableH = descRows.length * rowH;

  // Draw borders
  doc.setDrawColor(210, 215, 230);
  doc.rect(margin, y - 2, halfW, tableH + 2, 'S');
  doc.rect(cx, y - 2, halfW, tableH + 2, 'S');

  descRows.forEach(([label, val, bold], i) => {
    const ry = y + i * rowH;
    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 252);
      doc.rect(margin, ry - 2, halfW, rowH, 'F');
    }
    if (bold) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 40, 70);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 70);
    }
    doc.text(label, margin + 2, ry + 3.5);
    if (bold) {
      doc.setFillColor(240, 244, 255);
      doc.rect(margin, ry - 2, halfW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 40, 70);
      doc.text(label, margin + 2, ry + 3.5);
    }
    doc.text(val, margin + halfW - 2, ry + 3.5, { align: 'right' });
  });

  collRows.forEach(([label, val, bold], i) => {
    const ry = y + i * rowH;
    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 252);
      doc.rect(cx, ry - 2, halfW, rowH, 'F');
    }
    if (bold && outstanding > 0) {
      doc.setFillColor(255, 240, 240);
      doc.rect(cx, ry - 2, halfW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 20, 20);
    } else if (bold && outstanding === 0) {
      doc.setFillColor(240, 255, 245);
      doc.rect(cx, ry - 2, halfW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 120, 50);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 70);
    }
    doc.text(label, cx + 2, ry + 3.5);
    doc.text(String(val), cx + halfW - 2, ry + 3.5, { align: 'right' });
    // reset
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 70);
  });

  // ── TAT Policy box ────────────────────────────────────────────
  y += tableH + 10;
  doc.setFillColor(255, 252, 230);
  doc.setDrawColor(220, 200, 100);
  doc.rect(margin, y, contentW, 16, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 80, 0);
  doc.text('TAT Charge Policy (BLP/CIR/001/2026-27)', margin + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 60, 10);
  doc.text('<=2d: 0.50% | 3d: 1.00% | 4d: 1.50% | 5d+: 0.50% x days | GST 18% on all charges', margin + 3, y + 11);
  doc.text('Charges fixed at disbursement. Refunds must be from same disbursing account (BLP/CIR/002/2026-27).', margin + 3, y + 15.5);

  // ── Signature section ─────────────────────────────────────────
  y += 26;
  doc.setDrawColor(180, 180, 200);
  // Two signature boxes
  const sigW = contentW / 2 - 6;
  doc.setFillColor(250, 250, 252);
  doc.rect(margin, y, sigW, 22, 'FD');
  doc.rect(margin + sigW + 12, y, sigW, 22, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 120);
  doc.text('AUTHORISED BY', margin + 3, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(31, 40, 70);
  doc.text('Prem / Harsha', margin + 3, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 120);
  doc.text('RECEIVED BY', margin + sigW + 15, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(31, 40, 70);
  doc.text(loan.borrower_name || 'Customer', margin + sigW + 15, y + 16);

  // ── Footer ────────────────────────────────────────────────────
  doc.setFillColor(31, 40, 70);
  doc.rect(0, pageH - 12, W, 12, 'F');
  doc.setTextColor(180, 190, 220);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('BridgeLine Partners', margin, pageH - 5);
  doc.text('Page 1 of 1', W / 2, pageH - 5, { align: 'center' });
  doc.text(`Confidential | Generated: ${today}`, W - margin, pageH - 5, { align: 'right' });

  return doc.output('arraybuffer');
}

async function sendWhatsApp(to, message, mediaUrl) {
  if (!TWILIO_SID || !TWILIO_TOKEN) return { skipped: 'Twilio not configured' };
  const toNum = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const body = new URLSearchParams({ From: TWILIO_FROM, To: toNum, Body: message });
  if (mediaUrl) body.append('MediaUrl', mediaUrl);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json();
  return { success: res.ok, sid: data.sid, error: data.message };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { loan_id, collection_id, group_numbers } = await req.json();

  if (!loan_id) return Response.json({ error: 'loan_id required' }, { status: 400 });

  // Fetch loan
  const loan = await base44.asServiceRole.entities.Loan.get(loan_id);
  if (!loan) return Response.json({ error: 'Loan not found' }, { status: 404 });

  // Fetch collection record if provided (for collection memos)
  let collection = null;
  if (collection_id) {
    const cols = await base44.asServiceRole.entities.Collection.filter({ id: collection_id });
    if (cols.length > 0) collection = cols[0];
  }

  // Fetch logo and build PDF
  const logoBase64 = await fetchLogoBase64();
  const pdfBytes = buildPDF(loan, collection, logoBase64);

  // Upload PDF to get a public URL
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const file = new File([blob], `memo_${loan.loan_number || loan_id}.pdf`, { type: 'application/pdf' });
  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

  // Compose WhatsApp message
  const isClosed = !!collection;
  const charges = loan.charges || 0;
  const gst = loan.gst || 0;
  const totalPayable = (loan.principal || 0) + charges + gst;

  let message;
  if (isClosed) {
    message = `✅ *BridgeLine Partners — Collection Memo*\n\n` +
      `Case: *${loan.loan_number || loan.disbursal_id || '-'}*\n` +
      `Borrower: ${loan.borrower_name}\n` +
      `Branch: ${loan.branch || '-'} | Cluster: ${loan.cluster || '-'}\n` +
      `Amount Collected: *₹${Number(collection?.amount_collected || totalPayable).toLocaleString('en-IN')}*\n` +
      `Status: *CLOSED ✓*\n\n` +
      `Please find the collection memo attached.`;
  } else {
    message = `📋 *BridgeLine Partners — Disbursement Memo*\n\n` +
      `Case: *${loan.loan_number || loan.disbursal_id || '-'}*\n` +
      `Borrower: ${loan.borrower_name}\n` +
      `Branch: ${loan.branch || '-'} | Cluster: ${loan.cluster || '-'}\n` +
      `Principal: *₹${Number(loan.principal || 0).toLocaleString('en-IN')}*\n` +
      `Total Payable: *₹${Number(totalPayable).toLocaleString('en-IN')}*\n` +
      `Date: ${loan.disbursement_date || '-'}\n\n` +
      `Please find the disbursement memo attached.`;
  }

  // Determine recipients: group_numbers OR cluster managers for the loan's cluster
  let recipients = [];
  if (group_numbers && group_numbers.length > 0) {
    recipients = group_numbers;
  } else {
    // Default: send to cluster managers of this cluster + the submitter
    const managers = await base44.asServiceRole.entities.TeamMember.filter({
      role: 'cluster_manager',
      cluster: loan.cluster,
      status: 'active',
    });
    recipients = managers.filter(m => m.phone).map(m => m.phone);

    if (loan.submitted_by) {
      const submitters = await base44.asServiceRole.entities.User.filter({ email: loan.submitted_by });
      if (submitters.length > 0 && submitters[0].phone) {
        recipients.push(submitters[0].phone);
      }
    }
  }

  // Send to all recipients
  const results = await Promise.all(
    recipients.map(phone => sendWhatsApp(phone, message, file_url))
  );

  return Response.json({ success: true, pdf_url: file_url, recipients: recipients.length, results });
});