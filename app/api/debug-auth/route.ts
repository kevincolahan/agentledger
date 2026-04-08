import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// Temporary debug endpoint — remove after auth is working
export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll().map((c) => ({
    name: c.name,
    valuePreview: c.value.slice(0, 20) + "...",
  }));

  let session = null;
  let sessionError = null;
  try {
    session = await auth();
  } catch (e: any) {
    sessionError = e.message;
  }

  const dbSessions = await prisma.session.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { expires: "desc" },
    take: 5,
  });

  return NextResponse.json(
    {
      cookies: allCookies,
      session,
      sessionError,
      dbSessions: dbSessions.map((s) => ({
        id: s.id,
        tokenPreview: s.sessionToken.slice(0, 10) + "...",
        userEmail: s.user.email,
        expires: s.expires,
      })),
      env: {
        AUTH_URL: process.env.AUTH_URL ? "set" : "missing",
        AUTH_SECRET: process.env.AUTH_SECRET ? "set" : "missing",
        AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? "missing",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "set" : "missing",
      },
    },
    { status: 200 }
  );
}
