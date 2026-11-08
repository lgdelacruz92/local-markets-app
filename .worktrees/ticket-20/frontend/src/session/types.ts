export interface User {
  id: string
  displayName: string
}

export interface Session {
  user: User | null
  csrfToken: string
}

export interface SessionState {
  user: User | null
  csrfToken: string | null
  isLoading: boolean
  error: string | null
}

export interface SessionContextValue extends SessionState {
  refreshSession: () => Promise<void>
  resetSession: () => void
}
