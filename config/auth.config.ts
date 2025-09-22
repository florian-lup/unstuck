/**
 * Auth0 Configuration
 * These values are public and safe to commit to the repository.
 * They identify your Auth0 application but are not secrets.
 */

export interface Auth0Config {
  domain: string
  clientId: string
  
  // Audience for API access tokens (optional, can be undefined)
  audience?: string
  
  // OAuth scopes to request (required)
  scope: string
  
  // Device flow polling configuration (required)
  deviceFlow: {
    pollingInterval: number      // Poll interval in seconds
    slowDownIncrement: number    // Increment when rate limited
    timeoutMinutes: number       // Timeout in minutes
  }
  
  // Token management settings (required)
  tokenManagement: {
    refreshTimeoutSeconds: number     // Network timeout for refresh
    minValidityBufferMinutes: number  // Buffer before token expiry
    fallbackStorageExpiryHours: number // Fallback storage expiry
    maxTokenValidityHours: number     // Maximum allowed token validity (security limit)
  }
  
  // Rate limiting configuration (required)
  rateLimiting: {
    maxRefreshAttempts: number    // Max refresh attempts
    refreshWindowMinutes: number  // Rate limit window in minutes
    ipcRateLimits: {
      startFlow: { requests: number; windowMs: number }        // Start flow limits
      getSession: { requests: number; windowMs: number }       // Get session limits
      signOut: { requests: number; windowMs: number }          // Sign out limits
      isSecureStorage: { requests: number; windowMs: number }  // Check secure storage limits
      cancelDeviceFlow: { requests: number; windowMs: number } // Cancel device flow limits
      openExternalUrl: { requests: number; windowMs: number }  // Open external URL limits
    }
    // Default rate limiting for other IPC operations
    defaultIpcRateLimit: { requests: number; windowMs: number }
  }
  
  // Application metadata (required)
  appInfo: {
    name: string
    version: string
    userAgent: string
  }
  
  // Security settings (required)
  security: {
    enforceHttpsRedirects: boolean
    allowInsecureConnections: boolean  // Development only
    validateDomainOnRefresh: boolean
  }
  
  // Environment-specific settings (required)
  environment: 'development' | 'staging' | 'production'
}

export const auth0Config: Auth0Config = {
  domain: 'dev-go8elfmr2gh3aye8.us.auth0.com',
  clientId: 'vVv9ZUVlCqxZQemAwrOGve0HSrK5rTlO',
  
  // Request access to user profile and enable refresh tokens
  scope: 'openid profile email offline_access',
  
  // Optional: Add if you have an API to access
  // audience: 'https://your-api.example.com',
  
  deviceFlow: {
    pollingInterval: 5,        // Poll every 5 seconds
    slowDownIncrement: 5,      // Increase by 5s when rate limited
    timeoutMinutes: 10         // Give up after 10 minutes
  },
  
  tokenManagement: {
    refreshTimeoutSeconds: 30,       // Network timeout for token refresh
    minValidityBufferMinutes: 5,     // Refresh tokens 5min before expiry
    fallbackStorageExpiryHours: 24,  // Fallback storage expires in 24h
    maxTokenValidityHours: 24        // Maximum allowed token validity (security limit)
  },
  
  rateLimiting: {
    maxRefreshAttempts: 5,      // Max 5 refresh attempts
    refreshWindowMinutes: 1,    // Within 1 minute window
    ipcRateLimits: {
      startFlow: { requests: 5, windowMs: 60000 },
      getSession: { requests: 10, windowMs: 60000 },
      signOut: { requests: 3, windowMs: 60000 },
      isSecureStorage: { requests: 10, windowMs: 60000 },
      cancelDeviceFlow: { requests: 10, windowMs: 60000 },
      openExternalUrl: { requests: 5, windowMs: 60000 }
    },
    defaultIpcRateLimit: { requests: 10, windowMs: 60000 }
  },
  
  appInfo: {
    name: 'Unstuck',
    version: '1.0.0',
    userAgent: 'Unstuck/1.0.0'
  },
  
  security: {
    enforceHttpsRedirects: true,
    allowInsecureConnections: false,  // Set to true for local development if needed
    validateDomainOnRefresh: true
  },
  
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

/**
 * Validate Auth0 configuration
 */
export function validateAuth0Config(config: Auth0Config): void {
  if (!config.domain || !config.clientId) {
    throw new Error(
      'Missing Auth0 configuration. Please set domain and clientId in config/auth.config.ts'
    )
  }
  
  // Validate domain format
  if (!config.domain.includes('.auth0.com') && !config.domain.includes('.us.auth0.com')) {
    throw new Error(
      'Invalid Auth0 domain format. Domain should be like "your-tenant.auth0.com"'
    )
  }
  
  // Validate scope format
  if (config.scope && !config.scope.includes('openid')) {
    console.warn('Auth0 scope should include "openid" for proper authentication')
  }
  
  // Validate audience format (if provided)
  if (config.audience && !config.audience.startsWith('https://')) {
    console.warn('Auth0 audience should be a valid HTTPS URL')
  }
  
  // Validate polling intervals
  if (config.deviceFlow?.pollingInterval && config.deviceFlow.pollingInterval < 1) {
    throw new Error('Device flow polling interval must be at least 1 second')
  }
  
  // Validate token management settings
  if (config.tokenManagement?.minValidityBufferMinutes && config.tokenManagement.minValidityBufferMinutes < 1) {
    throw new Error('Token validity buffer must be at least 1 minute')
  }
  
  // Validate environment-specific settings
  if (config.environment === 'production' && config.security?.allowInsecureConnections) {
    throw new Error('Insecure connections cannot be allowed in production environment')
  }
}

/**
 * Get environment-specific default configuration
 */
export function getDefaultConfigForEnvironment(env: 'development' | 'staging' | 'production'): Partial<Auth0Config> {
  const baseConfig = {
    scope: 'openid profile email offline_access',
    deviceFlow: {
      pollingInterval: 5,
      slowDownIncrement: 5,
      timeoutMinutes: 10
    },
    tokenManagement: {
      refreshTimeoutSeconds: 30,
      minValidityBufferMinutes: 5,
      fallbackStorageExpiryHours: 24,
      maxTokenValidityHours: 24
    }
  }
  
  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        security: {
          enforceHttpsRedirects: false,
          allowInsecureConnections: true,
          validateDomainOnRefresh: true
        }
      }
    
    case 'staging':
      return {
        ...baseConfig,
        security: {
          enforceHttpsRedirects: true,
          allowInsecureConnections: false,
          validateDomainOnRefresh: true
        }
      }
    
    case 'production':
      return {
        ...baseConfig,
        tokenManagement: {
          ...baseConfig.tokenManagement,
          fallbackStorageExpiryHours: 12,  // Shorter expiry in production
          maxTokenValidityHours: 12        // Stricter token validity in production
        },
        security: {
          enforceHttpsRedirects: true,
          allowInsecureConnections: false,
          validateDomainOnRefresh: true
        }
      }
    
    default:
      return baseConfig
  }
}
