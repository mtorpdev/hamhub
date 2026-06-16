'use client'

import { useEffect, useState } from 'react'

type LocalOnlyFeatureState = {
  enabled: boolean
  ready: boolean
}

export function useLocalOnlyFeatures(): LocalOnlyFeatureState {
  const [state, setState] = useState<LocalOnlyFeatureState>({ enabled: false, ready: false })

  useEffect(() => {
    const explicit = process.env.NEXT_PUBLIC_ENABLE_LOCAL_ONLY_FEATURES === 'true'
    const hostname = window.location.hostname.toLowerCase()
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
    void Promise.resolve().then(() => {
      setState({ enabled: explicit || isLocalHost, ready: true })
    })
  }, [])

  return state
}
