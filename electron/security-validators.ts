/**
 * Security Input Validators for IPC
 * Validates all input from renderer process to prevent injection attacks
 */

export class SecurityValidator {
  /**
   * Validate OAuth provider
   */
  static validateOAuthProvider(provider: unknown): 'google' | 'github' | 'discord' {
    const validProviders = ['google', 'github', 'discord'] as const
    
    if (typeof provider !== 'string') {
      throw new Error('OAuth provider must be a string')
    }
    
    if (!validProviders.includes(provider as any)) {
      throw new Error(`Invalid OAuth provider: ${provider}. Must be one of: ${validProviders.join(', ')}`)
    }
    
    return provider as 'google' | 'github' | 'discord'
  }

  /**
   * Validate URL string
   */
  static validateUrl(url: unknown): string {
    if (typeof url !== 'string') {
      throw new Error('URL must be a string')
    }
    
    if (url.length === 0) {
      throw new Error('URL cannot be empty')
    }
    
    if (url.length > 2048) {
      throw new Error('URL too long (max 2048 characters)')
    }
    
    // Only allow https:// URLs for security
    if (!url.startsWith('https://')) {
      throw new Error('URL must use https:// protocol')
    }
    
    return url
  }

  /**
   * Validate mouse event options
   */
  static validateMouseEventOptions(options: unknown): { forward?: boolean } | undefined {
    if (options === undefined || options === null) {
      return undefined
    }
    
    if (typeof options !== 'object') {
      throw new Error('Mouse event options must be an object')
    }
    
    const opts = options as Record<string, unknown>
    
    if ('forward' in opts && typeof opts.forward !== 'boolean') {
      throw new Error('Mouse event forward option must be a boolean')
    }
    
    return { forward: opts.forward as boolean | undefined }
  }

  /**
   * Validate boolean value
   */
  static validateBoolean(value: unknown, fieldName: string): boolean {
    if (typeof value !== 'boolean') {
      throw new Error(`${fieldName} must be a boolean`)
    }
    return value
  }

  /**
   * Validate string with length limits
   */
  static validateString(value: unknown, fieldName: string, maxLength = 255): string {
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`)
    }
    
    if (value.length > maxLength) {
      throw new Error(`${fieldName} too long (max ${maxLength} characters)`)
    }
    
    return value
  }

  /**
   * Sanitize user object for logging (remove sensitive fields)
   */
  static sanitizeUserForLogging(user: any): any {
    if (!user || typeof user !== 'object') {
      return user
    }
    
    const sanitized = { ...user }
    
    // Remove sensitive fields
    delete sanitized.access_token
    delete sanitized.refresh_token
    delete sanitized.session
    delete sanitized.raw_app_meta_data
    delete sanitized.raw_user_meta_data
    
    return {
      id: sanitized.id,
      email: sanitized.email,
      created_at: sanitized.created_at
    }
  }

  /**
   * Rate limiting for IPC calls
   */
  private static rateLimitMap = new Map<string, { count: number; resetTime: number }>()
  
  static checkRateLimit(channel: string, maxRequests: number, windowMs: number): void {
    const now = Date.now()
    const key = channel
    
    const record = this.rateLimitMap.get(key)
    
    if (!record || now > record.resetTime) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs
      })
      return
    }
    
    if (record.count >= maxRequests) {
      throw new Error(`Rate limit exceeded for channel: ${channel}`)
    }
    
    record.count++
  }
}
