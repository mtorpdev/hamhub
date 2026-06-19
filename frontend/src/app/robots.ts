import type { MetadataRoute } from 'next'
import { absoluteUrl, privateRobotsPaths, siteConfig } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  const sharedRules = {
    allow: '/',
    disallow: privateRobotsPaths,
  }

  return {
    rules: [
      { userAgent: '*', ...sharedRules },
      { userAgent: 'Googlebot', ...sharedRules },
      { userAgent: 'Bingbot', ...sharedRules },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteConfig.url,
  }
}
