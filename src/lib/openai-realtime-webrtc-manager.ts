/**
 * OpenAI Realtime WebRTC Manager
 * Manages WebRTC connection to OpenAI Realtime API for voice chat
 * 
 * WebRTC provides:
 * - Lower latency compared to WebSockets
 * - Built-in media handling and audio optimization
 * - Better error correction and packet loss handling
 * - Native browser support for audio streaming
 */

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export interface RealtimeConfig {
  model: string
  ephemeralKey: string
  onConnectionStateChange?: (state: ConnectionState) => void
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void
  onAudioResponse?: (audioData: ArrayBuffer) => void
  onError?: (error: Error) => void
}

export class OpenAIRealtimeWebRTCManager {
  private peerConnection: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private connectionState: ConnectionState = 'disconnected'
  private config: RealtimeConfig
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private remoteAudioElement: HTMLAudioElement | null = null
  private intentionalDisconnect = false

  constructor(config: RealtimeConfig) {
    this.config = config
  }

  /**
   * Connect to OpenAI Realtime API via WebRTC
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return
    }

    // Reset intentional disconnect flag when starting a new connection
    this.intentionalDisconnect = false
    this.setConnectionState('connecting')

    try {

      // Create RTCPeerConnection with STUN servers
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      })

      // Set up peer connection event handlers
      this.peerConnection.oniceconnectionstatechange = this.handleICEStateChange.bind(this)
      this.peerConnection.onconnectionstatechange = this.handleConnectionStateChange.bind(this)
      this.peerConnection.ontrack = this.handleTrack.bind(this)

      // Create data channel for sending/receiving control messages and text
      this.dataChannel = this.peerConnection.createDataChannel('oai-events', {
        ordered: true,
      })

      this.dataChannel.onopen = this.handleDataChannelOpen.bind(this)
      this.dataChannel.onmessage = this.handleDataChannelMessage.bind(this)
      this.dataChannel.onerror = this.handleDataChannelError.bind(this)
      this.dataChannel.onclose = this.handleDataChannelClose.bind(this)

      // Request microphone access and add audio track
      await this.setupAudioTrack()

      // Create and send SDP offer
      const offer = await this.peerConnection.createOffer()
      await this.peerConnection.setLocalDescription(offer)

      // Wait for ICE gathering to complete
      await this.waitForICEGathering()

      // Send offer to OpenAI and get answer
      const localDesc = this.peerConnection.localDescription
      if (!localDesc) {
        throw new Error('Failed to create local description')
      }
      const answer = await this.exchangeSDP(localDesc)

      // Set remote description with the answer from OpenAI
      await this.peerConnection.setRemoteDescription(answer)

      // Wait for data channel to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Data channel connection timeout'))
        }, 10000)

        if (this.dataChannel) {
          if (this.dataChannel.readyState === 'open') {
            clearTimeout(timeout)
            resolve()
          } else {
            this.dataChannel.addEventListener('open', () => {
              clearTimeout(timeout)
              resolve()
            })
            this.dataChannel.addEventListener('error', () => {
              clearTimeout(timeout)
              reject(new Error('Data channel connection failed'))
            })
          }
        }
      })
    } catch (error) {
      this.setConnectionState('error')
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect'
      this.config.onError?.(new Error(errorMessage))
      throw error
    }
  }

  /**
   * Set up audio track for the peer connection
   */
  private async setupAudioTrack(): Promise<void> {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
        },
      })

      // Add audio track to peer connection
      const audioTrack = this.mediaStream.getAudioTracks()[0]
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (audioTrack && this.peerConnection) {
        this.peerConnection.addTrack(audioTrack, this.mediaStream)
      }
    } catch {
      throw new Error('Microphone access denied')
    }
  }

  /**
   * Wait for ICE gathering to complete
   */
  private waitForICEGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.peerConnection) {
        resolve()
        return
      }

      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve()
        return
      }

      const checkState = () => {
        if (this.peerConnection?.iceGatheringState === 'complete') {
          this.peerConnection.removeEventListener('icegatheringstatechange', checkState)
          resolve()
        }
      }

      this.peerConnection.addEventListener('icegatheringstatechange', checkState)

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.peerConnection) {
          this.peerConnection.removeEventListener('icegatheringstatechange', checkState)
        }
        resolve()
      }, 5000)
    })
  }

  /**
   * Exchange SDP with OpenAI API
   * Uses the GA endpoint: /v1/realtime/calls
   */
  private async exchangeSDP(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    try {
      const response = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })

      if (!response.ok) {
        let errorText = await response.text()
        
        // Try to parse as JSON for better error message
        try {
          const errorJson = JSON.parse(errorText) as { error?: { message?: string } }
          if (errorJson.error?.message) {
            errorText = errorJson.error.message
          }
        } catch {
          // Not JSON, use text as-is
        }
        
        if (response.status === 400) {
          throw new Error(
            `WebRTC SDP exchange failed. Your backend may need to be updated to use the OpenAI GA API ` +
            `(/v1/realtime/client_secrets endpoint) instead of the beta API. Error: ${errorText}`
          )
        }
        
        throw new Error(`SDP exchange failed (${response.status}): ${errorText}`)
      }

      const answerSDP = await response.text()

      return {
        type: 'answer',
        sdp: answerSDP,
      }
    } catch {
      throw new Error('Failed to establish WebRTC connection with OpenAI')
    }
  }

  /**
   * Disconnect from WebRTC
   */
  disconnect(): void {
    // Mark as intentional disconnect to prevent auto-reconnect
    this.intentionalDisconnect = true

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    // Stop media stream
    this.stopAudioCapture()

    // Clean up audio playback
    if (this.remoteAudioElement) {
      this.remoteAudioElement.pause()
      this.remoteAudioElement.srcObject = null
      this.remoteAudioElement = null
    }

    if (this.audioContext) {
      void this.audioContext.close()
      this.audioContext = null
    }

    this.setConnectionState('disconnected')
  }

  /**
   * Start capturing audio from microphone
   */
  startAudioCapture(): Promise<void> {
    // Audio is already being captured via the media track
    // This method exists for API compatibility
    return Promise.resolve()
  }

  /**
   * Stop capturing audio
   */
  stopAudioCapture(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        track.stop()
      })
      this.mediaStream = null
    }
  }

  /**
   * Send a text message through the data channel
   */
  sendTextMessage(text: string): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open')
    }

    const message = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text,
          },
        ],
      },
    }

    this.dataChannel.send(JSON.stringify(message))
  }

  /**
   * Cancel the current AI response (for interruptions)
   */
  cancelResponse(): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return
    }

    this.dataChannel.send(
      JSON.stringify({
        type: 'response.cancel',
      })
    )
  }

  /**
   * Configure interruption detection
   * Note: Interruption detection is currently handled by OpenAI's server-side VAD
   */
  setInterruptionConfig(_config: {
    enabled?: boolean
    threshold?: number
  }): void {
    // Interruption is handled by OpenAI's server-side Voice Activity Detection (VAD)
    // This method exists for API compatibility but doesn't modify local state
  }

  /**
   * Handle ICE connection state change
   */
  private handleICEStateChange(): void {
    if (!this.peerConnection) return

    switch (this.peerConnection.iceConnectionState) {
      case 'failed':
      case 'disconnected':
        this.handleConnectionError(new Error('ICE connection failed'))
        break
      case 'closed':
        this.setConnectionState('disconnected')
        break
    }
  }

  /**
   * Handle peer connection state change
   */
  private handleConnectionStateChange(): void {
    if (!this.peerConnection) return

    switch (this.peerConnection.connectionState) {
      case 'connected':
        break
      case 'failed':
        this.handleConnectionError(new Error('Peer connection failed'))
        break
      case 'disconnected':
      case 'closed':
        this.setConnectionState('disconnected')
        break
    }
  }

  /**
   * Handle incoming media track (audio from OpenAI)
   */
  private handleTrack(event: RTCTrackEvent): void {
    if (event.track.kind === 'audio') {
      // Create audio element to play remote audio
      if (!this.remoteAudioElement) {
        this.remoteAudioElement = new Audio()
        this.remoteAudioElement.autoplay = true
      }

      const stream = new MediaStream([event.track])
      this.remoteAudioElement.srcObject = stream
    }
  }

  /**
   * Handle data channel open
   */
  private handleDataChannelOpen(): void {
    this.setConnectionState('connected')
    this.reconnectAttempts = 0

    // Session is already fully configured by the backend via the ephemeral token
    // No need to send session.update - backend configures:
    // - Model, voice, instructions
    // - Audio input/output formats
    // - Turn detection (server VAD)
    // - Transcription settings
    // Client can send session.update later if runtime changes are needed
  }

  /**
   * Handle data channel message
   */
  private handleDataChannelMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data as string) as {
        type: string
        transcript?: string
        delta?: string
        error?: { message?: string; type?: string }
      }

      // Handle different message types
      switch (message.type) {
        case 'session.created':
        case 'session.updated':
          break

        case 'input_audio_buffer.speech_started':
          // User started speaking
          break

        case 'input_audio_buffer.speech_stopped':
          // User stopped speaking
          break

        case 'conversation.item.input_audio_transcription.completed':
          // User's speech was transcribed
          if (message.transcript) {
            this.config.onTranscriptUpdate?.(message.transcript, true)
          }
          break

        case 'conversation.item.input_audio_transcription.delta':
          // Partial transcript of user's speech
          if (message.delta) {
            this.config.onTranscriptUpdate?.(message.delta, false)
          }
          break

        case 'response.output_audio.delta':
          // AI audio response chunk (GA API event name)
          if (message.delta) {
            const audioData = this.base64ToArrayBuffer(message.delta)
            this.config.onAudioResponse?.(audioData)
          }
          break

        case 'response.audio.done':
          // AI finished speaking
          break

        case 'response.output_audio_transcript.delta':
          // AI's speech transcript (partial) - GA API event name
          if (message.delta) {
            this.config.onTranscriptUpdate?.(message.delta, false)
          }
          break

        case 'response.output_audio_transcript.done':
          // AI's speech transcript (complete) - GA API event name
          if (message.transcript) {
            this.config.onTranscriptUpdate?.(message.transcript, true)
          }
          break

        case 'response.done':
          break

        case 'response.cancelled':
          break

        case 'error': {
          const errorMsg = message.error?.message ?? message.error?.type ?? 'Unknown error'
          this.config.onError?.(new Error(errorMsg))
          break
        }

        default:
          // Unhandled message types are ignored
          break
      }
    } catch {
      // Ignore parsing errors
    }
  }

  /**
   * Handle data channel error
   */
  private handleDataChannelError(): void {
    this.config.onError?.(new Error('Data channel error'))
  }

  /**
   * Handle data channel close
   */
  private handleDataChannelClose(): void {
    this.setConnectionState('disconnected')

    // Only attempt reconnect if disconnect was not intentional
    if (!this.intentionalDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        void this.connect().catch(() => {
          // Reconnection failed silently
        })
      }, 2000)
    }
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: Error): void {
    this.setConnectionState('error')
    this.config.onError?.(error)
  }

  /**
   * Update connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state
    this.config.onConnectionStateChange?.(state)
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      const charCode = binaryString.charCodeAt(i)
      // eslint-disable-next-line security/detect-object-injection
      bytes[i] = charCode
    }
    return bytes.buffer
  }
}

