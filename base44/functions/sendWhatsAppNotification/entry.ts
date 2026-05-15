import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const FROM_NUMBER = Deno.env.get("TWILIO_WHATSAPP_FROM") || "whatsapp:+14155238886";

async function sendWhatsApp(to, message) {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    return { success: false, error: "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in environment variables." };
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
      body: new URLSearchParams({
        From: FROM_NUMBER,
        To: toNumber,
        Body: message,
      }).toString(),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.message || "Twilio API error", code: data.code };
  }
  return { success: true, sid: data.sid };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { type, loan, recipients } = await req.json();

  // type: "loan_submitted" | "loan_approved" | "loan_rejected"
  // loan: loan object
  // recipients: array of { name, phone }

  if (!type || !loan || !recipients?.length) {
    return Response.json({ error: "Missing required fields: type, loan, recipients" }, { status: 400 });
  }

  let message = "";

  if (type === "loan_submitted") {
    message =
`📋 *New Loan Approval Request*

A new case requires your approval on BridgeLine Partners MIS.

🔖 Case: *${loan.loan_number || "N/A"}*
👤 Borrower: *${loan.borrower_name}*
💰 Amount: *₹${Number(loan.principal || 0).toLocaleString("en-IN")}*
🏦 Branch: ${loan.branch || "N/A"}
🗺️ Cluster: ${loan.cluster || "N/A"}
📅 Date: ${loan.disbursement_date || "N/A"}

Please log in to the BridgeLine MIS portal to review and approve.`;
  } else if (type === "loan_approved") {
    message =
`✅ *Loan Case Approved*

Your submitted case has been approved.

🔖 Case: *${loan.loan_number || "N/A"}*
👤 Borrower: *${loan.borrower_name}*
💰 Amount: *₹${Number(loan.principal || 0).toLocaleString("en-IN")}*
✔️ Status: *Approved*
${loan.cluster_manager_notes ? `📝 Notes: ${loan.cluster_manager_notes}` : ""}

Please proceed with disbursal on BridgeLine MIS.`;
  } else if (type === "loan_rejected") {
    message =
`❌ *Loan Case Rejected*

Your submitted case has been declined.

🔖 Case: *${loan.loan_number || "N/A"}*
👤 Borrower: *${loan.borrower_name}*
💰 Amount: *₹${Number(loan.principal || 0).toLocaleString("en-IN")}*
❌ Status: *Rejected*
${loan.rejection_reason ? `📝 Reason: ${loan.rejection_reason}` : ""}

Please log in to BridgeLine MIS for more details.`;
  } else {
    return Response.json({ error: `Unknown notification type: ${type}` }, { status: 400 });
  }

  const results = await Promise.all(
    recipients.map(async (r) => {
      if (!r.phone) return { name: r.name, success: false, error: "No phone number" };
      const result = await sendWhatsApp(r.phone, message);
      return { name: r.name, phone: r.phone, ...result };
    })
  );

  return Response.json({ results, message });
});