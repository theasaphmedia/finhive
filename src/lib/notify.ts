import { createAdminClient } from "@/lib/supabase/admin";

// Generic notification rail. Always writes a durable `notifications` row
// first -- that row is the source of truth that an alert was *supposed* to
// go out, independent of whether any delivery provider is configured. If
// RESEND_API_KEY is set, it also attempts a real email send via Resend's
// plain REST API (no SDK dependency needed for one endpoint). If it isn't
// set, or the send fails, the notification row still exists with an `error`
// explaining why -- nothing is silently lost.
//
// WhatsApp is intentionally schema-ready (`channel: 'whatsapp'`) but not
// wired to a real provider yet -- that needs a Meta/Twilio WhatsApp Business
// account set up outside of code, not something this function can complete
// on its own.
export async function notifyOrgAdmins(params: {
  organizationId: string;
  type: string;
  subject: string;
  body: string;
}) {
  const admin = createAdminClient();

  const { data: recipients } = await admin
    .from("profiles")
    .select("id, email, name")
    .eq("organization_id", params.organizationId)
    .in("role", ["owner", "admin"]);

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.NOTIFICATIONS_FROM_EMAIL ?? "FinHive <notifications@finhive.app>";

  for (const recipient of recipients ?? []) {
    let sentAt: string | null = null;
    let error: string | null = null;

    if (!resendApiKey) {
      error = "RESEND_API_KEY is not configured -- notification logged only, not delivered.";
    } else {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: recipient.email,
            subject: params.subject,
            text: params.body,
          }),
        });
        if (res.ok) {
          sentAt = new Date().toISOString();
        } else {
          const body = await res.text();
          error = `Resend API error (${res.status}): ${body.slice(0, 300)}`;
        }
      } catch (e) {
        error = `Resend request failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    await admin.from("notifications").insert({
      organization_id: params.organizationId,
      recipient_profile_id: recipient.id,
      channel: "email",
      type: params.type,
      subject: params.subject,
      body: params.body,
      sent_at: sentAt,
      error,
    });
  }

  return { recipientCount: recipients?.length ?? 0, delivering: !!resendApiKey };
}
