/**
 * Environment Variable Loader - Main Process Only
 * Keeps sensitive credentials away from renderer process
 */

import { app } from 'electron'
import path from 'path'
import fs from 'fs'

interface AppConfig {
  auth0Domain: string
  auth0ClientId: string
  auth0Audience?: string
}

export function loadEnvironmentConfig(): AppConfig {
  // In development, load from .env file
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    try {
      const envPath = path.join(process.env.APP_ROOT || process.cwd(), '.env')
      const envFile = fs.readFileSync(envPath, 'utf8')
      
      const envVars: Record<string, string> = {}
      envFile.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) {
          envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '')
        }
      })
      
      return {
        auth0Domain: envVars.VITE_AUTH0_DOMAIN,
        auth0ClientId: envVars.VITE_AUTH0_CLIENT_ID,
        auth0Audience: envVars.VITE_AUTH0_AUDIENCE,
      }
    } catch (error) {
      console.error('Failed to load .env file:', error)
    }
  }

  // In production, use build-time environment variables or system env
  return {
    auth0Domain: process.env.VITE_AUTH0_DOMAIN || process.env.AUTH0_DOMAIN || '',
    auth0ClientId: process.env.VITE_AUTH0_CLIENT_ID || process.env.AUTH0_CLIENT_ID || '',
    auth0Audience: process.env.VITE_AUTH0_AUDIENCE || process.env.AUTH0_AUDIENCE,
  }
}

export function validateConfig(config: AppConfig) {
  if (!config.auth0Domain || !config.auth0ClientId) {
    throw new Error(
      'Missing Auth0 configuration. Please ensure VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID are set.'
    )
  }
  
  // Validate domain format
  if (!config.auth0Domain.includes('.auth0.com') && !config.auth0Domain.includes('.us.auth0.com')) {
    throw new Error(
      'Invalid Auth0 domain format. Domain should be like "your-tenant.auth0.com"'
    )
  }
  
  console.log('✅ Auth0 configuration loaded securely in main process')
}
