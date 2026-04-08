import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatUsd, truncatePubkey, formatRelativeTime, solscanTxUrl } from "@/lib/utils";

export default async function AuthorizationsPage({
  params,
}: {
  params: { agentId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const member = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { org: true },
  });
  if (!member) redirect("/login");

  const agent = await prisma.agentWallet.findFirst({
    where: { id: params.agentId, orgId: member.org.id },
    include: {
      authorizationRecords: {
        orderBy: { version: "desc" },
      },
    },
  });
  if (!agent) redirect("/agents");

  const records = agent.authorizationRecords;
  const active = records.find((r) => !r.effectiveTo && !r.revokedAt);

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-white/30 mb-3">
          <Link href="/agents" className="hover:text-white/60">Agents</Link>
          <span>›</span>
          <Link href={`/agents/${agent.id}`} className="hover:text-white/60">{agent.agentName}</Link>
          <span>›</span>
          <span className="text-white/50">Authorizations</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Authorization records</h1>
            <p className="text-sm text-white/40 mt-0.5">
              {records.length} record{records.length !== 1 ? "s" : ""} for {agent.agentName}
            </p>
          </div>
          <Link
            href={`/agents/${agent.id}/authorizations/new`}
            className="text-sm bg-green-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-green-400 transition-colors"
          >
            + New version
          </Link>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="border border-dashed border-white/[0.07] rounded-xl p-16 text-center">
          <p className="text-sm text-white/30 mb-4">No authorization records yet</p>
          <Link
            href={`/agents/${agent.id}/authorizations/new`}
            className="text-xs text-green-500 hover:text-green-400"
          >
            Create first authorization →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((rec) => {
            const isActive = !rec.effectiveTo && !rec.revokedAt;
            return (
              <div
                key={rec.id}
                className={`rounded-xl border p-6 ${
                  isActive
                    ? "bg-green-500/[0.03] border-green-500/20"
                    : "bg-white/[0.02] border-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-white">
                      Version {rec.version}
                    </span>
                    {isActive ? (
                      <span className="text-[11px] bg-green-500/15 text-green-400 border border-green-500/25 px-2 py-0.5 rounded-full">
                        active
                      </span>
                    ) : rec.revokedAt ? (
                      <span className="text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                        revoked
                      </span>
                    ) : (
                      <span className="text-[11px] bg-white/5 text-white/30 border border-white/10 px-2 py-0.5 rounded-full">
                        superseded
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-white/30">
                    {formatRelativeTime(rec.createdAt)}
                  </span>
                </div>

                {/* Purpose */}
                <div className="mb-5">
                  <div className="text-[11px] text-white/30 uppercase tracking-wider font-medium mb-1.5">
                    Operational purpose
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {rec.operationalPurpose}
                  </p>
                </div>

                {/* Limits + scope grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-5 text-sm">
                  <Field label="Max per transaction" value={rec.maxTxValueUsd ? formatUsd(Number(rec.maxTxValueUsd)) : "Unlimited"} />
                  <Field label="Max daily spend"     value={rec.maxDailySpendUsd ? formatUsd(Number(rec.maxDailySpendUsd)) : "Unlimited"} />
                  <Field
                    label="Permitted types"
                    value={rec.permittedTxTypes.length ? rec.permittedTxTypes.join(", ") : "—"}
                  />
                  <Field
                    label="Whitelisted programs"
                    value={
                      rec.whitelistedPrograms.length
                        ? `${rec.whitelistedPrograms.length} program${rec.whitelistedPrograms.length > 1 ? "s" : ""}`
                        : "All programs"
                    }
                  />
                  <Field
                    label="Effective from"
                    value={new Date(rec.effectiveFrom).toLocaleString()}
                  />
                  <Field
                    label="Effective to"
                    value={
                      rec.effectiveTo
                        ? new Date(rec.effectiveTo).toLocaleString()
                        : isActive
                        ? "Present (active)"
                        : "—"
                    }
                  />
                </div>

                {/* Whitelisted programs detail */}
                {rec.whitelistedPrograms.length > 0 && (
                  <div className="mb-5">
                    <div className="text-[11px] text-white/30 uppercase tracking-wider font-medium mb-2">
                      Whitelisted programs
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {rec.whitelistedPrograms.map((p) => (
                        <a
                          key={p}
                          href={`https://solscan.io/account/${p}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono bg-white/[0.04] border border-white/[0.07] px-2 py-1 rounded hover:border-white/15 transition-colors text-white/40 hover:text-white/70"
                        >
                          {truncatePubkey(p, 8, 6)}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cryptographic proof */}
                <div className="border-t border-white/[0.06] pt-4 space-y-2">
                  <div className="text-[11px] text-white/30 uppercase tracking-wider font-medium mb-2">
                    Cryptographic proof
                  </div>
                  <Field label="Record hash" value={rec.recordHash} mono small />
                  <Field
                    label="Signature"
                    value={rec.signature.slice(0, 32) + "…"}
                    mono small
                  />

                  {rec.onChainAnchorTx ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-green-400">⚓</span>
                      <span className="text-[11px] text-white/40">On-chain anchor:</span>
                      <a
                        href={solscanTxUrl(rec.onChainAnchorTx)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-blue-400/70 hover:text-blue-400 transition-colors"
                      >
                        {truncatePubkey(rec.onChainAnchorTx, 12, 8)} ↗
                      </a>
                      {rec.anchoredAt && (
                        <span className="text-[10px] text-white/20">
                          ({formatRelativeTime(rec.anchoredAt)})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-white/20 animate-pulse">⚓ Anchoring in progress…</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] text-white/30 mb-0.5">{label}</div>
      <div
        className={`${small ? "text-[11px]" : "text-xs"} ${
          mono ? "font-mono text-white/40 break-all" : "text-white/70"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
