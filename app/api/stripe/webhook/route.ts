import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

const PLAN_MAP: Record<string, "STARTER" | "PROFESSIONAL" | "ENTERPRISE"> = {
  price_starter: "STARTER",
  price_professional: "PROFESSIONAL",
  price_enterprise: "ENTERPRISE",
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[stripe] Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const priceId = session.metadata?.priceId;

      if (priceId && customerId) {
        const plan = PLAN_MAP[priceId] ?? "STARTER";
        await prisma.organization.updateMany({
          where: { stripeCustomerId: customerId },
          data: { planTier: plan },
        });
        console.log(`[stripe] Upgraded org (customer ${customerId}) to ${plan}`);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const priceId = sub.items.data[0]?.price?.id;

      if (priceId) {
        const plan = PLAN_MAP[priceId] ?? "STARTER";
        await prisma.organization.updateMany({
          where: { stripeCustomerId: customerId },
          data: { planTier: plan },
        });
        console.log(`[stripe] Updated org plan (customer ${customerId}) to ${plan}`);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      await prisma.organization.updateMany({
        where: { stripeCustomerId: customerId },
        data: { planTier: "STARTER" },
      });
      console.log(`[stripe] Downgraded org (customer ${customerId}) to STARTER`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
