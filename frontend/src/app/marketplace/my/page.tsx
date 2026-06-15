'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { type Listing } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { formatUtcDate } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'

export default function MyListingsPage() {
  useRequireAuth()
  const { toast } = useToast()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.listings.getMine().then(setListings).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleMarkSold = async (id: number) => {
    try {
      await api.listings.markSold(id)
      toast('Markeret som solgt')
      load()
    } catch { toast('Fejl', 'error') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Slet annonce?')) return
    try {
      await api.listings.delete(id)
      toast('Annonce slettet')
      load()
    } catch { toast('Fejl', 'error') }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Mine annoncer</h1>
        <Link href="/marketplace/new"><Button>+ Ny annonce</Button></Link>
      </div>

      {loading ? (
        <p className="text-gray-400">Indlæser...</p>
      ) : listings.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <p className="text-gray-400 mb-4">Du har ingen aktive annoncer.</p>
          <Link href="/marketplace/new"><Button>Opret din første annonce</Button></Link>
        </CardContent></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {listings.map(l => (
            <Card key={l.id}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-16 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                    {l.images.length > 0 ? (
                      <img src={`${API_URL}${l.images[0].url}`} alt={l.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-2xl">📻</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/marketplace/${l.id}`} className="text-white font-semibold hover:text-blue-400 truncate">{l.title}</Link>
                      {l.isSold && <Badge variant="secondary">Solgt</Badge>}
                    </div>
                    <p className="text-green-400 font-bold">{l.price.toLocaleString('da-DK')} {l.currency}</p>
                    <p className="text-gray-500 text-xs">{l.categoryName} · {l.conditionName} · {formatUtcDate(l.createdAt)}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/marketplace/${l.id}/edit`}><Button variant="secondary" size="sm">Rediger</Button></Link>
                    {!l.isSold && <Button variant="secondary" size="sm" onClick={() => handleMarkSold(l.id)}>Solgt</Button>}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(l.id)} className="text-red-400">Slet</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
