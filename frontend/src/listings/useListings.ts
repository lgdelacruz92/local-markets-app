import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchListings } from './listingsService.ts'
import type { Listing } from './types.ts'

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const activeRequest = useRef<AbortController | null>(null)

  // A stable retry function also lets the mount effect run without request loops.
  const loadListings = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setIsLoading(true)
    setError(null)

    try {
      const items = await fetchListings(controller.signal)
      if (controller.signal.aborted) return
      setListings(items)
    } catch (requestError) {
      if (controller.signal.aborted) return
      console.error('Unable to load listings:', requestError)
      setError('Unable to load listings. Check your connection and try again.')
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }, [])

  useEffect(() => {
    // Synchronize with the listings API, not derived render data.
    // eslint-disable-next-line react/set-state-in-effect
    void loadListings()
    return () => activeRequest.current?.abort()
  }, [loadListings])

  return { listings, isLoading, error, loadListings }
}
