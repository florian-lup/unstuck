/**
 * Auth0 Configuration
 * These values are public and safe to commit to the repository.
 * They identify your Auth0 application but are not secrets.
 */

export interface Auth0Config {
  domain: string
  clientId: string
}

export const auth0Config: Auth0Config = {
  domain: 'dev-go8elfmr2gh3aye8.us.auth0.com', // Replace with your Auth0 domain
  clientId: 'vVv9ZUVlCqxZQemAwrOGve0HSrK5rTlO',      // Replace with your Auth0 client ID
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
}
