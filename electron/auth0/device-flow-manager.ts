/**
 * Device Authorization Flow Manager
 * Handles OAuth2 Device Authorization Flow polling and timeout logic
 */
import { Auth0Config } from '../../config/auth.config'
import { Auth0Tokens } from './token-manager'

export interface DeviceAuthorizationResult {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
}

export type DeviceFlowEvent = 'SUCCESS' | 'ERROR'

export class DeviceFlowManager {
  private config: Auth0Config
  private domain: string
  private clientId: string
  private audience?: string
  private scope: string
  private currentPollInterval: NodeJS.Timeout | null = null
  private currentPollTimeout: NodeJS.Timeout | null = null
  private eventCallback:
    | ((event: DeviceFlowEvent, data?: Auth0Tokens, error?: string) => void)
    | null = null

  constructor(
    config: Auth0Config,
    domain: string,
    clientId: string,
    audience?: string,
    scope?: string
  ) {
    this.config = config
    this.domain = domain
    this.clientId = clientId
    this.audience = audience
    this.scope = scope ?? 'openid profile email offline_access'
  }

  private get POLLING_INTERVAL() {
    return this.config.deviceFlow.pollingInterval
  }
  private get SLOW_DOWN_INCREMENT() {
    return this.config.deviceFlow.slowDownIncrement
  }
  private get TIMEOUT_MINUTES() {
    return this.config.deviceFlow.timeoutMinutes
  }

  /**
   * Set callback for device flow events
   */
  setEventCallback(
    callback: (
      event: DeviceFlowEvent,
      data?: Auth0Tokens,
      error?: string
    ) => void
  ): void {
    this.eventCallback = callback
  }

  /**
   * Start Device Authorization Flow
   */
  async startDeviceAuthFlow(): Promise<DeviceAuthorizationResult> {
    const deviceCodeEndpoint = `${this.domain}/oauth/device/code`

    const body = new URLSearchParams({
      client_id: this.clientId,
      scope: this.scope,
    })

    if (this.audience) {
      body.append('audience', this.audience)
    }

    const response = await fetch(deviceCodeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string
        error_description?: string
      }
      console.error('Auth0 API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData.error,
        error_description: errorData.error_description,
      })
      throw new Error(
        `Device authorization request failed: ${errorData.error_description ?? errorData.error ?? response.statusText}`
      )
    }

    const deviceData = (await response.json()) as {
      device_code: string
      user_code: string
      verification_uri: string
      expires_in?: number
      interval?: number
    }

    // Start polling for completion with configurable interval
    const pollingInterval = deviceData.interval ?? this.POLLING_INTERVAL
    this.pollForDeviceAuthorization(deviceData.device_code, pollingInterval)

    return {
      device_code: deviceData.device_code,
      user_code: deviceData.user_code,
      verification_uri: deviceData.verification_uri,
      expires_in: deviceData.expires_in ?? 600,
    }
  }

  /**
   * Cancel current device authorization flow
   */
  cancelDeviceAuthorization(): void {
    if (this.currentPollInterval) {
      clearInterval(this.currentPollInterval)
      this.currentPollInterval = null
    }
    if (this.currentPollTimeout) {
      clearTimeout(this.currentPollTimeout)
      this.currentPollTimeout = null
    }
  }

  /**
   * Poll for device authorization completion
   */
  private pollForDeviceAuthorization(
    deviceCode: string,
    interval: number
  ): void {
    const tokenEndpoint = `${this.domain}/oauth/token`

    // Cancel any existing polling first
    this.cancelDeviceAuthorization()

    this.currentPollInterval = setInterval(() => {
      void (async () => {
        try {
          const body = new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: deviceCode,
            client_id: this.clientId,
          })

          const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          })

          const data = (await response.json()) as {
            access_token?: string
            refresh_token?: string
            id_token?: string
            expires_in?: number
            token_type?: string
            scope?: string
            error?: string
            error_description?: string
          }

          if (response.ok) {
            // Success! We got tokens
            this.cancelDeviceAuthorization()

            // Validate required fields are present in successful response
            if (!data.access_token) {
              throw new Error(
                'Missing access_token in successful token response'
              )
            }

            const tokens: Auth0Tokens = {
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              id_token: data.id_token,
              expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
              token_type: data.token_type ?? 'Bearer',
              scope: data.scope,
            }

            this.eventCallback?.('SUCCESS', tokens)
          } else if (data.error === 'authorization_pending') {
            // Still waiting for user to authorize
          } else if (data.error === 'slow_down') {
            // Increase polling interval by configured amount
            this.cancelDeviceAuthorization()
            const newInterval = interval + this.SLOW_DOWN_INCREMENT
            setTimeout(() => {
              this.pollForDeviceAuthorization(deviceCode, newInterval)
            }, newInterval * 1000)
          } else if (data.error === 'expired_token') {
            // Device code expired
            this.cancelDeviceAuthorization()
            this.eventCallback?.(
              'ERROR',
              undefined,
              'Device code expired. Please try again.'
            )
          } else if (data.error === 'access_denied') {
            // User denied access
            this.cancelDeviceAuthorization()
            this.eventCallback?.('ERROR', undefined, 'Access denied by user.')
          } else {
            // Other error
            this.cancelDeviceAuthorization()
            this.eventCallback?.(
              'ERROR',
              undefined,
              data.error_description ?? 'Authorization failed'
            )
          }
        } catch (error) {
          console.error('Polling error:', error)
          // Continue polling on network errors
        }
      })()
    }, interval * 1000)

    // Stop polling after configured timeout
    this.currentPollTimeout = setTimeout(
      () => {
        this.cancelDeviceAuthorization()
        this.eventCallback?.(
          'ERROR',
          undefined,
          'Authorization timeout. Please try again.'
        )
      },
      this.TIMEOUT_MINUTES * 60 * 1000
    )
  }
}
