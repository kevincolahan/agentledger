import { NextRequest, NextResponse } from "next/server";
import { auth }                     from "@/lib/auth";
import { prisma }                   from "@/lib/prisma";
import { generateBlogPost, generateXThread, generateLinkedInPost, draftGrantApplication, publishToHashnode } from "@/lib/marketing/content";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim());

async function requireAdmin(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return null;
  if (!ADMIN_EMAILS.includes(session.user.email)) return null;
  return session.user;
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type   = searchParams.get("type");

  const items = await prisma.contentItem.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(type   ? { type:   type as any   } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, ...params } = await req.json() as { action: string; [k: string]: any };

  if (action === "generate_blog") {
    const post = await generateBlogPost({
      title:           params.title,
      theme:           params.theme ?? "compliance",
      targetKeywords:  params.keywords,
    });
    const saved = await prisma.contentItem.create({
      data: {
        type:     "BLOG_POST",
        title:    post.title,
        body:     post.content,
        status:   "DRAFT",
        platform: "hashnode",
      },
    });
    return NextResponse.json({ item: saved });
  }

  if (action === "generate_thread") {
    const tweets = await generateXThread(params.topic);
    const saved = await prisma.contentItem.create({
      data: {
        type:     "TWITTER_THREAD",
        title:    params.topic,
        body:     tweets.join("\n\n---\n\n"),
        status:   "REVIEW",
        platform: "twitter",
      },
    });
    return NextResponse.json({ item: saved, tweets });
  }

  if (action === "generate_linkedin") {
    const post = await generateLinkedInPost(params.topic);
    const saved = await prisma.contentItem.create({
      data: {
        type:     "LINKEDIN_POST",
        title:    params.topic,
        body:     post,
        status:   "REVIEW",
        platform: "linkedin",
      },
    });
    return NextResponse.json({ item: saved });
  }

  if (action === "generate_grant") {
    const content = await draftGrantApplication({
      grantName:  params.grantName,
      grantOrg:   params.grantOrg,
      maxWords:   params.maxWords ?? 1000,
      focus:      params.focus    ?? "Solana ecosystem infrastructure",
    });
    return NextResponse.json({ content });
  }

  if (action === "publish_blog") {
    const item = await prisma.contentItem.findUnique({ where: { id: params.itemId } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const slug = item.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").slice(0, 80);
    const url  = await publishToHashnode({ title: item.title, content: item.body, slug, tags: ["AI Agents"] });

    if (url) {
      await prisma.contentItem.update({
        where: { id: params.itemId },
        data:  { status: "PUBLISHED", publishedAt: new Date(), publishedUrl: url },
      });
    }
    return NextResponse.json({ url });
  }

  if (action === "update_status") {
    const updated = await prisma.contentItem.update({
      where: { id: params.itemId },
      data:  { status: params.status },
    });
    return NextResponse.json({ item: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
