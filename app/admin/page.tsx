"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Tab = "pipeline" | "content" | "monitor" | "grants";

export default function AdminPage() {
  const [tab, setTab]         = useState<Tab>("pipeline");
  const [loading, setLoading] = useState(true);
  const [data, setData]       = useState<any>({});
  const [working, setWorking] = useState("");

  // Inline input state (replaces prompt())
  const [genTitle, setGenTitle]   = useState("");
  const [genType, setGenType]     = useState<"blog"|"thread"|"linkedin">("blog");
  const [showGenForm, setShowGenForm] = useState(false);

  useEffect(() => { loadTab(tab); }, [tab]);

  async function loadTab(t: Tab) {
    setLoading(true);
    try {
      if (t === "pipeline") {
        const res = await fetch("/api/admin/outreach?view=pipeline");
        setData(await res.json());
      } else if (t === "content") {
        const res = await fetch("/api/admin/content");
        setData(await res.json());
      } else if (t === "monitor") {
        const res = await fetch("/api/admin/monitor");
        setData(await res.json());
      }
    } catch { setData({}); }
    setLoading(false);
  }

  async function doAction(endpoint: string, body: any, label: string) {
    setWorking(label);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      console.log(label, d);
      loadTab(tab);
      return d;
    } catch (e: any) {
      console.error(e);
    }
    setWorking("");
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!genTitle.trim()) return;
    const actionMap = {
      blog:     { action: "generate_blog",    title: genTitle, theme: "compliance" },
      thread:   { action: "generate_thread",  topic: genTitle },
      linkedin: { action: "generate_linkedin", topic: genTitle },
    };
    await doAction("/api/admin/content", actionMap[genType], `gen_${genType}`);
    setGenTitle("");
    setShowGenForm(false);
    setWorking("");
  }

  const STATUS_COLORS: Record<string, string> = {
    COLD: "text-white/30 border-white/[0.08]",
    CONTACTED: "text-blue-400 border-blue-500/20",
    REPLIED: "text-green-400 border-green-500/20",
    CUSTOMER: "text-purple-400 border-purple-500/20",
    NOT_INTERESTED: "text-red-400 border-red-500/20",
    DRAFT: "text-white/40 border-white/[0.08]",
    REVIEW: "text-amber-400 border-amber-500/20",
    APPROVED: "text-blue-400 border-blue-500/20",
    PUBLISHED: "text-green-400 border-green-500/20",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1 text-xs text-white/30">
              <Link href="/agents" className="hover:text-white/60">← Dashboard</Link>
              <span>·</span>
              <Link href="/admin/metrics" className="hover:text-white/60">Metrics</Link>
            </div>
            <h1 className="text-xl font-semibold">Marketing</h1>
            <p className="text-sm text-white/40 mt-0.5">Outreach · Content · Monitoring</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => doAction("/api/cron/marketing", { task: "monitor" }, "monitor")}
              disabled={!!working}
              className="text-xs bg-white/[0.06] text-white/60 px-3 py-1.5 rounded-lg hover:bg-white/[0.08] border border-white/[0.06] disabled:opacity-40"
            >
              {working === "monitor" ? "Running…" : "Run monitor"}
            </button>
            <button
              onClick={() => doAction("/api/cron/marketing", { task: "outreach" }, "outreach")}
              disabled={!!working}
              className="text-xs bg-green-500 text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-green-400 disabled:opacity-40"
            >
              {working === "outreach" ? "Sending…" : "Send emails now"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-7 border-b border-white/[0.06] pb-0">
          {(["pipeline", "content", "monitor", "grants"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm transition-all border-b-2 -mb-px capitalize ${
                tab === t ? "border-green-500 text-white font-medium" : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? <div className="h-48 bg-white/[0.03] rounded-xl animate-pulse" /> : (
          <>
            {/* PIPELINE */}
            {tab === "pipeline" && (
              <div>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Total contacts", value: data.total ?? 0 },
                    { label: "Contacted",      value: data.contacted ?? 0 },
                    { label: "Replied",        value: data.replied ?? 0 },
                    { label: "Customers",      value: data.customers ?? 0 },
                  ].map((s) => (
                    <div key={s.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                      <div className="text-2xl font-semibold text-white mb-1">{s.value}</div>
                      <div className="text-xs text-white/40">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mb-5">
                  <button
                    onClick={() => doAction("/api/admin/outreach", { action: "source_federal", limit: 100 }, "source_federal")}
                    disabled={!!working}
                    className="text-xs bg-white/[0.06] text-white/60 px-4 py-2 rounded-lg hover:bg-white/[0.08] border border-white/[0.06] disabled:opacity-40"
                  >
                    {working === "source_federal" ? "Sourcing…" : "Source federal contractors (SAM.gov)"}
                  </button>
                  <button
                    onClick={() => doAction("/api/admin/outreach", { action: "source_solana" }, "source_solana")}
                    disabled={!!working}
                    className="text-xs bg-white/[0.06] text-white/60 px-4 py-2 rounded-lg hover:bg-white/[0.08] border border-white/[0.06] disabled:opacity-40"
                  >
                    {working === "source_solana" ? "Sourcing…" : "Source Solana builders"}
                  </button>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                  {(data.recent ?? []).length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-white/30">
                      No contacts yet. Source federal contractors or Solana builders above.
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          {["Contact", "Company", "Source", "Status", "Last contacted", ""].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-[11px] text-white/30 font-medium uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {(data.recent ?? []).map((c: any) => (
                          <tr key={c.id}>
                            <td className="px-4 py-3 text-sm text-white/70">{c.email}</td>
                            <td className="px-4 py-3 text-xs text-white/50">{c.company ?? "—"}</td>
                            <td className="px-4 py-3 text-[11px] text-white/30">{c.source}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] border px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? ""}`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-white/30">
                              {c.lastContactedAt ? new Date(c.lastContactedAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => doAction("/api/admin/outreach", { action: "mark_status", contactId: c.id, status: "NOT_INTERESTED" }, "mark")}
                                className="text-[10px] text-red-400/40 hover:text-red-400"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* CONTENT */}
            {tab === "content" && (
              <div>
                {/* Generate form */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 mb-5">
                  <h2 className="text-sm font-medium text-white mb-4">Generate content</h2>
                  <form onSubmit={handleGenerate} className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-white/40 mb-1.5">Topic / title</label>
                      <input
                        type="text"
                        value={genTitle}
                        onChange={(e) => setGenTitle(e.target.value)}
                        placeholder="e.g. How CMMC 2.0 applies to autonomous AI agents"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white
                          placeholder-white/20 focus:outline-none focus:border-green-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Type</label>
                      <select
                        value={genType}
                        onChange={(e) => setGenType(e.target.value as any)}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                      >
                        <option value="blog">Blog post</option>
                        <option value="thread">X thread</option>
                        <option value="linkedin">LinkedIn</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={!!working || !genTitle.trim()}
                      className="text-sm bg-green-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-green-400 disabled:opacity-40 flex-shrink-0"
                    >
                      {working?.startsWith("gen") ? "Generating…" : "Generate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => doAction("/api/cron/marketing", { task: "content" }, "weekly")}
                      disabled={!!working}
                      className="text-xs text-white/40 hover:text-white/70 px-3 py-2 border border-white/[0.08] rounded-lg flex-shrink-0"
                    >
                      Weekly run
                    </button>
                  </form>
                </div>

                {/* Content list */}
                <div className="space-y-2">
                  {(data.items ?? []).length === 0 ? (
                    <div className="text-center py-10 text-sm text-white/30">
                      No content yet. Generate something above or run the weekly content job.
                    </div>
                  ) : (
                    (data.items ?? []).map((item: any) => (
                      <div key={item.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] text-white/25 uppercase tracking-wider">
                              {item.type.replace(/_/g, " ")}
                            </span>
                            <span className={`text-[10px] border px-1.5 py-0.5 rounded-full ${STATUS_COLORS[item.status] ?? ""}`}>
                              {item.status.toLowerCase()}
                            </span>
                            {item.platform && <span className="text-[10px] text-white/20">{item.platform}</span>}
                          </div>
                          <div className="text-sm font-medium text-white/80 truncate pr-4">{item.title}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {item.publishedUrl && (
                            <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400/60 hover:text-blue-400">View ↗</a>
                          )}
                          {item.status === "DRAFT" && item.type === "BLOG_POST" && (
                            <button
                              onClick={() => doAction("/api/admin/content", { action: "publish_blog", itemId: item.id }, "pub")}
                              disabled={!!working}
                              className="text-xs bg-green-500/15 text-green-400 border border-green-500/25 px-3 py-1 rounded-lg hover:bg-green-500/20"
                            >
                              Publish
                            </button>
                          )}
                          {item.status === "REVIEW" && (
                            <button
                              onClick={() => doAction("/api/admin/content", { action: "update_status", itemId: item.id, status: "APPROVED" }, "approve")}
                              disabled={!!working}
                              className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 px-3 py-1 rounded-lg hover:bg-amber-500/20"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* MONITOR */}
            {tab === "monitor" && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-sm text-white/40">
                    High-relevance mentions (score ≥ 6) with suggested replies. Scans every 6 hours.
                  </p>
                  <button
                    onClick={() => doAction("/api/admin/monitor", { action: "run_now" }, "mon_now")}
                    disabled={!!working}
                    className="text-xs bg-white/[0.06] text-white/60 px-4 py-2 rounded-lg border border-white/[0.06] disabled:opacity-40"
                  >
                    {working === "mon_now" ? "Scanning…" : "Scan now"}
                  </button>
                </div>

                <div className="space-y-4">
                  {(data.mentions ?? []).length === 0 ? (
                    <div className="text-center py-12 text-sm text-white/30">
                      No high-value mentions yet. Run a scan to fetch results.
                    </div>
                  ) : (
                    (data.mentions ?? []).map((m: any) => (
                      <div key={m.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`text-sm font-bold ${m.score >= 8 ? "text-green-400" : "text-amber-400"}`}>
                            {m.score}/10
                          </span>
                          <span className="text-[11px] text-white/30 uppercase">{m.platform}</span>
                          <span className="text-[11px] text-white/50">@{m.author}</span>
                          <a href={m.url} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-blue-400/60 hover:text-blue-400 ml-auto">View ↗</a>
                        </div>
                        <p className="text-xs text-white/60 mb-4 leading-relaxed line-clamp-3">{m.text}</p>
                        {m.suggestedReply && (
                          <div className="bg-green-500/5 border border-green-500/15 rounded-lg p-3">
                            <div className="text-[10px] text-green-400 font-medium mb-1.5">Suggested reply</div>
                            <p className="text-xs text-white/60 leading-relaxed">{m.suggestedReply}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* GRANTS */}
            {tab === "grants" && (
              <div>
                <p className="text-sm text-white/40 mb-6">
                  One-click grant application drafts. Review in the Content tab after generation.
                </p>
                <div className="space-y-3">
                  {[
                    {
                      name: "Solana Foundation Grant",
                      org:  "Solana Foundation",
                      focus: "Solana ecosystem infrastructure — compliance tooling for the agentic economy",
                      words: 1000,
                      url:  "https://solana.org/grants",
                    },
                    {
                      name: "SBIR Phase I (DoD/AFWERX)",
                      org:  "DoD / AFWERX",
                      focus: "AI agent governance and audit trail infrastructure for defense applications",
                      words: 1500,
                      url:  "https://afwerx.com/sbir",
                    },
                    {
                      name: "Gitcoin Public Goods Round",
                      org:  "Gitcoin",
                      focus: "Open source Solana compliance tooling for the broader crypto ecosystem",
                      words: 600,
                      url:  "https://gitcoin.co",
                    },
                  ].map((g) => (
                    <div key={g.name} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white/80">{g.name}</span>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed">{g.focus}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px] text-white/25">{g.words} words</span>
                          <a href={g.url} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-blue-400/40 hover:text-blue-400">Grant page ↗</a>
                        </div>
                      </div>
                      <button
                        onClick={() => doAction(
                          "/api/admin/content",
                          { action: "generate_grant", grantName: g.name, grantOrg: g.org, maxWords: g.words, focus: g.focus },
                          "grant"
                        )}
                        disabled={!!working}
                        className="text-xs bg-green-500/15 text-green-400 border border-green-500/25 px-4 py-2 rounded-lg hover:bg-green-500/20 disabled:opacity-40 flex-shrink-0"
                      >
                        {working === "grant" ? "Drafting…" : "Draft →"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
