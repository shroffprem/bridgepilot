import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const AUTH_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN");
const FROM_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+14155238886";

async function sendWhatsApp(to, message) {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    console.warn("Twilio credentials not configured.");
    return { success: false, error: "Twilio not configured" };
  }
  const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: FROM_NUMBER, To: toNumber, Body: message }).toString(),
    }
  );
  const data = await res.json();
  return res.ok ? { success: true, sid: data.sid } : { success: false, error: data.message };
}

function daysBetween(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow both scheduled (no auth) and manual (admin only) invocations
  let isScheduled = false;
  try {
    const user = await base44.auth.me();
    if (user && user.role !== 'admin') {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    // No user token = scheduled call, allow it
    isScheduled = true;
  }

  // Fetch all open & overdue loans
  const loans = await base44.asServiceRole.entities.Loan.list();
  const activeLoans = loans.filter(l => ['open', 'overdue', 'follow_up'].includes(l.status));

  const results = [];
  const today = new Date();

  for (const loan of activeLoans) {
    // Skip if no borrower mobile
    if (!loan.customer_mobile) continue;

    // Calculate days since disbursement — gold loans are typically 3-month tenor
    // Remind at: 7 days before 90-day mark, on due day, and every 7 days if overdue
    const disbDate = loan.disbursement_date ? new Date(loan.disbursement_date) : null;
    if (!disbDate) continue;

    const daysSinceDisbursement = Math.round((today - disbDate) / (1000 * 60 * 60 * 24));
    const tenorDays = 90; // default gold loan tenor
    const dueDate = new Date(disbDate);
    dueDate.setDate(dueDate.getDate() + tenorDays);
    const daysUntilDue = daysBetween(dueDate.toISOString().split('T')[0]);

    let message = null;

    if (daysUntilDue === 7) {
      // 7-day advance reminder
      message =
`📢 *Payment Reminder – BridgeLine Partners*

Dear *${loan.borrower_name}*,

This is a friendly reminder that your loan repayment is due in *7 days* (${dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}).

🔖 Loan: *${loan.loan_number || 'N/A'}*
💰 Outstanding: *${formatINR(loan.outstanding || loan.principal)}*
📍 Branch: ${loan.branch || 'N/A'}

Please ensure timely repayment to avoid penalties.
For assistance, contact your branch officer.

– BridgeLine Partners`;

    } else if (daysUntilDue === 1) {
      // Due tomorrow
      message =
`⚠️ *Payment Due Tomorrow – BridgeLine Partners*

Dear *${loan.borrower_name}*,

Your loan repayment is due *tomorrow* (${dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}).

🔖 Loan: *${loan.loan_number || 'N/A'}*
💰 Outstanding: *${formatINR(loan.outstanding || loan.principal)}*

Please make the payment at the earliest to avoid late charges.

– BridgeLine Partners`;

    } else if (daysUntilDue === 0) {
      // Due today
      message =
`🔔 *Payment Due Today – BridgeLine Partners*

Dear *${loan.borrower_name}*,

Your loan repayment of *${formatINR(loan.outstanding || loan.principal)}* is due *today*.

🔖 Loan: *${loan.loan_number || 'N/A'}*
📍 Branch: ${loan.branch || 'N/A'}

Please complete the payment today to avoid overdue charges.

– BridgeLine Partners`;

    } else if (daysUntilDue < 0 && loan.status === 'overdue') {
      // Overdue — remind every 7 days
      const daysOverdue = Math.abs(daysUntilDue);
      if (daysOverdue % 7 === 0 || daysOverdue === 1) {
        message =
`❗ *Overdue Payment Notice – BridgeLine Partners*

Dear *${loan.borrower_name}*,

Your loan repayment is *overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}*.

🔖 Loan: *${loan.loan_number || 'N/A'}*
💰 Outstanding: *${formatINR(loan.outstanding || loan.principal)}*
📍 Branch: ${loan.branch || 'N/A'}

Please clear your dues immediately to avoid further action.
Contact your branch officer urgently.

– BridgeLine Partners`;
      }
    }

    if (message) {
      const result = await sendWhatsApp(loan.customer_mobile, message);
      results.push({
        loan_number: loan.loan_number,
        borrower: loan.borrower_name,
        mobile: loan.customer_mobile,
        daysUntilDue,
        ...result,
      });
      console.log(`Sent reminder to ${loan.borrower_name} (${loan.customer_mobile}): daysUntilDue=${daysUntilDue}`);
    }
  }

  return Response.json({
    processed: activeLoans.length,
    reminders_sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  });
});