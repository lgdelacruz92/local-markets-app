import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSession } from './sessionService.ts'
import type { SessionState } from './types.ts'

const SIGNED_OUT_STATE: SessionState = {
  user: null,
  csrfToken: null,
  isLoading: false,
  error: null,
}

export function useSessionState() {
  const [session, setSession] = useState<SessionState>({
    ...SIGNED_OUT_STATE,
    isLoading: true,
  })
  const activeRequest = useRef<AbortController | null>(null)

  // Stable functions let consumers refresh from effects without request loops.
  const refreshSession = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setSession({ ...SIGNED_OUT_STATE, isLoading: true })

    try {
      const result = await fetchSession(controller.signal)
      if (controller.signal.aborted) return
      setSession({ ...result, isLoading: false, error: null })
    } catch (error) {
      // Canceled requests must not overwrite a reset or a newer request.
      if (controller.signal.aborted) return
      console.error('Unable to load session:', error)
      setSession({
        ...SIGNED_OUT_STATE,
        error: 'Unable to check your sign-in status. Please try again. Browsing remains available.',
      })
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }, [])

  const resetSession = useCallback(() => {
    activeRequest.current?.abort()
    activeRequest.current = null
    setSession({ ...SIGNED_OUT_STATE })
  }, [])

  useEffect(() => {
    // This effect synchronizes with the HTTP session, not derived render data.
    // eslint-disable-next-line react/set-state-in-effect
    void refreshSession()
    return () => activeRequest.current?.abort()
  }, [refreshSession])

  return { ...session, refreshSession, resetSession }
}
