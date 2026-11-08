import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchListing } from './listingDetailService.ts'
import type { Listing } from './types.ts'

interface DetailState {
  id: string
  listing: Listing | null
  isLoading: boolean
  isMissing: boolean
  error: string | null
}

function loadingState(id: string): DetailState {
  return { id, listing: null, isLoading: true, isMissing: false, error: null }
}

/** Refetch handles failures in state. updateListing accepts a confirmed API result, not a mutation. */
export function useListingDetail(id: string) {
  const [state, setState] = useState<DetailState>(() => loadingState(id))
  const activeRequest = useRef<AbortController | null>(null)

  // Stable functions support future mutation controls and the request lifecycle effect.
  const refetch = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setState(loadingState(id))
    try {
      const listing = await fetchListing(id, controller.signal)
      if (controller.signal.aborted) return
      setState({ id, listing, isLoading: false, isMissing: listing === null, error: null })
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Unable to load listing:', error)
      setState({ id, listing: null, isLoading: false, isMissing: false,
        error: 'Unable to load this listing. Please try again.' })
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }, [id])

  const updateListing = useCallback((listing: Listing) => {
    if (listing.id !== id) throw new Error('Cannot update detail state for another listing.')
    activeRequest.current?.abort()
    activeRequest.current = null
    setState({ id, listing, isLoading: false, isMissing: false, error: null })
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    void refetch()
    return () => activeRequest.current?.abort()
  }, [refetch])

  const visibleState = state.id === id ? state : loadingState(id)
  return { ...visibleState, refetch, updateListing }
}
