import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthApp from './AuthApp.tsx'

const rootElement = document.getElementById('auth-root')
if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AuthApp />
  </React.StrictMode>
)
