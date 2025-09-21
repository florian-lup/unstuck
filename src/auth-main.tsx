import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthApp from './AuthApp.tsx'

ReactDOM.createRoot(document.getElementById('auth-root')!).render(
  <React.StrictMode>
    <AuthApp />
  </React.StrictMode>,
)
