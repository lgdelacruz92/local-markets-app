import type { ReactNode } from 'react'
import { SessionContext } from './SessionContext.ts'
import { useSessionState } from './useSessionState.ts'

interface SessionProviderProps {
  children: ReactNode
}

export default function SessionProvider({ children }: SessionProviderProps) {
  const session = useSessionState()
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
