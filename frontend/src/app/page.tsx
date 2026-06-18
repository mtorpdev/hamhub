import Link from 'next/link'
import { HomeSpotsSection } from '@/components/features/home/HomeSpotsSection'
import { HomeArticlesSection } from '@/components/features/home/HomeArticlesSection'
import { HomeStatsSection } from '@/components/features/home/HomeStatsSection'
import { viewportShellClass } from '@/lib/layout'

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">📡</div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            Moderne Amatørradio<br />
            <span className="text-blue-400">Community</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Din platform for DX spots, QSO logbog, callsign-søgning og faglig videndeling med andre OZ-operatører.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg">
              Opret konto gratis
            </Link>
            <Link href="/callsign-search" className="border border-gray-600 text-gray-300 px-8 py-3 rounded-lg font-semibold hover:border-gray-400 hover:text-white transition-colors text-lg">
              Callsign Lookup
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <HomeStatsSection />

      <div className={`${viewportShellClass} grid gap-8 py-12 md:grid-cols-2`}>
        {/* Latest DX Spots */}
        <HomeSpotsSection />
        {/* Latest Articles */}
        <HomeArticlesSection />
      </div>

      {/* CTA */}
      <section className="bg-blue-600 py-16 px-4 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Klar til at komme i gang?</h2>
        <p className="text-blue-100 mb-8 max-w-xl mx-auto">Tilslut dig fællesskabet af danske radioamatører. Gratis at oprette konto.</p>
        <Link href="/register" className="bg-white text-blue-700 px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition-colors">
          Opret konto nu &rarr;
        </Link>
      </section>
    </div>
  )
}
