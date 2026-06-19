'use client'

import Link from 'next/link'
import { HomeSpotsSection } from '@/components/features/home/HomeSpotsSection'
import { HomeArticlesSection } from '@/components/features/home/HomeArticlesSection'
import { HomeStatsSection } from '@/components/features/home/HomeStatsSection'
import { viewportShellClass } from '@/lib/layout'
import { useLanguage } from '@/i18n/LanguageContext'

const seoFeatureLinks = [
  {
    href: '/logbook',
    titleKey: 'home.seo.logbookTitle',
    descriptionKey: 'home.seo.logbookDescription',
  },
  {
    href: '/spots',
    titleKey: 'home.seo.spotsTitle',
    descriptionKey: 'home.seo.spotsDescription',
  },
  {
    href: '/pota',
    titleKey: 'home.seo.potaTitle',
    descriptionKey: 'home.seo.potaDescription',
  },
  {
    href: '/awards',
    titleKey: 'home.seo.awardsTitle',
    descriptionKey: 'home.seo.awardsDescription',
  },
  {
    href: '/forum',
    titleKey: 'home.seo.forumTitle',
    descriptionKey: 'home.seo.forumDescription',
  },
  {
    href: '/marketplace',
    titleKey: 'home.seo.marketplaceTitle',
    descriptionKey: 'home.seo.marketplaceDescription',
  },
] as const

export function HomePageClient() {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col">
      <section className="relative bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/40 bg-gray-950 text-3xl font-black text-cyan-300 shadow-lg shadow-cyan-950/30" aria-hidden="true">
            H
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            {t('home.heroTitle')}<br />
            <span className="text-blue-400">{t('home.heroAccent')}</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            {t('home.heroDescription')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg">
              {t('auth.freeAccount')}
            </Link>
            <Link href="/callsign-search" className="border border-gray-600 text-gray-300 px-8 py-3 rounded-lg font-semibold hover:border-gray-400 hover:text-white transition-colors text-lg">
              {t('callsign.title')}
            </Link>
          </div>
        </div>
      </section>

      <HomeStatsSection />

      <section className={`${viewportShellClass} py-12`}>
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">{t('home.seo.eyebrow')}</p>
          <h2 className="mt-3 text-3xl font-bold text-white">{t('home.seo.title')}</h2>
          <p className="mt-4 text-base leading-7 text-gray-300">
            {t('home.seo.description')}
          </p>
        </div>

        <div className="mt-8 border border-cyan-900/50 bg-cyan-950/20 p-5">
          <h3 className="text-xl font-semibold text-white">{t('home.seo.insideTitle')}</h3>
          <p className="mt-2 text-sm leading-6 text-cyan-100/90">{t('home.seo.insideDescription')}</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {seoFeatureLinks.map(feature => (
            <Link
              key={feature.href}
              href={feature.href}
              className="border border-gray-800 bg-gray-900/70 p-5 transition-colors hover:border-cyan-700 hover:bg-gray-900"
            >
              <h3 className="text-lg font-semibold text-white">{t(feature.titleKey)}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">{t(feature.descriptionKey)}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className={`${viewportShellClass} grid gap-8 py-12 md:grid-cols-2`}>
        <HomeSpotsSection />
        <HomeArticlesSection />
      </div>

      <section className="bg-blue-600 py-16 px-4 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">{t('home.ctaTitle')}</h2>
        <p className="text-blue-100 mb-8 max-w-xl mx-auto">{t('home.ctaDescription')}</p>
        <Link href="/register" className="bg-white text-blue-700 px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition-colors">
          {t('auth.createNow')} &rarr;
        </Link>
      </section>
    </div>
  )
}
