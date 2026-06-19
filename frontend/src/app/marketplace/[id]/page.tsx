'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { type Listing } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { formatUtcDate } from '@/lib/utils'
import { pageShellClass } from '@/lib/layout'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'

export default function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const { t } = useLanguage()
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImg, setActiveImg] = useState(0)

  useEffect(() => {
    api.listings.getById(Number(id))
      .then(setListing)
      .catch(() => router.replace('/marketplace'))
      .finally(() => setLoading(false))
  }, [id, router])

  const handleContact = () => {
    if (!listing) return
    router.push(`/messages/new?to=${listing.userId}&subject=Ang. annonce: ${encodeURIComponent(listing.title)}`)
  }

  const handleMarkSold = async () => {
    if (!listing || !confirm(t('market.markSoldConfirm'))) return
    try {
      await api.listings.markSold(listing.id)
      toast(t('market.markedSold'))
      setListing(l => l ? { ...l, isSold: true } : l)
    } catch {
      toast(t('qso.error'), 'error')
    }
  }

  const handleDelete = async () => {
    if (!listing || !confirm(t('market.deleteConfirm'))) return
    try {
      await api.listings.delete(listing.id)
      toast(t('market.deleted'))
      router.push('/marketplace/my')
    } catch {
      toast(t('qso.error'), 'error')
    }
  }

  if (loading) return <div className={`${pageShellClass} text-gray-400`}>{t('common.loading')}</div>
  if (!listing) return null

  const isOwner = user?.id === listing.userId

  return (
    <div className={pageShellClass}>
      <Link href="/marketplace" className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300">
        {`<- ${t('market.backToMarket')}`}
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-gray-800">
            {listing.images.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API_URL}${listing.images[activeImg]?.url}`}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">{t('market.noImage')}</div>
            )}
          </div>
          {listing.images.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {listing.images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={`h-16 w-16 overflow-hidden rounded border-2 transition-colors ${i === activeImg ? 'border-blue-500' : 'border-gray-700'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${API_URL}${img.url}`} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              {listing.isSold && <Badge variant="warning">{t('market.sold')}</Badge>}
              <Badge variant="info">{listing.categoryName}</Badge>
              <Badge>{listing.conditionName}</Badge>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-white">{listing.title}</h1>
            <p className="text-3xl font-bold text-green-400">{listing.price.toLocaleString('da-DK')} {listing.currency}</p>
          </div>

          <Card>
            <CardContent className="py-4">
              <p className="mb-1 text-xs text-gray-500">{t('market.seller')}</p>
              <p className="font-mono font-bold text-white">{listing.sellerCallsign || listing.sellerEmail}</p>
              <p className="mt-1 text-xs text-gray-500">{t('market.createdAt', { date: formatUtcDate(listing.createdAt) })}</p>
            </CardContent>
          </Card>

          {isOwner ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`/marketplace/${listing.id}/edit`}><Button variant="secondary">{t('common.edit')}</Button></Link>
              {!listing.isSold && <Button variant="secondary" onClick={handleMarkSold}>{t('market.markSold')}</Button>}
              <Button variant="ghost" onClick={handleDelete} className="text-red-400 hover:text-red-300">{t('common.delete')}</Button>
            </div>
          ) : isAuthenticated ? (
            <Button onClick={handleContact}>{t('market.contactSeller')}</Button>
          ) : (
            <Link href="/login"><Button>{t('market.loginToContact')}</Button></Link>
          )}
        </div>
      </div>

      <Card className="mt-8">
        <CardContent className="py-6">
          <h2 className="mb-3 font-semibold text-white">{t('market.descriptionLabel')}</h2>
          <p className="whitespace-pre-wrap text-gray-300">{listing.description}</p>
        </CardContent>
      </Card>
    </div>
  )
}
