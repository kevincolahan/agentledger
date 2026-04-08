import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string | null;
      orgSlug: string | null;
      orgName: string | null;
      orgPlan: string | null;
      role: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
  }
}
