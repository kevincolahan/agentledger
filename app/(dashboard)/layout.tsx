import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/agents");

  const member = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { org: true },
  });

  if (!member) redirect("/onboarding");

  const org = member.org;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-green-500 flex items-center justify-center flex-shrink-0">
              <span className="text-black font-bold text-[10px]">AL</span>
            </div>
            <span className="font-semibold text-sm text-white">AgentLedger</span>
          </div>
          <div className="mt-3 px-0">
            <div className="text-[11px] text-white/40 truncate">{org.name}</div>
            <div className="text-[10px] text-green-500/70 mt-0.5">
              {org.planTier.charAt(0) + org.planTier.slice(1).toLowerCase()} plan
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          <NavItem href="/agents" label="Agent wallets" icon="◈" />
          <NavItem href="/reports" label="Reports" icon="⊞" />
          <NavItem href="/findings" label="Findings" icon="⚑" />
          <div className="pt-3 pb-1 px-3">
            <div className="text-[10px] text-white/20 uppercase tracking-wider font-medium">Coming soon</div>
          </div>
          <NavItem href="/tax" label="Tax positions" icon="◎" />
          <NavItem href="/policy" label="Policy engine" icon="⊛" />
          <NavItem href="/settings#sdk" label="SDK config" icon="⌘" />
          <div className="pt-3">
            <div className="border-t border-white/[0.04] pt-3">
              <NavItem href="/settings" label="Settings" icon="⚙" />
              <NavItem href="/admin" label="Admin" icon="⊟" />
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/[0.06]">
          <div className="text-[11px] text-white/30 truncate">{session.user.email}</div>
          <Link
            href="/api/auth/signout"
            className="text-[11px] text-white/40 hover:text-white/70 transition-colors mt-1 block"
          >
            Sign out
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  exact,
  disabled,
}: {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-md opacity-30 cursor-not-allowed">
        <span className="text-[13px] w-4 text-center text-white/40">{icon}</span>
        <span className="text-[13px] text-white/40">{label}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-md text-white/60 hover:text-white hover:bg-white/[0.04] transition-all group"
    >
      <span className="text-[13px] w-4 text-center group-hover:text-green-400 transition-colors">{icon}</span>
      <span className="text-[13px]">{label}</span>
    </Link>
  );
}
