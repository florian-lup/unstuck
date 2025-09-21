import { AuthWindow } from './components/auth-window'
import { AuthUser } from './lib/secure-auth-client'
import './index.css'

function AuthApp() {
  const handleAuthSuccess = (user: AuthUser) => {
    console.log('Authentication successful:', user)
    // The main process handles auth state changes automatically
    // No need to manually send IPC messages
  }

  return <AuthWindow onAuthSuccess={handleAuthSuccess} />
}

export default AuthApp
