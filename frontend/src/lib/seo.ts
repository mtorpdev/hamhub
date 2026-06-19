import type { MetadataRoute } from 'next'

export const siteConfig = {
  name: 'HamHub',
  url: 'https://hamhub.dk',
  defaultTitle: 'HamHub | Amateur Radio Logbook, DX Spots, POTA and Community',
  titleTemplate: '%s | HamHub',
  description:
    'HamHub is an amateur radio platform for QSO logging, DX spots, POTA hunting, awards, QRZ, LoTW and eQSL integrations, stations, groups and forum discussions.',
  ogImage: '/opengraph-image',
  locale: 'en_US',
  alternateLocales: ['da_DK'],
  keywords: [
    'HamHub',
    'amateur radio',
    'ham radio',
    'QSO logbook',
    'DX spots',
    'POTA',
    'Parks on the Air',
    'WSJT-X',
    'FT8',
    'LoTW',
    'eQSL',
    'QRZ',
    'radio awards',
    'Maidenhead grid',
  ],
}

export const publicSitemapRoutes: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/spots', changeFrequency: 'always', priority: 0.9 },
  { path: '/pota', changeFrequency: 'always', priority: 0.9 },
  { path: '/forum', changeFrequency: 'hourly', priority: 0.8 },
  { path: '/articles', changeFrequency: 'daily', priority: 0.75 },
  { path: '/marketplace', changeFrequency: 'daily', priority: 0.75 },
  { path: '/callsign-search', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/community', changeFrequency: 'weekly', priority: 0.65 },
  { path: '/awards', changeFrequency: 'weekly', priority: 0.65 },
  { path: '/stations', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/login', changeFrequency: 'monthly', priority: 0.25 },
  { path: '/register', changeFrequency: 'monthly', priority: 0.5 },
]

export const privateRobotsPaths = [
  '/admin',
  '/dashboard',
  '/decode',
  '/logbook',
  '/messages',
  '/notifications',
  '/profile',
  '/users',
]

export function absoluteUrl(path = '/') {
  return new URL(path, siteConfig.url).toString()
}

export function safeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export const homeJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl('/icon.svg'),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: ['en', 'da'],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    url: siteConfig.url,
    description: siteConfig.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'QSO logbook with QRZ, LoTW and eQSL status',
      'Live DX spots and POTA hunting views',
      'Award progress for DXCC, WAC, WPX, grids, zones, states, IOTA, POTA and SOTA',
      'Station profiles, groups, forum and marketplace',
      'WSJT-X oriented logging and live radio workflows',
    ],
  },
]
