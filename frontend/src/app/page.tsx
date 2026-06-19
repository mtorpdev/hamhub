import type { Metadata } from 'next'
import { HomePageClient } from './HomePageClient'
import { homeJsonLd, safeJsonLd, siteConfig } from '@/lib/seo'

export const metadata: Metadata = {
  title: siteConfig.defaultTitle,
  description: siteConfig.description,
  alternates: {
    canonical: '/',
  },
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(homeJsonLd) }}
      />
      <HomePageClient />
    </>
  )
}
