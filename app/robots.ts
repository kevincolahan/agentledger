import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentledger.io";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/verify"],
        disallow: ["/dashboard/", "/admin/", "/api/", "/reports/", "/onboarding/"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
