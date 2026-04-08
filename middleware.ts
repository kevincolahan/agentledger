import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// No auth checks in middleware — layouts handle authentication server-side.
// This avoids Edge Runtime issues with Prisma/JWT cookie reading.
export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
