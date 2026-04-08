/**
 * AgentLedger — Social Monitoring Agent
 *
 * Monitors for relevant conversations and surfaces reply opportunities.
 * Searches via:
 *   - X/Twitter API (v2)
 *   - Reddit API
 *   - Hacker News Algolia API (free, no key)
 *
 * Keywords monitored:
 *   - "AI agent compliance" / "agent authorization"
 *   - "CMMC AI agents" / "autonomous agent governance"
 *   - "Solana agent audit" / "ElizaOS compliance"
 *   - "AI agent tax" / "crypto agent 1099"
 *   - "agent spending controls" / "autonomous agent accountability"
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Mention {
  platform: string;
  id: string;
  url: string;
  author: string;
  text: string;
  timestamp: string;
  score?: number;
}

// ─── Hacker News monitoring (free, no API key) ────────────────────────────────

export async function searchHackerNews(keywords: string[]): Promise<Mention[]> {
  const mentions: Mention[] = [];

  for (const kw of keywords) {
    try {
      const res = await fetch(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(kw)}&tags=story,comment&numericFilters=created_at_i>${Math.floor(Date.now()/1000) - 86400 * 7}`
      );
      const data = await res.json();

      for (const hit of (data.hits ?? []).slice(0, 5)) {
        mentions.push({
          platform:  "hackernews",
          id:        hit.objectID,
          url:       hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
          author:    hit.author ?? "unknown",
          text:      hit.title ?? hit.comment_text ?? "",
          timestamp: hit.created_at,
          score:     hit.points ?? 0,
        });
      }
    } catch { /* continue */ }
  }

  return mentions;
}

// ─── Reddit monitoring ────────────────────────────────────────────────────────

export async function searchReddit(subreddits: string[], keywords: string[]): Promise<Mention[]> {
  const mentions: Mention[] = [];

  for (const sub of subreddits) {
    for (const kw of keywords.slice(0, 3)) {
      try {
        const res = await fetch(
          `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(kw)}&sort=new&limit=5&restrict_sr=1`,
          { headers: { "User-Agent": "AgentLedger-Monitor/1.0" } }
        );
        const data = await res.json();

        for (const post of (data?.data?.children ?? [])) {
          const p = post.data;
          if (p.created_utc > (Date.now() / 1000 - 86400 * 7)) {
            mentions.push({
              platform:  "reddit",
              id:        p.id,
              url:       `https://reddit.com${p.permalink}`,
              author:    p.author,
              text:      `${p.title} ${p.selftext ?? ""}`.slice(0, 500),
              timestamp: new Date(p.created_utc * 1000).toISOString(),
              score:     p.score,
            });
          }
        }
        await new Promise(r => setTimeout(r, 1000)); // Reddit rate limit
      } catch { /* continue */ }
    }
  }

  return mentions;
}

// ─── X/Twitter search (requires bearer token) ─────────────────────────────────

export async function searchTwitter(keywords: string[]): Promise<Mention[]> {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) return [];

  const mentions: Mention[] = [];
  const query = keywords.map(k => `"${k}"`).join(" OR ");

  try {
    const res = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query + " -is:retweet lang:en")}&max_results=20&tweet.fields=created_at,author_id,public_metrics&expansions=author_id`,
      { headers: { "Authorization": `Bearer ${token}` } }
    );
    const data = await res.json();

    const users = Object.fromEntries(
      (data.includes?.users ?? []).map((u: any) => [u.id, u.username])
    );

    for (const tweet of (data.data ?? [])) {
      mentions.push({
        platform:  "twitter",
        id:        tweet.id,
        url:       `https://twitter.com/i/web/status/${tweet.id}`,
        author:    users[tweet.author_id] ?? "unknown",
        text:      tweet.text,
        timestamp: tweet.created_at,
        score:     (tweet.public_metrics?.like_count ?? 0) + (tweet.public_metrics?.retweet_count ?? 0) * 2,
      });
    }
  } catch (err) {
    console.error("[monitor] Twitter search failed:", err);
  }

  return mentions;
}

// ─── Claude: score relevance and generate reply ───────────────────────────────

