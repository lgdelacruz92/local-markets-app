import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchListings } from './listingsService.ts'
import type { ListingsFilters, ListingsState } from './types.ts'

const INITIAL_STATE: ListingsState = { items: [], isLoading: true, error: null }

/** Refetch resolves after a handled success/failure; inspect error for the result. */
export function useListings() {
  const [state, setState] = useState<ListingsState>(INITIAL_STATE)
  const activeRequest = useRef<AbortController | null>(null)
  const appliedFilters = useRef<ListingsFilters>({})

  // Refresh/retry reuse applied values, not drafts currently being edited.
  const refetch = useCallback(async (filters?: ListingsFilters) => {
    if (filters) appliedFilters.current = { ...filters }
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setState({ items: [], isLoading: true, error: null })
    try {
      const items = await fetchListings(controller.signal, appliedFilters.current)
      if (controller.signal.aborted) return
      setState({ items, isLoading: false, error: null })
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Unable to load listings:', error)
      setState({ items: [], isLoading: false, error: 'Unable to load listings. Please try again.' })
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }, [])

  useEffect(() => {
    // Synchronize the public list with the API and cancel stale responses on unmount.
    // eslint-disable-next-line react/set-state-in-effect
    void refetch()
    return () => activeRequest.current?.abort()
  }, [refetch])

  return { ...state, refetch }
}
