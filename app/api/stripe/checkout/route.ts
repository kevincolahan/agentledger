import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// Stripe price IDs — set these in your Stripe dashboard and update here
const PRICE_IDS = {
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL ?? "price_professional",
  ENTERPRISE:   process.env.STRIPE_PRICE_ENTERPRISE   ?? "price_enterprise",
} as const;

// POST /api/stripe/checkout
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan } = await req.json() as { plan: "PROFESSIONAL" | "ENTERPRISE" };
  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Get or create Stripe customer
  const member = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { org: true },
  });
  if (!member) return NextResponse.json({ error: "No organization found" }, { status: 404 });

  let customerId = member.org.stripeCustomerId;
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: session.user.email!,
      name: member.org.name,
      metadata: { orgId: member.org.id },
    });
    customerId = customer.id;
    await prisma.organization.update({
      where: { id: member.org.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${appUrl}/settings?upgraded=1`,
    cancel_url: `${appUrl}/settings`,
    metadata: { orgId: member.org.id, priceId: PRICE_IDS[plan] },
    subscription_data: {
      metadata: { orgId: member.org.id },
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
