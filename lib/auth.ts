import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      from: process.env.RESEND_FROM!,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        console.log("[auth] magic link URL:", url);
        const { Resend: ResendClient } = await import("resend");
        const resend = new ResendClient(process.env.RESEND_API_KEY!);

        await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          subject: "Sign in to AgentLedger",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </head>
            <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Inter',sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                style="max-width:560px;margin:40px auto;padding:40px;background:#111;border:1px solid #222;border-radius:12px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:.1em;
                      text-transform:uppercase;color:#666;">AgentLedger</p>
                    <h1 style="margin:0 0 24px;font-size:24px;font-weight:600;color:#fff;line-height:1.3;">
                      Your sign-in link
                    </h1>
                    <p style="margin:0 0 32px;font-size:15px;color:#999;line-height:1.6;">
                      Click the button below to sign in. This link expires in 10 minutes
                      and can only be used once.
                    </p>
                    <a href="${url}"
                      style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;
                      font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Sign in to AgentLedger
                    </a>
                    <p style="margin:32px 0 0;font-size:12px;color:#555;line-height:1.6;">
                      If you didn't request this, you can safely ignore it. Your account is secure.
                    </p>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        });
      },
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login?error=auth_error",
  },
  events: {
    async createUser({ user }) {
      if (!user.email || !user.id) return;

      const slug = user.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .slice(0, 40);

      const uniqueSlug = `${slug}-${user.id.slice(-6)}`;

      const org = await prisma.organization.create({
        data: {
          name: `${user.email.split("@")[0]}'s Organization`,
          slug: uniqueSlug,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });

      console.log(`[auth] Created org ${org.id} for ${user.email}`);

      import("@/lib/marketing/monitor").then(({ triggerOnboardingSequence }) => {
        if (user.id) triggerOnboardingSequence(user.id).catch(console.error);
      }).catch(() => {});
    },
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      console.log("[auth] redirect called:", { url, baseUrl });
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/agents`;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = token.sub as string;
      const member = await prisma.orgMember.findFirst({
        where: { userId },
        include: { org: true },
        orderBy: { createdAt: "asc" },
      });

      return {
        ...session,
        user: {
          ...session.user,
          id: userId,
          orgId: member?.org.id ?? null,
          orgSlug: member?.org.slug ?? null,
          orgName: member?.org.name ?? null,
          orgPlan: member?.org.planTier ?? null,
          role: member?.role ?? null,
        },
      };
    },
  },
  debug: true,
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
