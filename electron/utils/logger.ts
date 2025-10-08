/**
 * Production-safe logging utility
 * Provides different log levels and prevents sensitive data leakage in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  /**
   * Debug level - Only logged in development
   * Use for detailed debugging information
   */
  debug(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.log('[DEBUG]', new Date().toISOString(), ...args)
    }
  }

  /**
   * Info level - Only logged in development
   * Use for general information
   */
  info(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.info('[INFO]', new Date().toISOString(), ...args)
    }
  }

  /**
   * Warning level - Always logged
   * Use for recoverable issues
   */
  warn(...args: unknown[]): void {
    console.warn('[WARN]', new Date().toISOString(), ...args)
  }

  /**
   * Error level - Always logged
   * Use for errors that need attention
   */
  error(...args: unknown[]): void {
    console.error('[ERROR]', new Date().toISOString(), ...args)
    // TODO: In production, send errors to monitoring service (Sentry, LogRocket, etc.)
    // if (!this.isDevelopment) {
    //   this.sendToMonitoring(args)
    // }
  }

  /**
   * Security-sensitive logging
   * Sanitizes data before logging
   */
  security(message: string, data?: Record<string, unknown>): void {
    const sanitizedData = data ? this.sanitizeForLogging(data) : undefined
    
    if (this.isDevelopment) {
      console.log('[SECURITY]', new Date().toISOString(), message, sanitizedData)
    } else {
      // In production, only log the message without detailed data
      console.log('[SECURITY]', new Date().toISOString(), message)
    }
  }

  /**
   * Sanitize sensitive data from log output
   */
  private sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...data }
    
    // Remove common sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'access_token',
      'refresh_token',
      'id_token',
      'secret',
      'apiKey',
      'api_key',
      'authorization',
      'cookie',
      'session',
    ]
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]'
      }
    }
    
    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeForLogging(value as Record<string, unknown>)
      }
    }
    
    return sanitized
  }

  /**
   * Future: Send errors to monitoring service
   */
  // private sendToMonitoring(args: unknown[]): void {
  //   // TODO: Implement Sentry, LogRocket, or similar
  //   // Example:
  //   // Sentry.captureException(new Error(args.join(' ')))
  // }
}

// Export singleton instance
export const logger = new Logger()

// Export type for external use
export type { LogLevel }

