/**
 * AgentLedger — Drip Email Sender
 *
 * Sends templated onboarding emails to new signups without calling Claude.
 * Used for the New User Onboarding sequence — these are transactional,
 * not outreach, so they don't need personalization.
 */

import { Resend } from "resend";
import { prisma } from "../prisma";
import { ONBOARDING_SEQUENCE } from "./sequences";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM ?? "Kevin at AgentLedger <kevin@agentledger.io>";
const APP    = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentledger.io";

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function sendOnboardingEmail(params: {
  to:           string;
  firstName:    string;
  orgId:        string;
  apiKey:       string;
  stepIndex:    number;
}): Promise<boolean> {
  const { to, firstName, orgId, apiKey, stepIndex } = params;

  const step = ONBOARDING_SEQUENCE[stepIndex];
  if (!step) return false;

  const vars = {
    firstName: firstName || "there",
    apiKey:    apiKey.slice(0, 20) + "…",
    appUrl:    APP,
    orgId,
  };

  const subject = interpolate(step.subject, vars);
  const body    = interpolate(step.body,    vars);

  try {
    const { data } = await resend.emails.send({
      from:    FROM,
      to,
      subject,
      text:    body,
      headers: {
        "List-Unsubscribe": `<${APP}/api/unsubscribe?email=${encodeURIComponent(to)}>`,
      },
    });

    console.log(`[drip] Sent step ${stepIndex} to ${to}: ${data?.id}`);
    return true;
  } catch (err) {
    console.error(`[drip] Failed to send step ${stepIndex} to ${to}:`, err);
    return false;
  }
}

/**
 * Process all due onboarding sequence steps.
 * Called by the outreach cron (same /api/cron/marketing endpoint).
 */
export async function runOnboardingDrip(): Promise<{ sent: number }> {
  const SEQUENCE_NAME = "New User Onboarding";

  const sequence = await prisma.outreachSequence.findFirst({
    where: { name: SEQUENCE_NAME, active: true },
  });
  if (!sequence) return { sent: 0 };

  const due = await prisma.contactSequence.findMany({
    where: {
      sequenceId:  sequence.id,
      paused:      false,
      completedAt: null,
      nextSendAt:  { lte: new Date() },
    },
    include: { contact: true },
    take: 100,
  });

  let sent = 0;

  for (const item of due) {
    const stepIndex = item.currentStep;
    const steps     = sequence.steps as any[];

    if (stepIndex >= ONBOARDING_SEQUENCE.length) {
      await prisma.contactSequence.update({
        where: { id: item.id },
        data:  { completedAt: new Date() },
      });
      continue;
    }

    // Get org API key for this contact
    const member = await prisma.orgMember.findFirst({
      where: { user: { email: item.contact.email } },
      include: { org: { select: { id: true, apiKey: true } } },
    });

    const ok = await sendOnboardingEmail({
      to:        item.contact.email,
      firstName: item.contact.firstName ?? "",
      orgId:     member?.org.id     ?? "",
      apiKey:    member?.org.apiKey ?? "al_live_…",
      stepIndex,
    });

    if (ok) {
      const nextStep    = stepIndex + 1;
      const isLastStep  = nextStep >= ONBOARDING_SEQUENCE.length;
      const nextDelay   = isLastStep ? null : ONBOARDING_SEQUENCE[nextStep].delayDays;

      await prisma.contactSequence.update({
        where: { id: item.id },
        data: {
          currentStep: nextStep,
          nextSendAt:  isLastStep ? null : new Date(Date.now() + (nextDelay ?? 7) * 86400 * 1000),
          completedAt: isLastStep ? new Date() : null,
        },
      });
      sent++;
    }
  }

  return { sent };
}
