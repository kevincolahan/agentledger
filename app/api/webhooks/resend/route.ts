import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * Resend webhook handler.
 * Configure in Resend dashboard: Webhooks → Add endpoint → https://agentledger.io/api/webhooks/resend
 * Events: email.opened, email.clicked, email.bounced, email.unsubscribed
 */
export async function POST(req: NextRequest) {
  const body     = await req.text();
  const sig      = req.headers.get("svix-signature") ?? "";
  const msgId    = req.headers.get("svix-id") ?? "";
  const msgTs    = req.headers.get("svix-timestamp") ?? "";
  const secret   = process.env.RESEND_WEBHOOK_SECRET;

  // Verify webhook signature (Resend uses Svix)
  if (secret) {
    try {
      const toSign = `${msgId}.${msgTs}.${body}`;
      const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
      const expected    = crypto.createHmac("sha256", secretBytes).update(toSign).digest("base64");
      const sigs        = sig.split(" ").map((s) => s.split(",")[1]);
      const valid       = sigs.some((s) => s === expected);
      if (!valid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Signature error" }, { status: 400 });
    }
  }

  const event = JSON.parse(body) as {
    type: string;
    data: {
      email_id?: string;
      to?: string[];
      subject?: string;
      created_at?: string;
    };
  };

  const messageId = event.data.email_id;
  if (!messageId) return NextResponse.json({ ok: true });

  // Find the outreach event by message ID
  const outreachEvent = await prisma.outreachEvent.findFirst({
    where: { messageId },
  });

  if (!outreachEvent) {
    // Not an outreach email — could be a report notification etc.
    return NextResponse.json({ ok: true });
  }

  const now = new Date();

  switch (event.type) {
    case "email.opened":
      await prisma.outreachEvent.update({
        where: { id: outreachEvent.id },
        data:  { eventType: "OPENED", openedAt: now },
      });
      await prisma.outreachContact.update({
        where: { id: outreachEvent.contactId },
        data:  { status: "CONTACTED" },
      });
      await prisma.marketingMetric.create({
        data: { metric: "email_opened", value: 1, metadata: { contactId: outreachEvent.contactId } },
      });
      break;

    case "email.clicked":
      await prisma.outreachEvent.update({
        where: { id: outreachEvent.id },
        data:  { clickedAt: now },
      });
      await prisma.marketingMetric.create({
        data: { metric: "email_clicked", value: 1, metadata: { contactId: outreachEvent.contactId } },
      });
      break;

    case "email.bounced":
      await prisma.outreachEvent.update({
        where: { id: outreachEvent.id },
        data:  { eventType: "BOUNCED", bouncedAt: now },
      });
      // Pause all sequences for bounced contact
      await prisma.contactSequence.updateMany({
        where:  { contactId: outreachEvent.contactId },
        data:   { paused: true },
      });
      break;

    case "email.complained":
    case "email.unsubscribed":
      await prisma.outreachEvent.update({
        where: { id: outreachEvent.id },
        data:  { eventType: "UNSUBSCRIBED" },
      });
      await prisma.outreachContact.update({
        where: { id: outreachEvent.contactId },
        data:  { status: "UNSUBSCRIBED" },
      });
      await prisma.contactSequence.updateMany({
        where:  { contactId: outreachEvent.contactId },
        data:   { paused: true },
      });
      break;
  }

  return NextResponse.json({ ok: true });
}
