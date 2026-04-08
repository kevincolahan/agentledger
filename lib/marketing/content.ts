/**
 * AgentLedger — Content Generation Engine
 *
 * Generates SEO-optimized content automatically:
 *   - Weekly blog posts (Hashnode API)
 *   - X/Twitter threads (drafted, human-approved before post)
 *   - LinkedIn posts (drafted, human-approved)
 *   - Monthly newsletter to signed-up users
 *   - Grant applications
 *
 * Content themes rotate through:
 *   - Solana agent economy news + AgentLedger angle
 *   - CMMC/compliance explainers (federally-focused)
 *   - Tax reporting for crypto businesses
 *   - Technical deep-dives (how anchoring works, etc.)
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";
import { Resend } from "resend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend    = new Resend(process.env.RESEND_API_KEY);

// ─── Content topics ───────────────────────────────────────────────────────────

const CONTENT_CALENDAR = [
  {
    week: 1,
    theme: "compliance",
    blog: "How CMMC 2.0 applies to autonomous AI agents: what defense contractors need to know",
    thread: "Your AI agents are transacting autonomously. Does your CMMC assessor know? Thread 🧵",
    linkedin: "The question every defense contractor's CMMC assessor will ask in 2026: how do you govern your autonomous AI agents?",
  },
  {
    week: 2,
    theme: "solana_ecosystem",
    blog: "The Solana agentic economy: 15 million transactions and zero audit trails",
    thread: "Solana Foundation just said 99% of on-chain transactions will come from AI agents. Here's the compliance gap nobody is talking about 🧵",
    linkedin: "Solana processed 15 million AI agent payments in the last 12 months. Most organizations can't prove those agents were authorized.",
  },
  {
    week: 3,
    theme: "tax",
    blog: "IRS 2026 per-wallet cost basis rules: what AI agent operators need to know",
    thread: "New IRS rule effective Jan 1, 2026: per-wallet cost basis tracking. If you're running Solana agents that stake or trade, this affects you 🧵",
    linkedin: "Starting January 1, 2026, the IRS requires per-wallet cost basis tracking. Running agent fleets that earn staking rewards or x402 API fees? Here's what changes.",
  },
  {
    week: 4,
    theme: "technical",
    blog: "How on-chain anchoring makes AI agent compliance tamper-proof",
    thread: "How we use the Solana Memo Program to make compliance records that can't be altered — even by us 🧵",
    linkedin: "Auditors trust paper trails they can verify independently. Here's how we use the Solana blockchain to make that possible for AI agent compliance.",
  },
];

// ─── Generate blog post ────────────────────────────────────────────────────────

export async function generateBlogPost(topic: {
  title: string;
  theme: string;
  targetKeywords?: string[];
}): Promise<{ title: string; content: string; slug: string; tags: string[] }> {
  const keywords = topic.targetKeywords ?? [];

  const prompt = `Write a high-quality blog post for AgentLedger's blog.

Title: ${topic.title}
Theme: ${topic.theme}
Target keywords: ${keywords.join(", ") || "AI agent compliance, Solana agents, CMMC"}

About AgentLedger:
AgentLedger is the compliance and audit layer for enterprise AI agent operators on Solana.
It produces authorization records, decision audit trails, tax reports, and PDF audit packages
for organizations deploying autonomous agents. The federal/CMMC angle is a key differentiator.
Founder is Kevin Colahan, PMP — Partner at GreyLee Services Group (SDVOSB), 
defense IT and CMMC compliance background.

Requirements:
- 800-1,200 words
- Markdown format
- Authoritative but accessible
- Include specific numbers and real examples where possible
- Include a brief conclusion with a CTA to try AgentLedger
- Not salesy — primarily educational
- Include 2-3 subheadings (H2)

Write the full blog post now:`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";
  const slug    = topic.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  const tagMap: Record<string, string[]> = {
    compliance: ["CMMC", "Compliance", "AI Agents", "NIST"],
    solana_ecosystem: ["Solana", "AI Agents", "Web3", "DeFi"],
    tax: ["Tax", "Crypto Tax", "IRS", "AI Agents"],
    technical: ["Solana", "Blockchain", "AI Agents", "Engineering"],
  };

  return {
    title:   topic.title,
    content,
    slug,
    tags: tagMap[topic.theme] ?? ["AI Agents", "Compliance"],
  };
}

// ─── Publish to Hashnode ──────────────────────────────────────────────────────

export async function publishToHashnode(post: {
  title: string;
  content: string;
  slug: string;
  tags: string[];
}): Promise<string | null> {
  const HASHNODE_KEY   = process.env.HASHNODE_API_KEY;
  const HASHNODE_PUB   = process.env.HASHNODE_PUBLICATION_ID;

  if (!HASHNODE_KEY || !HASHNODE_PUB) {
    console.warn("[content] HASHNODE_API_KEY or HASHNODE_PUBLICATION_ID not set");
    return null;
  }

  const mutation = `
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post { id url }
      }
    }
  `;

  const res = await fetch("https://gql.hashnode.com/", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": HASHNODE_KEY },
    body: JSON.stringify({
      query:     mutation,
      variables: {
        input: {
          title:          post.title,
          contentMarkdown: post.content,
          slug:           post.slug,
          tags:           post.tags.map(t => ({ name: t, slug: t.toLowerCase() })),
          publicationId:  HASHNODE_PUB,
          metaTags: {
            description: post.title,
          },
        },
      },
    }),
  });

  const data = await res.json();
  return data?.data?.publishPost?.post?.url ?? null;
}

// ─── Generate X thread (draft only — human approves) ─────────────────────────

export async function generateXThread(topic: string): Promise<string[]> {
  const prompt = `Write a Twitter/X thread about this topic for AgentLedger:

Topic: ${topic}

AgentLedger is the compliance layer for Solana AI agents. Founder has federal contracting background.
Real product, real differentiation. Not hype.

Requirements:
- 6-8 tweets
- First tweet is the hook — specific, non-generic
- Each tweet max 280 characters
- Thread should tell a coherent story
- Last tweet is a soft CTA to agentledger.io
- No hashtag spam (max 1-2 per tweet if relevant)
- Thread numbers not needed
- Sound like a thoughtful founder, not a marketer

Return ONLY a JSON array of tweet strings. No preamble.
Example: ["Tweet 1 text", "Tweet 2 text", ...]`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "[]";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as string[];
  } catch {
    return [topic];
  }
}

// ─── Generate LinkedIn post (draft only) ─────────────────────────────────────

export async function generateLinkedInPost(topic: string): Promise<string> {
  const prompt = `Write a LinkedIn post for AgentLedger on this topic:

Topic: ${topic}

AgentLedger = compliance layer for Solana AI agents.
Founder: Kevin Colahan, PMP, defense contractor background, GreyLee Services Group SDVOSB.

Requirements:
- 150-250 words
- Professional but direct
- Hook in first line (no "Excited to share" openers)
- Relevant to enterprise AI, federal contracting, or Solana ecosystem
- End with a question to drive engagement
- No hashtag walls — max 3 hashtags at the end

Write the full post now:`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

// ─── Monthly newsletter to users ──────────────────────────────────────────────

export async function sendMonthlyNewsletter(): Promise<{ sent: number }> {
  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Get all active users
  const users = await prisma.user.findMany({
    where: { emailVerified: { not: null } },
    select: { email: true, name: true },
  });

  // Generate newsletter content
  const prompt = `Write a monthly newsletter for AgentLedger users (${month}).

Include:
1. One interesting development in the Solana agent ecosystem (use general knowledge through mid-2026)
2. One compliance/regulatory development affecting AI agents
3. One new AgentLedger feature highlight (pick from: MCP server, shareable audit packages, authorization templates, anchor verification)
4. One practical tip for agent operators

Format: plain text email, conversational, 300-400 words
Sender persona: Kevin, founder

Subject line and body. Return as JSON: {"subject": "...", "body": "..."}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  let newsletter: { subject: string; body: string };
  try {
    newsletter = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { sent: 0 };
  }

  // Send in batches
  let sent = 0;
  const BATCH = 50;

  for (let i = 0; i < users.length; i += BATCH) {
    const batch = users.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (user) => {
        await resend.emails.send({
          from:    process.env.RESEND_FROM ?? "Kevin <kevin@agentledger.io>",
          to:      user.email!,
          subject: newsletter.subject,
          text:    newsletter.body,
          headers: {
            "List-Unsubscribe": `<mailto:unsubscribe@agentledger.io?subject=newsletter>`,
          },
        });
        sent++;
      })
    );
    await new Promise(r => setTimeout(r, 1000)); // 1s between batches
  }

  await prisma.marketingMetric.create({
    data: { metric: "newsletter_sent", value: sent, metadata: { month } },
  });

  return { sent };
}

// ─── Grant application drafter ────────────────────────────────────────────────

export async function draftGrantApplication(params: {
  grantName: string;
  grantOrg: string;
  maxWords: number;
  focus: string;
}): Promise<string> {
  const prompt = `Draft a grant application for AgentLedger.

Grant: ${params.grantName}
Organization: ${params.grantOrg}
Word limit: ${params.maxWords}
Focus: ${params.focus}

About AgentLedger:
- Compliance and audit layer for enterprise AI agent operators on Solana
- Produces authorization records, decision audit trails, tax reports, PDF audit packages
- On-chain anchoring via Solana Memo Program for tamper-proof records
- SDK: @agentledger/sdk (npm) for ElizaOS/SAK/GOAT/custom runtimes
- MCP server: @agentledger/mcp for Claude Code agents
- Targets: federal contractors (CMMC), enterprise AI ops teams, crypto-native businesses
- Founder: Kevin Colahan, PMP — Partner at GreyLee Services Group (SDVOSB, DoD clients)
- Built specifically for Solana's agentic economy

Key differentiators:
1. Only compliance layer purpose-built for Solana AI agents
2. On-chain tamper-proof anchoring (Memo Program)
3. Federal/CMMC formatted output
4. IRS 2026 per-wallet tax reporting
5. Integration with Solana Agent Registry (ERC-8004)

Write a compelling grant application now. Focus on:
- The market need (Solana Foundation CPO: "99% of txs will be from AI agents")
- How AgentLedger enables enterprise adoption of Solana
- Specific technical innovation
- Team credibility (GreyLee/DoD background + Solana ecosystem fit)

Return the full application text (markdown okay):`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";

  // Save to DB
  await prisma.contentItem.create({
    data: {
      type:     "GRANT_APPLICATION",
      title:    `${params.grantName} — ${params.grantOrg}`,
      body:     content,
      status:   "DRAFT",
      platform: params.grantOrg,
    },
  });

  return content;
}

// ─── Weekly content generation run ───────────────────────────────────────────

export async function runWeeklyContentGeneration(): Promise<{
  blogGenerated: boolean;
  blogUrl: string | null;
  threadDrafted: boolean;
  linkedinDrafted: boolean;
}> {
  const weekNum = Math.floor(Date.now() / (7 * 86400 * 1000)) % 4;
  const topic   = CONTENT_CALENDAR[weekNum];

  // Generate blog post
  const post = await generateBlogPost({
    title: topic.blog,
    theme: topic.theme,
  });

  // Save to DB as draft first
  const saved = await prisma.contentItem.create({
    data: {
      type:     "BLOG_POST",
      title:    post.title,
      body:     post.content,
      status:   "DRAFT",
      platform: "hashnode",
    },
  });

  // Auto-publish to Hashnode
  let blogUrl: string | null = null;
  try {
    blogUrl = await publishToHashnode(post);
    if (blogUrl) {
      await prisma.contentItem.update({
        where: { id: saved.id },
        data: { status: "PUBLISHED", publishedAt: new Date(), publishedUrl: blogUrl },
      });
    }
  } catch (err) {
    console.error("[content] Hashnode publish failed:", err);
  }

  // Generate X thread draft
  const thread = await generateXThread(topic.thread);
  await prisma.contentItem.create({
    data: {
      type:     "TWITTER_THREAD",
      title:    topic.thread,
      body:     thread.join("\n\n---\n\n"),
      status:   "REVIEW", // Needs human approval before posting
      platform: "twitter",
    },
  });

  // Generate LinkedIn draft
  const linkedin = await generateLinkedInPost(topic.linkedin);
  await prisma.contentItem.create({
    data: {
      type:     "LINKEDIN_POST",
      title:    topic.linkedin,
      body:     linkedin,
      status:   "REVIEW", // Needs human approval before posting
      platform: "linkedin",
    },
  });

  return {
    blogGenerated:   true,
    blogUrl,
    threadDrafted:   true,
    linkedinDrafted: true,
  };
}
