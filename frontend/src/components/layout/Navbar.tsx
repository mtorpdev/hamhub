'use client'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function Navbar() {
  const { isAuthenticated, user, logout, isAdmin } = useAuth()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">📡</span>
            <span className="text-white text-xl font-bold tracking-tight">HamHub</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/spots" className="text-gray-300 hover:text-white text-sm">DX Spots</Link>
            <Link href="/articles" className="text-gray-300 hover:text-white text-sm">Artikler</Link>
            <Link href="/marketplace" className="text-gray-300 hover:text-white text-sm">Marked</Link>
            {isAuthenticated && <>
              <Link href="/decode" className="text-gray-300 hover:text-white text-sm">Live Decodes</Link>
              <Link href="/community" className="text-gray-300 hover:text-white text-sm">Community</Link>
              <Link href="/dashboard" className="text-gray-300 hover:text-white text-sm">Dashboard</Link>
              <Link href="/logbook" className="text-gray-300 hover:text-white text-sm">Logbog</Link>
              <Link href="/messages" className="text-gray-300 hover:text-white text-sm">Beskeder</Link>
              {isAdmin && <Link href="/admin" className="text-yellow-400 hover:text-yellow-300 text-sm font-medium">Admin</Link>}
            </>}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link href="/profile" className="text-sm text-gray-300 hover:text-white">
                  {user?.callsign || user?.email}
                </Link>
                <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500 transition-colors">
                  Log ud
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-sm text-gray-300 hover:text-white px-3 py-1.5">Log ind</Link>
                <Link href="/register" className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700">Opret konto</Link>
              </div>
            )}
          </div>

          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setMenuOpen(!menuOpen)}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden py-3 border-t border-gray-800 flex flex-col gap-3">
            <Link href="/spots" className="text-gray-300 text-sm py-1">DX Spots</Link>
            <Link href="/articles" className="text-gray-300 text-sm py-1">Artikler</Link>
            <Link href="/marketplace" className="text-gray-300 text-sm py-1">Marked</Link>
            {isAuthenticated ? <>
              <Link href="/decode" className="text-gray-300 text-sm py-1">Live Decodes</Link>
              <Link href="/community" className="text-gray-300 text-sm py-1">Community</Link>
              <Link href="/dashboard" className="text-gray-300 text-sm py-1">Dashboard</Link>
              <Link href="/logbook" className="text-gray-300 text-sm py-1">Logbog</Link>
              <Link href="/messages" className="text-gray-300 text-sm py-1">Beskeder</Link>
              {isAdmin && <Link href="/admin" className="text-yellow-400 text-sm py-1">Admin</Link>}
              <button onClick={handleLogout} className="text-gray-300 text-sm py-1 text-left">Log ud</button>
            </> : <>
              <Link href="/login" className="text-gray-300 text-sm py-1">Log ind</Link>
              <Link href="/register" className="text-blue-400 text-sm py-1">Opret konto</Link>
            </>}
          </div>
        )}
      </div>
    </nav>
  )
}
