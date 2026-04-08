/**
 * AgentLedger — Outreach Engine
 *
 * Three target segments, each with different angles:
 *
 * 1. FEDERAL CONTRACTORS (SAM.gov)
 *    Angle: CMMC/NIST compliance for autonomous agents
 *    Source: SAM.gov Entity Management API (public)
 *    Filter: NAICS 541511, 541512, 541519, 541690 + SDVOSB/VOSB
 *
 * 2. SOLANA BUILDERS (Agent Registry)
 *    Angle: Audit trails and compliance packages for production agents
 *    Source: Solana Agent Registry API
 *    Filter: Agents with active transactions (Helius)
 *
 * 3. AI OPS / ENTERPRISE
 *    Angle: CFO/legal governance for autonomous agent fleets
 *    Source: LinkedIn (manual import), conference lists
 */

import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { prisma } from "../prisma";
import { FEDERAL_SEQUENCE, SOLANA_SEQUENCE, ONBOARDING_SEQUENCE } from "./sequences";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend    = new Resend(process.env.RESEND_API_KEY);
const FROM      = process.env.RESEND_FROM ?? "Kevin <kevin@agentledger.io>";

// ─── Contact sourcing ─────────────────────────────────────────────────────────

export async function sourceFederalContractors(limit = 50): Promise<{
  email: string;
  firstName?: string;
  lastName?: string;
  company: string;
  cageCode: string;
  uei: string;
  naicsCode: string;
}[]> {
  // SAM.gov Entity Management API — public, no key required for basic queries
  const url = new URL("https://api.sam.gov/entity-information/v3/entities");
  url.searchParams.set("api_key", process.env.SAM_GOV_API_KEY ?? "DEMO_KEY");
  url.searchParams.set("samRegistered", "Yes");
  url.searchParams.set("entityEFTIndicator", "");
  url.searchParams.set("ueiSAM", "");
  // NAICS: IT services, cybersecurity, consulting
  url.searchParams.set("primaryNaics", "541512,541511,541519,541690,541330");
  url.searchParams.set("businessTypeCode", "VW,A2"); // SDVOSB, VOSB
  url.searchParams.set("activeDate", "[NOW-90DAY TO NOW]");
  url.searchParams.set("registrationStatus", "A");
  url.searchParams.set("pageSize", String(limit));

  try {
    const res  = await fetch(url.toString(), { headers: { "Accept": "application/json" } });
    if (!res.ok) {
      console.warn("[outreach] SAM.gov API unavailable — using mock data for dev");
      return getMockContractors();
    }
    const data = await res.json();
    return (data.entityData ?? []).map((e: any) => ({
      email:     e.coreData?.electronicBusinessPOC?.email ?? "",
      firstName: e.coreData?.electronicBusinessPOC?.firstName,
      lastName:  e.coreData?.electronicBusinessPOC?.lastName,
      company:   e.entityRegistration?.legalBusinessName ?? "",
      cageCode:  e.entityRegistration?.cageCode ?? "",
      uei:       e.entityRegistration?.ueiSAM ?? "",
      naicsCode: e.assertions?.goodsAndServices?.primaryNaics ?? "",
    })).filter((c: any) => c.email && c.company);
  } catch {
    return getMockContractors();
  }
}

function getMockContractors() {
  // Mock data for development / when SAM.gov API is unavailable
  return [
    { email: "bd@example-contractor.com", firstName: "James", lastName: "Wilson", company: "Apex Defense Solutions LLC", cageCode: "8X3F2", uei: "ABCD12345678", naicsCode: "541512" },
    { email: "contracts@example-it.com",  firstName: "Sarah", lastName: "Chen",   company: "Meridian IT Consulting",      cageCode: "7K9P4", uei: "EFGH87654321", naicsCode: "541511" },
  ];
}

export async function sourceSolanaBuilders(): Promise<{
  walletAddress: string;
  agentName?: string;
  registryId?: string;
}[]> {
  try {
    const res  = await fetch("https://registry.solana.com/api/agents?limit=100&hasTransactions=true");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.agents ?? []).map((a: any) => ({
      walletAddress: a.walletAddress,
      agentName:     a.name,
      registryId:    a.id,
    }));
  } catch {
    return [];
  }
}

// ─── Email personalization via Claude ─────────────────────────────────────────

