import { AuthWindow } from './components/auth-window'
import { AuthUser } from './lib/auth-client'
import './index.css'

function AuthApp() {
  const handleAuthSuccess = (user: AuthUser) => {
    // The main process handles auth state changes automatically
    // No need to manually send IPC messages
  }

  return <AuthWindow onAuthSuccess={handleAuthSuccess} />
}

export default AuthApp
