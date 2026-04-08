/**
 * AgentLedger — Email Notifications
 *
 * All transactional emails via Resend.
 * Called from background jobs — never from request handlers directly.
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM ?? "AgentLedger <noreply@agentledger.io>";
const APP    = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentledger.io";

// ─── Report ready ──────────────────────────────────────────────────────────

export async function sendReportReady({
  to,
  orgName,
  reportId,
  reportType,
  periodStart,
  periodEnd,
  downloadUrl,
  findingCount,
  agentCount,
}: {
  to: string;
  orgName: string;
  reportId: string;
  reportType: string;
  periodStart: Date;
  periodEnd: Date;
  downloadUrl: string;
  findingCount: number;
  agentCount: number;
}) {
  const label = reportType.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  const period = `${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your audit report is ready — ${orgName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="max-width:560px;margin:40px auto;padding:40px;background:#111;border:1px solid #1f1f1f;border-radius:12px;">
    <tr><td>
      <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#22c55e;">AgentLedger</p>
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:600;color:#fff;">Your report is ready</h1>
      <p style="margin:0 0 28px;font-size:14px;color:#666;">${orgName}</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #1a1a1a;border-radius:8px;padding:20px;margin-bottom:28px;">
        <tr>
          <td style="font-size:12px;color:#555;padding-bottom:10px;">Report type</td>
          <td style="font-size:12px;color:#ccc;text-align:right;padding-bottom:10px;">${label}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#555;padding-bottom:10px;">Period</td>
          <td style="font-size:12px;color:#ccc;text-align:right;padding-bottom:10px;">${period}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#555;padding-bottom:10px;">Agents covered</td>
          <td style="font-size:12px;color:#ccc;text-align:right;padding-bottom:10px;">${agentCount}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#555;">Open findings</td>
          <td style="font-size:12px;color:${findingCount > 0 ? "#fbbf24" : "#22c55e"};text-align:right;font-weight:600;">${findingCount}</td>
        </tr>
      </table>

      <a href="${downloadUrl}"
        style="display:inline-block;padding:13px 28px;background:#22c55e;color:#000;
        font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;margin-bottom:20px;">
        Download PDF report →
      </a>

      <p style="margin:20px 0 0;font-size:12px;color:#444;line-height:1.6;">
        This download link expires in 1 hour. You can generate a fresh link from your
        <a href="${APP}/reports" style="color:#22c55e;text-decoration:none;">reports dashboard</a>
        at any time.<br><br>
        Report ID: <code style="font-family:monospace;font-size:11px;color:#555;">${reportId}</code>
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

// ─── Critical findings alert ────────────────────────────────────────────────

export async function sendFindingsAlert({
  to,
  orgName,
  criticalCount,
  highCount,
  findings,
}: {
  to: string;
  orgName: string;
  criticalCount: number;
  highCount: number;
  findings: { title: string; agentName: string; severity: string }[];
}) {
  const total = criticalCount + highCount;
  if (total === 0) return;

  const rows = findings
    .slice(0, 5)
    .map(
      (f) =>
        `<tr>
          <td style="font-size:12px;color:#ccc;padding:8px 0;border-bottom:1px solid #1a1a1a;">${f.agentName}</td>
          <td style="font-size:11px;color:${f.severity === "CRITICAL" ? "#ef4444" : "#f97316"};padding:8px 0;border-bottom:1px solid #1a1a1a;font-weight:600;">${f.severity}</td>
          <td style="font-size:12px;color:#999;padding:8px 0;border-bottom:1px solid #1a1a1a;">${f.title}</td>
        </tr>`
    )
    .join("");

  await resend.emails.send({
    from: FROM,
    to,
    subject: `⚠ ${total} policy finding${total > 1 ? "s" : ""} require attention — ${orgName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="max-width:560px;margin:40px auto;padding:40px;background:#111;border:1px solid #1f1f1f;border-radius:12px;">
    <tr><td>
      <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#22c55e;">AgentLedger</p>
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:600;color:#fff;">Policy findings detected</h1>
      <p style="margin:0 0 28px;font-size:14px;color:#666;">${orgName}</p>

      <div style="background:#1a0a0a;border:1px solid #3f1010;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#ef4444;font-weight:600;">
          ${criticalCount > 0 ? `${criticalCount} CRITICAL` : ""}${criticalCount > 0 && highCount > 0 ? " · " : ""}${highCount > 0 ? `${highCount} HIGH` : ""} finding${total > 1 ? "s" : ""} require immediate review
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <th style="font-size:11px;color:#555;text-align:left;padding-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Agent</th>
          <th style="font-size:11px;color:#555;text-align:left;padding-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Severity</th>
          <th style="font-size:11px;color:#555;text-align:left;padding-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Finding</th>
        </tr>
        ${rows}
      </table>

      <a href="${APP}/findings"
        style="display:inline-block;padding:13px 28px;background:#22c55e;color:#000;
        font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
        Review findings →
      </a>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

// ─── Anchor failure alert ───────────────────────────────────────────────────

export async function sendAnchorFailureAlert({
  to,
  orgName,
  recordId,
  recordType,
  errorMessage,
}: {
  to: string;
  orgName: string;
  recordId: string;
  recordType: "AUTH" | "SESSION";
  errorMessage: string;
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `On-chain anchoring failed — ${orgName}`,
    html: `
<body style="font-family:monospace;background:#0a0a0a;color:#ccc;padding:40px;max-width:600px;margin:0 auto;">
  <p style="color:#22c55e;font-weight:bold;margin:0 0 16px;">AgentLedger — Anchor Failure</p>
  <p>An on-chain anchor transaction failed and could not be retried automatically.</p>
  <table style="border:1px solid #222;border-radius:4px;padding:16px;width:100%;margin:16px 0;">
    <tr><td style="color:#555;padding:4px 0;">Org</td><td>${orgName}</td></tr>
    <tr><td style="color:#555;padding:4px 0;">Record type</td><td>${recordType}</td></tr>
    <tr><td style="color:#555;padding:4px 0;">Record ID</td><td style="font-size:11px;">${recordId}</td></tr>
    <tr><td style="color:#555;padding:4px 0;">Error</td><td style="color:#ef4444;">${errorMessage}</td></tr>
  </table>
  <p>The record is still valid and stored. Manual anchoring can be triggered from your dashboard or by contacting support.</p>
</body>`,
  });
}