export async function scoreMentionRelevance(mention: Mention): Promise<{
  relevant: boolean;
  score: number;
  reason: string;
  suggestedReply?: string;
}> {
  const prompt = `Evaluate this social media mention for AgentLedger.

Platform: ${mention.platform}
Author: ${mention.author}
Text: "${mention.text}"

AgentLedger is a compliance layer for Solana AI agents (authorization records, audit trails, tax reports, CMMC packages).

Evaluate:
1. Is this person actually experiencing a pain point that AgentLedger solves? (not just general AI chatter)
2. Is this a good opportunity to add value with a helpful reply?
3. Score 0-10 (10 = perfect fit, directly asking about agent compliance/governance)

If relevant (score >= 6), draft a helpful reply that:
- Adds genuine value, doesn't just pitch
- Is under 100 words
- Mentions AgentLedger naturally if appropriate
- Sounds human, not like an ad

Return JSON: {"relevant": bool, "score": 0-10, "reason": "brief explanation", "suggestedReply": "reply text or null"}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { relevant: false, score: 0, reason: "parse error" };
  }
}

// ─── Full monitoring run ──────────────────────────────────────────────────────

export async function runMonitoringRound(): Promise<{
  mentionsFound: number;
  highValueMentions: number;
  saved: number;
}> {
  const keywords = [
    "AI agent compliance",
    "autonomous agent governance",
    "CMMC AI agents",
    "Solana agent audit",
    "agent authorization",
    "AI agent tax",
    "ElizaOS compliance",
    "agent spending controls",
  ];

  const subreddits = ["solana", "ethfinance", "MachineLearning", "artificial", "cybersecurity", "govtech"];

  // Gather mentions from all sources
  const [hnMentions, redditMentions, twitterMentions] = await Promise.all([
    searchHackerNews(keywords),
    searchReddit(subreddits, keywords.slice(0, 4)),
    searchTwitter(keywords.slice(0, 5)),
  ]);

  const allMentions = [...hnMentions, ...redditMentions, ...twitterMentions];

  // Score and save high-value ones
  let highValue = 0, saved = 0;

  for (const mention of allMentions) {
    // Skip if we've seen this before
    const existing = await prisma.marketingMetric.findFirst({
      where: { metric: `mention_${mention.platform}_${mention.id}` },
    });
    if (existing) continue;

    const scored = await scoreMentionRelevance(mention);

    if (scored.score >= 5) {
      highValue++;

      await prisma.marketingMetric.create({
        data: {
          metric: `mention_${mention.platform}_${mention.id}`,
          value:  scored.score,
          metadata: {
            platform:       mention.platform,
            author:         mention.author,
            url:            mention.url,
            text:           mention.text.slice(0, 300),
            reason:         scored.reason,
            suggestedReply: scored.suggestedReply,
            needsReview:    scored.score >= 7,
          },
        },
      });
      saved++;
    }

    await new Promise(r => setTimeout(r, 200));
  }

  return { mentionsFound: allMentions.length, highValueMentions: highValue, saved };
}

// ─── Drip email sequence for new signups ──────────────────────────────────────

export async function triggerOnboardingSequence(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) return;

  const sequence = await prisma.outreachSequence.findFirst({
    where: { name: "New User Onboarding", active: true },
  });
  if (!sequence) return;

  // Check if already in this sequence
  const member = await prisma.orgMember.findFirst({
    where: { userId },
    include: { org: true },
  });

  let contact = await prisma.outreachContact.findUnique({ where: { email: user.email } });
  if (!contact) {
    contact = await prisma.outreachContact.create({
      data: {
        email:     user.email,
        firstName: user.name?.split(" ")[0],
        source:    "INBOUND",
        status:    "CONTACTED",
      },
    });
  }

  // Enroll in sequence — first email in 10 minutes
  await prisma.contactSequence.upsert({
    where: { contactId_sequenceId: { contactId: contact.id, sequenceId: sequence.id } },
    update: {},
    create: {
      contactId:   contact.id,
      sequenceId:  sequence.id,
      currentStep: 0,
      nextSendAt:  new Date(Date.now() + 10 * 60 * 1000),
    },
  });
}
