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
import { formatUtcDate } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'

export default function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { toast } = useToast()
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
    if (!listing || !confirm('Markér som solgt?')) return
    try {
      await api.listings.markSold(listing.id)
      toast('Markeret som solgt')
      setListing(l => l ? { ...l, isSold: true } : l)
    } catch { toast('Fejl', 'error') }
  }

  const handleDelete = async () => {
    if (!listing || !confirm('Slet annonce?')) return
    try {
      await api.listings.delete(listing.id)
      toast('Annonce slettet')
      router.push('/marketplace/my')
    } catch { toast('Fejl', 'error') }
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-10 text-gray-400">Indlæser...</div>
  if (!listing) return null

  const isOwner = user?.id === listing.userId

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <Link href="/marketplace" className="text-blue-400 hover:text-blue-300 text-sm mb-6 inline-block">← Tilbage til marked</Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Images */}
        <div>
          <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden mb-3">
            {listing.images.length > 0 ? (
              <img
                src={`${API_URL}${listing.images[activeImg]?.url}`}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600 text-6xl">📻</div>
            )}
          </div>
          {listing.images.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {listing.images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImg(i)}
                  className={`w-16 h-16 rounded overflow-hidden border-2 transition-colors ${i === activeImg ? 'border-blue-500' : 'border-gray-700'}`}
                >
                  <img src={`${API_URL}${img.url}`} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {listing.isSold && <Badge variant="secondary">Solgt</Badge>}
              <Badge variant="info">{listing.categoryName}</Badge>
              <Badge>{listing.conditionName}</Badge>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{listing.title}</h1>
            <p className="text-3xl font-bold text-green-400">{listing.price.toLocaleString('da-DK')} {listing.currency}</p>
          </div>

          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-gray-500 mb-1">Sælger</p>
              <p className="text-white font-mono font-bold">{listing.sellerCallsign || listing.sellerEmail}</p>
              <p className="text-gray-500 text-xs mt-1">Oprettet {formatUtcDate(listing.createdAt)}</p>
            </CardContent>
          </Card>

          {isOwner ? (
            <div className="flex gap-2 flex-wrap">
              <Link href={`/marketplace/${listing.id}/edit`}><Button variant="secondary">Rediger</Button></Link>
              {!listing.isSold && <Button variant="secondary" onClick={handleMarkSold}>Markér som solgt</Button>}
              <Button variant="ghost" onClick={handleDelete} className="text-red-400 hover:text-red-300">Slet</Button>
            </div>
          ) : isAuthenticated ? (
            <Button onClick={handleContact}>Kontakt sælger</Button>
          ) : (
            <Link href="/login"><Button>Log ind for at kontakte sælger</Button></Link>
          )}
        </div>
      </div>

      {/* Description */}
      <Card className="mt-8">
        <CardContent className="py-6">
          <h2 className="text-white font-semibold mb-3">Beskrivelse</h2>
          <p className="text-gray-300 whitespace-pre-wrap">{listing.description}</p>
        </CardContent>
      </Card>
    </div>
  )
}
