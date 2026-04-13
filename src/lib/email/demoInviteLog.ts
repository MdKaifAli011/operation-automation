type DemoInviteLogPayload = {
  leadId: string;
  meetRowId: string;
  event: "skip" | "sent" | "error" | "assign_result";
  /** Machine-readable code or short key; mapped to plain language when known. */
  detail?: string;
  extra?: Record<string, unknown>;
  /** Extra sentence (e.g. API error text) when detail alone is not enough. */
  message?: string;
};

function skipDetailToSentence(detail: string | undefined, message?: string): string {
  if (message?.trim()) return message.trim();
  const d = detail ?? "";
  const map: Record<string, string> = {
    invalid_ids: "The lead id or demo row id was not valid.",
    mail_not_configured:
      "Outgoing email is not set up. Add MAIL_HOST, MAIL_USERNAME, and MAIL_PASSWORD (or SMTP_*) in your environment.",
    lead_not_found: "This student lead could not be found in the database.",
    lead_no_email: "This lead has no email address yet. Add one at the top of the student page.",
    template_missing:
      "The “Demo invite” email template is missing. Open Email templates and restore or create it.",
    template_disabled:
      "The “Demo invite” template is turned off. Enable it under Email templates.",
    demo_row_not_found_no_snapshot:
      "This demo row is not on the lead yet (the page may still be saving). Wait a moment and try again, or send the invite after the row appears.",
    no_meet_link:
      "There is no Google Meet link for this demo yet. Book a Meet slot first.",
    smtp_accepted: "",
    manual_send_failed: "The send request did not complete.",
    manual_api_failure: "Could not send from the dashboard.",
    app_returned_failure: "",
  };
  if (map[d]) return map[d];
  if (d.includes(" ") || d.length > 48) return d;
  return `Something prevented sending (${d}).`;
}

function formatBlock(p: DemoInviteLogPayload): string {
  const lines: string[] = [];
  const when = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  lines.push("");
  lines.push("────────────────── Demo invite email ──────────────────");
  lines.push(`When:     ${when}`);
  lines.push(`Lead id:  ${p.leadId}`);
  lines.push(`Demo id:  ${p.meetRowId}`);

  if (p.event === "sent") {
    const ex = (p.extra ?? {}) as {
      to?: string;
      cc?: string | null;
      bcc?: string | null;
      source?: string;
    };
    lines.push("");
    lines.push("Result:   Sent — your mail provider accepted the message.");
    lines.push(`          Student (To):     ${ex.to ?? "—"}`);
    lines.push(
      `          Teacher (Cc):     ${ex.cc && String(ex.cc).trim() ? ex.cc : "— (not set or same as student)"}`,
    );
    lines.push(
      `          Enrollment (Bcc): ${ex.bcc && String(ex.bcc).trim() ? ex.bcc : "— (set ENROLLMENT_TEAM_BCC if needed)"}`,
    );
    const how =
      ex.source === "auto_assign"
        ? "Automatic — sent right after a Meet link was booked for this slot."
        : "Manual — someone clicked “Send demo invite” on the student page.";
    lines.push(`          How:            ${how}`);
    lines.push("");
    lines.push(
      "Tip:      If an inbox looks empty, check Spam / Promotions, and your Hostinger email logs for delivery.",
    );
    lines.push("────────────────────────────────────────────────────────");
    return lines.join("\n");
  }

  if (p.event === "assign_result" && p.detail === "using_assign_snapshot_row") {
    lines.push("");
    lines.push(
      "Note:     The Meet was just booked; this row was not in the database yet. Using the slot from the booking so the email can still go out.",
    );
    lines.push("────────────────────────────────────────────────────────");
    return lines.join("\n");
  }

  if (p.event === "error") {
    const why = p.message?.trim() || p.detail?.trim() || "Unknown error";
    lines.push("");
    lines.push(`Result:   Failed — ${why}`);
    lines.push("────────────────────────────────────────────────────────");
    return lines.join("\n");
  }

  lines.push("");
  lines.push(`Result:   Not sent — ${skipDetailToSentence(p.detail, p.message)}`);
  lines.push("────────────────────────────────────────────────────────");
  return lines.join("\n");
}

/**
 * Readable server logs for demo invite flow (not JSON blobs).
 * Search logs for: "Demo invite email"
 */
export function logDemoInviteEmail(payload: DemoInviteLogPayload): void {
  const text = formatBlock(payload);
  if (payload.event === "error") {
    console.error(text);
  } else {
    console.info(text);
  }
}
