import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SessionProvider from './session/SessionProvider.tsx'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('The application root element is missing.')

createRoot(rootElement).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
)
