import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchListings } from './listingsService.ts'
import type { ListingsState } from './types.ts'

const INITIAL_STATE: ListingsState = { items: [], isLoading: true, error: null }

/** Refetch reports success as a boolean and exposes handled failures in error state. */
export function useListings() {
  const [state, setState] = useState<ListingsState>(INITIAL_STATE)
  const activeRequest = useRef<AbortController | null>(null)

  // Stable identity allows later filter controls to call refetch from an effect.
  const refetch = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setState({ items: [], isLoading: true, error: null })
    try {
      const items = await fetchListings(controller.signal)
      if (controller.signal.aborted) return false
      setState({ items, isLoading: false, error: null })
      return true
    } catch (error) {
      if (controller.signal.aborted) return false
      console.error('Unable to load listings:', error)
      setState({ items: [], isLoading: false, error: 'Unable to load listings. Please try again.' })
      return false
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
