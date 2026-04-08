import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/unsubscribe?contactId=...
// Called from mailto:unsubscribe links in outreach emails
export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get("contactId");
  const email     = req.nextUrl.searchParams.get("email");

  if (contactId) {
    await prisma.outreachContact.update({
      where: { id: contactId },
      data:  { status: "UNSUBSCRIBED" },
    }).catch(() => {});
    await prisma.contactSequence.updateMany({
      where: { contactId },
      data:  { paused: true },
    }).catch(() => {});
  } else if (email) {
    const contact = await prisma.outreachContact.findUnique({ where: { email } });
    if (contact) {
      await prisma.outreachContact.update({ where: { id: contact.id }, data: { status: "UNSUBSCRIBED" } });
      await prisma.contactSequence.updateMany({ where: { contactId: contact.id }, data: { paused: true } });
    }
  }

  // Redirect to a simple confirmation page
  return NextResponse.redirect(new URL("/unsubscribed", req.url));
}
