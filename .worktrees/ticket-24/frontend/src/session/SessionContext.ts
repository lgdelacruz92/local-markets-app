import { createContext } from 'react'
import type { SessionContextValue } from './types.ts'

export const SessionContext = createContext<SessionContextValue | null>(null)
