'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ListingCategoryLabels, type Listing } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { pageShellClass } from '@/lib/layout'
import { useLanguage } from '@/i18n/LanguageContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'

export default function MarketplacePage() {
  const { isAuthenticated } = useAuth()
  const { t } = useLanguage()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<number | undefined>()

  const load = (s?: string, cat?: number) => {
    setLoading(true)
    api.listings.getAll(cat, s).then(setListings).finally(() => setLoading(false))
  }

  useEffect(() => {
    api.listings.getAll()
      .then(setListings)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={pageShellClass}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('market.title')}</h1>
          <p className="text-gray-400 mt-1">{t('market.description')}</p>
        </div>
        {isAuthenticated && (
          <div className="flex gap-2">
            <Link href="/marketplace/my"><Button variant="secondary">{t('market.myListings')}</Button></Link>
            <Link href="/marketplace/new"><Button>+ {t('market.createListing')}</Button></Link>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          className="max-w-sm"
          placeholder={t('market.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(search, category)}
        />
        <select
          value={category ?? ''}
          onChange={e => {
            const val = e.target.value ? Number(e.target.value) : undefined
            setCategory(val)
            load(search, val)
          }}
          className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm"
        >
          <option value="">{t('market.allCategories')}</option>
          {Object.entries(ListingCategoryLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => load(search, category)}>{t('common.search')}</Button>
        {(search || category) && (
          <Button variant="ghost" onClick={() => { setSearch(''); setCategory(undefined); load() }}>{t('logbook.clear')}</Button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400">{t('common.loading')}</p>
      ) : listings.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <p className="text-gray-400 mb-4">{t('market.noListings')}</p>
          {isAuthenticated && <Link href="/marketplace/new"><Button>{t('market.createFirst')}</Button></Link>}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map(l => (
            <Link key={l.id} href={`/marketplace/${l.id}`} className="block group">
              <Card className="h-full hover:border-gray-600 transition-colors">
                <div className="aspect-video bg-gray-800 rounded-t-lg overflow-hidden">
                  {l.images.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_URL}${l.images[0].url}`}
                      alt={l.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-4xl">📻</div>
                  )}
                </div>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-white font-semibold line-clamp-2 group-hover:text-blue-400 transition-colors">{l.title}</h2>
                    {l.isSold && <Badge variant="warning">{t('market.sold')}</Badge>}
                  </div>
                  <p className="text-2xl font-bold text-green-400 mb-2">{l.price.toLocaleString('da-DK')} {l.currency}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="info">{l.categoryName}</Badge>
                    <Badge>{l.conditionName}</Badge>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">{l.sellerCallsign || l.sellerEmail}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
