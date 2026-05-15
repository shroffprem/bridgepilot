import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// This function is triggered by entity automation on Loan create/update
// It determines who to notify and what message to send

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const payload = await req.json();

  const { event, data: loan, old_data } = payload;

  if (!loan) return Response.json({ skipped: "No loan data" });

  const isNew = event?.type === "create";
  const isUpdate = event?.type === "update";

  // Determine notification type
  let notificationType = null;
  let recipientRole = null;

  if (isNew && ["pending_cluster_approval", "pending_zonal_approval"].includes(loan.status)) {
    notificationType = "loan_submitted";
    recipientRole = loan.status === "pending_zonal_approval" ? "zonal_manager" : "cluster_manager";
  } else if (isUpdate) {
    const oldStatus = old_data?.status;
    const newStatus = loan.status;

    if (oldStatus === newStatus) return Response.json({ skipped: "Status unchanged" });

    if (newStatus === "open") {
      notificationType = "loan_approved";
      recipientRole = "submitted_by_user"; // notify the submitter
    } else if (newStatus === "rejected") {
      notificationType = "loan_rejected";
      recipientRole = "submitted_by_user";
    } else if (["pending_cluster_approval", "pending_zonal_approval"].includes(newStatus)) {
      notificationType = "loan_submitted";
      recipientRole = newStatus === "pending_zonal_approval" ? "zonal_manager" : "cluster_manager";
    }
  }

  if (!notificationType) return Response.json({ skipped: "No notification needed for this status" });

  // Find recipients
  let recipients = [];

  if (recipientRole === "submitted_by_user") {
    // Notify whoever submitted the loan
    if (loan.submitted_by) {
      const users = await base44.asServiceRole.entities.User.filter({ email: loan.submitted_by });
      if (users.length > 0 && users[0].phone) {
        recipients = [{ name: users[0].full_name || loan.submitted_by, phone: users[0].phone }];
      }
    }
  } else {
    // Find team members with the right role in the same cluster/zone
    const teamFilter = { role: recipientRole, status: "active" };
    if (loan.cluster && recipientRole === "cluster_manager") teamFilter.cluster = loan.cluster;
    if (loan.zone && recipientRole === "zonal_manager") teamFilter.zone = loan.zone;

    const members = await base44.asServiceRole.entities.TeamMember.filter(teamFilter);
    recipients = members
      .filter(m => m.phone)
      .map(m => ({ name: m.full_name, phone: m.phone }));
  }

  if (!recipients.length) {
    return Response.json({ skipped: "No recipients with phone numbers found", role: recipientRole });
  }

  // Call the WhatsApp sender
  const result = await base44.asServiceRole.functions.invoke("sendWhatsAppNotification", {
    type: notificationType,
    loan,
    recipients,
  });

  return Response.json({ sent: true, notificationType, recipients: recipients.length, result });
});