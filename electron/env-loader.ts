/**
 * Environment Variable Loader - Main Process Only
 * Keeps sensitive credentials away from renderer process
 */

import { app } from 'electron'
import path from 'path'
import fs from 'fs'

interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
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
        supabaseUrl: envVars.VITE_SUPABASE_URL,
        supabaseAnonKey: envVars.VITE_SUPABASE_ANON_KEY,
      }
    } catch (error) {
      console.error('Failed to load .env file:', error)
    }
  }

  // In production, use build-time environment variables or system env
  return {
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  }
}

export function validateConfig(config: AppConfig) {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(
      'Missing Supabase configuration. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
    )
  }
  
  console.log('✅ Environment configuration loaded securely in main process')
}
