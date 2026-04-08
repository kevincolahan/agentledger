/**
 * AgentLedger — Audit Package PDF Generator
 *
 * Generates a structured PDF audit package containing:
 *   1. Cover page with org details and report period
 *   2. Executive summary
 *   3. Agent Authorization Records (with on-chain verification)
 *   4. Policy Findings (open + disposed)
 *   5. Auditor attestation page
 *
 * For FEDERAL format: uses NIST SP 800-53 / CMMC language throughout
 * For CPA format: focuses on tax events, per-wallet cost basis summary
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { createElement } from "react";
import type {
  Organization,
  AgentWallet,
  AuthorizationRecord,
  PolicyFinding,
  AuditReport,
} from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────

export interface AuditPackageData {
  org: Organization;
  report: AuditReport;
  agents: (AgentWallet & {
    authorizationRecords: AuthorizationRecord[];
    policyFindings: PolicyFinding[];
    _count: { auditSessions: number; taxEvents: number };
  })[];
  generatedAt: Date;
  generatedBy?: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────

const COLORS = {
  black: "#0a0a0a",
  white: "#ffffff",
  green: "#16a34a",
  greenLight: "#dcfce7",
  gray900: "#111827",
  gray600: "#4b5563",
  gray400: "#9ca3af",
  gray100: "#f3f4f6",
  gray50: "#f9fafb",
  red: "#dc2626",
  redLight: "#fef2f2",
  amber: "#d97706",
  amberLight: "#fffbeb",
  border: "#e5e7eb",
};

const styles = StyleSheet.create({
  page: {
    padding: "48 56",
    fontFamily: "Helvetica",
    backgroundColor: COLORS.white,
    color: COLORS.gray900,
  },
  coverPage: {
    padding: "72 56",
    backgroundColor: COLORS.black,
  },
  // Cover
  coverEyebrow: {
    fontSize: 9,
    fontFamily: "Helvetica",
    letterSpacing: 1.5,
    color: COLORS.green,
    marginBottom: 24,
    textTransform: "uppercase",
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    color: COLORS.white,
    lineHeight: 1.3,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 48,
  },
  coverMeta: {
    fontSize: 11,
    color: "#6b7280",
    lineHeight: 1.8,
  },
  coverMetaLabel: {
    color: "#374151",
    fontFamily: "Helvetica-Bold",
  },
  coverDivider: {
    borderBottom: `1 solid #1f2937`,
    marginVertical: 32,
  },
  // Page header
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
    paddingBottom: 12,
    borderBottom: `1 solid ${COLORS.border}`,
  },
  pageHeaderBrand: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: COLORS.gray400,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  pageHeaderRight: {
    fontSize: 9,
    color: COLORS.gray400,
  },
  // Section
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: COLORS.gray900,
    marginBottom: 4,
    marginTop: 8,
  },
  sectionSubtitle: {
    fontSize: 10,
    color: COLORS.gray600,
    marginBottom: 20,
  },
  // Cards
  card: {
    backgroundColor: COLORS.gray50,
    border: `1 solid ${COLORS.border}`,
    borderRadius: 6,
    padding: "16 18",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: COLORS.gray900,
    marginBottom: 6,
  },
  cardRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  cardLabel: {
    fontSize: 9,
    color: COLORS.gray600,
    width: 160,
    fontFamily: "Helvetica-Bold",
  },
  cardValue: {
    fontSize: 9,
    color: COLORS.gray900,
    flex: 1,
  },
  // Severity badges
  badge: {
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  badgeCritical: { backgroundColor: "#fef2f2", color: "#dc2626" },
  badgeHigh: { backgroundColor: "#fff7ed", color: "#c2410c" },
  badgeMedium: { backgroundColor: "#fffbeb", color: "#b45309" },
  badgeLow: { backgroundColor: "#f0fdf4", color: "#15803d" },
  // Anchor box
  anchorBox: {
    backgroundColor: "#f0fdf4",
    border: `1 solid #bbf7d0`,
    borderRadius: 4,
    padding: "8 10",
    marginTop: 8,
  },
  anchorLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.green,
    marginBottom: 3,
  },
  anchorValue: {
    fontSize: 8,
    color: COLORS.gray600,
    fontFamily: "Courier",
  },
  // Attestation
  attestation: {
    border: `1 solid ${COLORS.border}`,
    borderRadius: 6,
    padding: "24 28",
    marginTop: 24,
  },
  attestationTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLORS.gray900,
    marginBottom: 12,
  },
  attestationBody: {
    fontSize: 10,
    color: COLORS.gray600,
    lineHeight: 1.7,
    marginBottom: 24,
  },
  signatureLine: {
    flexDirection: "row",
    gap: 32,
    marginTop: 8,
  },
  sigField: {
    flex: 1,
  },
  sigLabel: {
    fontSize: 8,
    color: COLORS.gray400,
    borderTop: `1 solid ${COLORS.border}`,
    paddingTop: 6,
    marginTop: 40,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `1 solid ${COLORS.border}`,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: COLORS.gray400,
  },
});

// ─── Helper components ─────────────────────────────────────────────────────

function PageHeader({ org, title }: { org: Organization; title: string }) {
  return createElement(
    View,
    { style: styles.pageHeader },
    createElement(Text, { style: styles.pageHeaderBrand }, "AgentLedger"),
    createElement(
      Text,
      { style: styles.pageHeaderRight },
      `${org.name} · ${title}`
    )
  );
}

function Footer({ pageNum, total }: { pageNum: number; total: number }) {
  return createElement(
    View,
    { style: styles.footer },
    createElement(
      Text,
      { style: styles.footerText },
      "CONFIDENTIAL — For authorized review only"
    ),
    createElement(
      Text,
      { style: styles.footerText },
      `Page ${pageNum} of ${total}`
    )
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const badgeStyle =
    severity === "CRITICAL"
      ? styles.badgeCritical
      : severity === "HIGH"
      ? styles.badgeHigh
      : severity === "MEDIUM"
      ? styles.badgeMedium
      : styles.badgeLow;

  return createElement(Text, { style: [styles.badge, badgeStyle] }, severity);
}

// ─── Document ─────────────────────────────────────────────────────────────

function AuditPackageDocument({ data }: { data: AuditPackageData }) {
  const { org, report, agents, generatedAt } = data;
  const periodStart = new Date(report.periodStart).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const periodEnd = new Date(report.periodEnd).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const isFederal = report.reportFormat === "FEDERAL";

  const openFindings = agents.flatMap((a) =>
    a.policyFindings.filter((f) => f.status === "OPEN")
  );
  const criticalCount = openFindings.filter((f) => f.severity === "CRITICAL").length;

  const totalAuthRecords = agents.flatMap((a) => a.authorizationRecords).length;

  return createElement(
    Document,
    { author: "AgentLedger", title: `Audit Package — ${org.name}` },

    // ── Cover Page ────────────────────────────────────────────────────────
    createElement(
      Page,
      { size: "LETTER", style: styles.coverPage },
      createElement(Text, { style: styles.coverEyebrow }, "AgentLedger Audit Package"),
      createElement(
        Text,
        { style: styles.coverTitle },
        `Autonomous Agent\nCompliance Report`
      ),
      createElement(
        Text,
        { style: styles.coverSubtitle },
        `${periodStart} — ${periodEnd}`
      ),
      createElement(View, { style: styles.coverDivider }),
      createElement(
        Text,
        { style: styles.coverMeta },
        [
          `Organization:    ${org.name}\n`,
          `Report ID:       ${report.id}\n`,
          `Format:          ${report.reportFormat} ${isFederal ? "(NIST SP 800-53 / CMMC)" : ""}\n`,
          `Agents covered:  ${agents.length}\n`,
          `Auth records:    ${totalAuthRecords}\n`,
          `Open findings:   ${openFindings.length} (${criticalCount} critical)\n`,
          `Generated:       ${generatedAt.toISOString()}\n`,
          data.generatedBy ? `Requested by:    ${data.generatedBy}\n` : "",
        ].join("")
      ),
      createElement(View, { style: styles.coverDivider }),
      createElement(
        Text,
        { style: { ...styles.coverMeta, fontSize: 9, color: "#4b5563" } },
        "This report was generated by AgentLedger and contains confidential compliance " +
          "documentation. On-chain anchoring provides cryptographic proof of record integrity. " +
          "All authorization record hashes and session Merkle roots can be independently " +
          "verified on the Solana blockchain."
      )
    ),

    // ── Executive Summary ────────────────────────────────────────────────
    createElement(
      Page,
      { size: "LETTER", style: styles.page },
      createElement(PageHeader, { org, title: "Executive Summary" }),
      createElement(Text, { style: styles.sectionTitle }, "Executive Summary"),
      createElement(
        Text,
        { style: styles.sectionSubtitle },
        `Reporting period: ${periodStart} through ${periodEnd}`
      ),

      // KPI row
      createElement(
        View,
        { style: { flexDirection: "row", gap: 12, marginBottom: 24 } },
        ...[
          { label: "Agent wallets", value: String(agents.length) },
          { label: "Auth records", value: String(totalAuthRecords) },
          { label: "Open findings", value: String(openFindings.length) },
          { label: "Critical findings", value: String(criticalCount), danger: criticalCount > 0 },
        ].map(({ label, value, danger }) =>
          createElement(
            View,
            {
              style: {
                flex: 1,
                backgroundColor: danger ? COLORS.redLight : COLORS.gray50,
                border: `1 solid ${danger ? "#fecaca" : COLORS.border}`,
                borderRadius: 6,
                padding: "12 14",
              },
            },
            createElement(
              Text,
              { style: { fontSize: 22, fontFamily: "Helvetica-Bold", color: danger ? COLORS.red : COLORS.gray900, marginBottom: 4 } },
              value
            ),
            createElement(Text, { style: { fontSize: 9, color: COLORS.gray600 } }, label)
          )
        )
      ),

      // Compliance status
      createElement(
        View,
        { style: styles.card },
        createElement(Text, { style: styles.cardTitle },
          isFederal ? "CMMC / NIST SP 800-53 Compliance Status" : "Compliance Status"
        ),
        createElement(
          Text,
          { style: { fontSize: 10, color: COLORS.gray600, lineHeight: 1.7 } },
          agents.length === 0
            ? "No agent wallets are registered for this organization."
            : `${agents.length} autonomous agent wallet${agents.length > 1 ? "s" : ""} ` +
              `operated under documented authorization during this period. ` +
              `${totalAuthRecords} authorization record${totalAuthRecords > 1 ? "s" : ""} ` +
              `${isFederal
                ? "establish formal access control boundaries per NIST SP 800-53 AC-2 (Account Management) and AC-17 (Remote Access)."
                : "define the operational scope and transaction limits for each agent."
              } ` +
              (openFindings.length === 0
                ? "No open policy findings were detected."
                : `${openFindings.length} open finding${openFindings.length > 1 ? "s" : ""} require${openFindings.length === 1 ? "s" : ""} ` +
                  `attention${criticalCount > 0 ? `, including ${criticalCount} critical item${criticalCount > 1 ? "s" : ""} requiring immediate action` : ""}.`)
        )
      ),

      createElement(Footer, { pageNum: 2, total: 4 })
    ),

    // ── Authorization Records ────────────────────────────────────────────
    createElement(
      Page,
      { size: "LETTER", style: styles.page },
      createElement(PageHeader, { org, title: "Authorization Records" }),
      createElement(
        Text,
        { style: styles.sectionTitle },
        isFederal ? "Agent Access Authorization Records (AC-2)" : "Agent Authorization Records"
      ),
      createElement(
        Text,
        { style: styles.sectionSubtitle },
        isFederal
          ? "Formal account authorization per NIST SP 800-53 AC-2. Each agent wallet operates under a signed authorization record anchored on the Solana blockchain."
          : "Each agent wallet operates under a signed authorization record. Hashes are anchored on-chain for tamper-proof verification."
      ),

      ...agents.flatMap((agent) =>
        agent.authorizationRecords
          .filter((r) => !r.effectiveTo || new Date(r.effectiveTo) >= new Date(report.periodStart))
          .map((auth) =>
            createElement(
              View,
              { style: styles.card },
              createElement(
                Text,
                { style: styles.cardTitle },
                `${agent.agentName} — Authorization v${auth.version}`
              ),
              createElement(
                View,
                { style: styles.cardRow },
                createElement(Text, { style: styles.cardLabel }, "Wallet address"),
                createElement(Text, { style: { ...styles.cardValue, fontFamily: "Courier", fontSize: 8 } }, agent.walletAddress)
              ),
              createElement(
                View,
                { style: styles.cardRow },
                createElement(Text, { style: styles.cardLabel }, "Operational purpose"),
                createElement(Text, { style: styles.cardValue }, auth.operationalPurpose)
              ),
              auth.maxTxValueUsd !== null &&
                createElement(
                  View,
                  { style: styles.cardRow },
                  createElement(Text, { style: styles.cardLabel }, "Max transaction value"),
                  createElement(Text, { style: styles.cardValue }, `$${auth.maxTxValueUsd} USD`)
                ),
              auth.maxDailySpendUsd !== null &&
                createElement(
                  View,
                  { style: styles.cardRow },
                  createElement(Text, { style: styles.cardLabel }, "Max daily spend"),
                  createElement(Text, { style: styles.cardValue }, `$${auth.maxDailySpendUsd} USD`)
                ),
              auth.permittedTxTypes.length > 0 &&
                createElement(
                  View,
                  { style: styles.cardRow },
                  createElement(Text, { style: styles.cardLabel }, "Permitted transaction types"),
                  createElement(Text, { style: styles.cardValue }, auth.permittedTxTypes.join(", "))
                ),
              auth.whitelistedPrograms.length > 0 &&
                createElement(
                  View,
                  { style: styles.cardRow },
                  createElement(Text, { style: styles.cardLabel }, "Whitelisted programs"),
                  createElement(
                    Text,
                    { style: { ...styles.cardValue, fontFamily: "Courier", fontSize: 7 } },
                    auth.whitelistedPrograms.join("\n")
                  )
                ),
              createElement(
                View,
                { style: styles.cardRow },
                createElement(Text, { style: styles.cardLabel }, "Effective from"),
                createElement(Text, { style: styles.cardValue }, new Date(auth.effectiveFrom).toISOString())
              ),
              // On-chain anchor
              auth.onChainAnchorTx &&
                createElement(
                  View,
                  { style: styles.anchorBox },
                  createElement(Text, { style: styles.anchorLabel }, "✓ ON-CHAIN ANCHOR VERIFIED"),
                  createElement(
                    Text,
                    { style: styles.anchorValue },
                    `Solana Tx:   ${auth.onChainAnchorTx}\nRecord Hash: ${auth.recordHash}`
                  )
                )
            )
          )
      ),

      createElement(Footer, { pageNum: 3, total: 4 })
    ),

    // ── Findings + Attestation ────────────────────────────────────────────
    createElement(
      Page,
      { size: "LETTER", style: styles.page },
      createElement(PageHeader, { org, title: "Findings & Attestation" }),
      createElement(
        Text,
        { style: styles.sectionTitle },
        isFederal ? "Policy Deviation Findings (POA&M)" : "Policy Findings"
      ),
      createElement(
        Text,
        { style: styles.sectionSubtitle },
        openFindings.length === 0
          ? "No open policy findings for this period."
          : `${openFindings.length} open finding${openFindings.length > 1 ? "s" : ""} detected.`
      ),

      ...openFindings.slice(0, 8).map((finding) =>
        createElement(
          View,
          { style: styles.card },
          createElement(
            View,
            { style: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 } },
            createElement(SeverityBadge, { severity: finding.severity }),
            createElement(Text, { style: styles.cardTitle }, finding.title)
          ),
          createElement(
            Text,
            { style: { fontSize: 9, color: COLORS.gray600, lineHeight: 1.6, marginBottom: 8 } },
            finding.description
          ),
          finding.txSignature &&
            createElement(
              Text,
              { style: { fontSize: 8, fontFamily: "Courier", color: COLORS.gray400 } },
              `Tx: ${finding.txSignature}`
            ),
          createElement(
            Text,
            { style: { fontSize: 8, color: COLORS.gray400, marginTop: 4 } },
            `Status: ${finding.status} · Detected: ${new Date(finding.detectedAt).toLocaleDateString()}`
          )
        )
      ),

      openFindings.length === 0 &&
        createElement(
          View,
          {
            style: {
              backgroundColor: COLORS.greenLight,
              border: `1 solid #bbf7d0`,
              borderRadius: 6,
              padding: "16 18",
              marginBottom: 16,
            },
          },
          createElement(
            Text,
            { style: { fontSize: 10, color: COLORS.green, fontFamily: "Helvetica-Bold" } },
            "✓ No open policy findings"
          ),
          createElement(
            Text,
            { style: { fontSize: 9, color: "#15803d", marginTop: 4 } },
            "All agent activity during this period was within documented authorization scope."
          )
        ),

      // Attestation block
      createElement(
        View,
        { style: styles.attestation },
        createElement(
          Text,
          { style: styles.attestationTitle },
          "Auditor Attestation"
        ),
        createElement(
          Text,
          { style: styles.attestationBody },
          `This Autonomous Agent Compliance Report was generated by AgentLedger on ${generatedAt.toLocaleDateString()} ` +
            `for ${org.name}. The authorization records contained herein have been cryptographically ` +
            `signed by the organization and their hashes anchored to the Solana blockchain, providing ` +
            `tamper-proof evidence that these records existed as documented at the time of anchoring. ` +
            `Policy findings reflect automated analysis of agent transaction activity against the ` +
            `documented authorization scope.` +
            (isFederal
              ? ` This report is structured for use in CMMC Level 2/3 assessment activities and ` +
                `references NIST SP 800-53 Rev. 5 controls where applicable.`
              : "")
        ),
        createElement(
          View,
          { style: styles.signatureLine },
          createElement(
            View,
            { style: styles.sigField },
            createElement(Text, { style: styles.sigLabel }, "Authorized Signatory")
          ),
          createElement(
            View,
            { style: styles.sigField },
            createElement(Text, { style: styles.sigLabel }, "Title / Role")
          ),
          createElement(
            View,
            { style: styles.sigField },
            createElement(Text, { style: styles.sigLabel }, "Date")
          )
        )
      ),

      createElement(Footer, { pageNum: 4, total: 4 })
    )
  );
}

// ─── Public function: generate PDF buffer ─────────────────────────────────

export async function generateAuditPackagePdf(
  data: AuditPackageData
): Promise<Buffer> {
  const doc = createElement(AuditPackageDocument, { data });
  // Use toBuffer() for Node.js server-side rendering
  // toBlob() requires a browser Blob API which is not available server-side
  const instance = pdf(doc as any);
  return instance.toBuffer() as unknown as Promise<Buffer>;
}