export async function personalizeEmail(params: {
  segment: "federal" | "solana" | "enterprise";
  contact: {
    firstName?: string;
    company?: string;
    cageCode?: string;
    naicsCode?: string;
    agentName?: string;
  };
  sequenceStep: number;
}): Promise<{ subject: string; body: string }> {
  const { segment, contact, sequenceStep } = params;

  const context = {
    federal: `
      The prospect is a federal contractor. Company: ${contact.company}. 
      CAGE: ${contact.cageCode}. NAICS: ${contact.naicsCode}.
      Pain point: CMMC Level 2/3 assessments are now requiring documentation of autonomous AI agent governance.
      Angle: AgentLedger produces NIST SP 800-53 formatted compliance packages for agents.
      Sender: Kevin Colahan, PMP — Partner at GreyLee Services Group (SDVOSB, CAGE 0Q6E5), 
      also founder of AgentLedger. Defense contracting background.`,
    solana: `
      The prospect is building AI agents on Solana. Agent: ${contact.agentName}.
      Pain point: As they scale to production and enterprise clients, 
      they need audit trails and compliance documentation for their agents.
      Angle: AgentLedger is the compliance layer built specifically for Solana agents.
      Short, developer-to-developer tone. Reference the Solana Agent Registry.`,
    enterprise: `
      The prospect is at an enterprise deploying AI agents internally.
      Pain point: CFO/legal/audit team is asking how agent activity is governed.
      Angle: AgentLedger is the documented governance layer for autonomous agent fleets.
      Board-level language, ROI focus.`,
  };

  const stepContext = sequenceStep === 0
    ? "This is the first contact. Be brief (4-5 sentences max). Lead with the problem, not the product."
    : sequenceStep === 1
    ? "Second touchpoint. Acknowledge no response. Add a specific example or case."
    : "Final follow-up. Short, low-pressure. Offer a specific next step.";

  const prompt = `Write a personalized cold email for this prospect.

Context: ${context[segment]}
Step: ${stepContext}
First name: ${contact.firstName ?? "there"}

Requirements:
- Subject line: under 8 words, specific, no spam words
- Body: plain text, no HTML, under 120 words
- No generic openers like "I hope this finds you well"
- No bullet points
- End with a specific, low-commitment CTA (15-minute call or reply with a question)
- Sound like a human, not a marketing automation

Respond ONLY with valid JSON: {"subject": "...", "body": "..."}
No preamble, no markdown, no explanation.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    // Fall back to static template
    const sequences = { federal: FEDERAL_SEQUENCE, solana: SOLANA_SEQUENCE, enterprise: ONBOARDING_SEQUENCE };
    const seq = sequences[segment];
    const step = seq[Math.min(sequenceStep, seq.length - 1)];
    const body = step.body
      .replace(/\{\{firstName\}\}/g, params.contact.firstName ?? "there")
      .replace(/\{\{company\}\}/g, params.contact.company ?? "your organization")
      .replace(/\{\{agentName\}\}/g, params.contact.agentName ?? "your agent")
      .replace(/\{\{apiKey\}\}/g, "al_live_...");
    return { subject: step.subject, body };
  }
}

// ─── Send sequence step ───────────────────────────────────────────────────────

export async function sendOutreachEmail(params: {
  contactId: string;
  email: string;
  subject: string;
  body: string;
}): Promise<string | null> {
  try {
    const { data } = await resend.emails.send({
      from: FROM,
      to:   params.email,
      subject: params.subject,
      text:    params.body,
      headers: {
        "X-AgentLedger-Contact": params.contactId,
        "List-Unsubscribe": `<mailto:unsubscribe@agentledger.io?subject=unsubscribe-${params.contactId}>`,
      },
    });

    await prisma.outreachEvent.create({
      data: {
        contactId: params.contactId,
        eventType: "SENT",
        subject:   params.subject,
        body:      params.body,
        messageId: data?.id,
      },
    });

    return data?.id ?? null;
  } catch (err) {
    console.error("[outreach] Send failed:", err);
    return null;
  }
}

// ─── Run sequence step for all due contacts ───────────────────────────────────

export async function runDueSequenceSteps(): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  const due = await prisma.contactSequence.findMany({
    where: {
      paused:      false,
      completedAt: null,
      nextSendAt:  { lte: new Date() },
    },
    include: {
      contact:  true,
      sequence: true,
    },
    take: 50, // Max 50 emails per run
  });

  let sent = 0, errors = 0;

  for (const item of due) {
    const steps: any[] = item.sequence.steps as any[];
    const stepIdx = item.currentStep;

    if (stepIdx >= steps.length) {
      await prisma.contactSequence.update({
        where: { id: item.id },
        data:  { completedAt: new Date() },
      });
      continue;
    }

    const step = steps[stepIdx];

    try {
      // Generate personalized email
      const segment = item.sequence.targetAudience as "federal" | "solana" | "enterprise";
      const email = await personalizeEmail({
        segment,
        contact: {
          firstName: item.contact.firstName ?? undefined,
          company:   item.contact.company   ?? undefined,
          cageCode:  item.contact.cageCode  ?? undefined,
          naicsCode: item.contact.naicsCode ?? undefined,
        },
        sequenceStep: stepIdx,
      });

      const messageId = await sendOutreachEmail({
        contactId: item.contact.id,
        email:     item.contact.email,
        subject:   email.subject,
        body:      email.body,
      });

      if (messageId) {
        // Advance to next step
        const nextStep     = stepIdx + 1;
        const isLastStep   = nextStep >= steps.length;
        const nextDelay    = isLastStep ? null : steps[nextStep]?.delayDays ?? 7;

        await prisma.contactSequence.update({
          where: { id: item.id },
          data: {
            currentStep: nextStep,
            nextSendAt:  isLastStep ? null : new Date(Date.now() + nextDelay! * 86400 * 1000),
            completedAt: isLastStep ? new Date() : null,
          },
        });
        await prisma.outreachContact.update({
          where: { id: item.contact.id },
          data:  { status: "CONTACTED", lastContactedAt: new Date() },
        });
        sent++;
      }
    } catch (err) {
      console.error(`[outreach] Step failed for ${item.contact.email}:`, err);
      errors++;
    }

    // Rate limit: max 2 emails/second
    await new Promise(r => setTimeout(r, 500));
  }

  return { processed: due.length, sent, errors };
}
