/**
 * OpenAI Realtime WebSocket Manager
 * Manages WebSocket connection to OpenAI Realtime API for voice chat
 */

import type { VoiceSessionResponse } from './voice-session-service'

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export interface RealtimeConfig {
  session: VoiceSessionResponse
  onConnectionStateChange?: (state: ConnectionState) => void
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void
  onAudioResponse?: (audioData: ArrayBuffer) => void
  onError?: (error: Error) => void
}

export class OpenAIRealtimeManager {
  private ws: WebSocket | null = null
  private connectionState: ConnectionState = 'disconnected'
  private config: RealtimeConfig
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private audioWorkletNode: AudioWorkletNode | null = null
  private workletModuleLoaded = false
  private isAiSpeaking = false
  private interruptionThreshold = 0.01 // Audio level threshold for detecting speech
  private interruptionEnabled = true

  constructor(config: RealtimeConfig) {
    this.config = config
  }

  /**
   * Connect to OpenAI Realtime API WebSocket
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      console.warn('Already connected or connecting')
      return
    }

    this.setConnectionState('connecting')

    try {
      // Create WebSocket connection using OpenAI GA (General Availability) API
      // The backend provides a websocket_url with the ephemeral client_secret embedded
      // as a query parameter - perfect for browser compatibility!
      const wsUrl = this.config.session.websocket_url
      
      console.log('Connecting to OpenAI Realtime API (GA)...')
      console.log('Model:', this.config.session.model)
      
      // Simple connection - no custom headers or subprotocols needed!
      // The websocket_url already includes the client_secret as a query parameter
      // Format: wss://api.openai.com/v1/realtime?model=...&client_secret=eph_...
      this.ws = new WebSocket(wsUrl)
      
      console.log('WebSocket created with ephemeral key authentication')

      // Set up event handlers
      this.ws.onopen = this.handleOpen.bind(this)
      this.ws.onmessage = this.handleMessage.bind(this)
      this.ws.onerror = this.handleError.bind(this)
      this.ws.onclose = this.handleClose.bind(this)

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 10000)

        if (this.ws) {
          this.ws.addEventListener('open', () => {
            clearTimeout(timeout)
            resolve()
          })
          this.ws.addEventListener('error', () => {
            clearTimeout(timeout)
            reject(new Error('Connection failed'))
          })
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
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.stopAudioCapture()
    this.setConnectionState('disconnected')
  }

  /**
   * Start capturing audio from microphone using AudioWorklet
   */
  async startAudioCapture(): Promise<void> {
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

      // Create audio context
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        sampleRate: 24000,
      })

      // Load AudioWorklet module if not already loaded
      if (!this.workletModuleLoaded) {
        try {
          // Create worklet code as a blob URL to avoid separate file
          const workletCode = `
            class AudioCaptureProcessor extends AudioWorkletProcessor {
              process(inputs, outputs, parameters) {
                const input = inputs[0]
                if (!input || !input[0]) {
                  return true
                }

                const inputChannel = input[0]
                const pcm16 = new Int16Array(inputChannel.length)
                
                // Calculate audio level (RMS) for interruption detection
                let sumSquares = 0
                for (let i = 0; i < inputChannel.length; i++) {
                  const s = Math.max(-1, Math.min(1, inputChannel[i]))
                  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
                  sumSquares += inputChannel[i] * inputChannel[i]
                }
                const rms = Math.sqrt(sumSquares / inputChannel.length)

                this.port.postMessage({
                  type: 'audiodata',
                  data: pcm16.buffer,
                  audioLevel: rms,
                }, [pcm16.buffer])

                return true
              }
            }
            registerProcessor('audio-capture-processor', AudioCaptureProcessor)
          `
          
          const blob = new Blob([workletCode], { type: 'application/javascript' })
          const workletUrl = URL.createObjectURL(blob)
          
          await this.audioContext.audioWorklet.addModule(workletUrl)
          this.workletModuleLoaded = true
          
          // Clean up blob URL
          URL.revokeObjectURL(workletUrl)
        } catch (error) {
          console.error('Failed to load AudioWorklet module:', error)
          throw new Error('Failed to initialize audio processor')
        }
      }

      // Create AudioWorklet node
      this.audioWorkletNode = new AudioWorkletNode(
        this.audioContext,
        'audio-capture-processor'
      )

      // Handle messages from the worklet
      this.audioWorkletNode.port.onmessage = (event) => {
        if (event.data.type === 'audiodata' && this.connectionState === 'connected' && this.ws) {
          const pcmData = new Int16Array(event.data.data)
          const audioLevel = event.data.audioLevel
          
          // Send audio data to OpenAI
          this.sendAudioData(pcmData)
          
          // Check for interruption: if AI is speaking and user starts talking
          if (
            this.interruptionEnabled &&
            this.isAiSpeaking &&
            audioLevel > this.interruptionThreshold
          ) {
            console.log('User interruption detected - canceling AI response')
            this.cancelResponse()
          }
        }
      }

      // Connect audio graph
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      source.connect(this.audioWorkletNode)
      this.audioWorkletNode.connect(this.audioContext.destination)

      console.log('Audio capture started (AudioWorklet)')
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to start audio capture'
      this.config.onError?.(new Error(errorMessage))
      throw error
    }
  }

  /**
   * Stop capturing audio
   */
  stopAudioCapture(): void {
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect()
      this.audioWorkletNode.port.onmessage = null
      this.audioWorkletNode = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => { track.stop(); })
      this.mediaStream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    console.log('Audio capture stopped')
  }

  /**
   * Send audio data through WebSocket
   */
  private sendAudioData(audioData: Int16Array): void {
    if (!this.ws || this.connectionState !== 'connected') return
    
    // Check if WebSocket is in the right state
    if (this.ws.readyState !== WebSocket.OPEN) return

    try {
      // Convert to base64 for transmission
      // Create a copy to ensure we have an ArrayBuffer and not SharedArrayBuffer
      const buffer = new ArrayBuffer(audioData.byteLength)
      new Uint8Array(buffer).set(new Uint8Array(audioData.buffer))
      const base64Audio = this.arrayBufferToBase64(buffer)
      
      const message = {
        type: 'input_audio_buffer.append',
        audio: base64Audio,
      }

      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('Failed to send audio data:', error)
    }
  }

  /**
   * Send a text message through the WebSocket
   */
  sendTextMessage(text: string): void {
    if (!this.ws || this.connectionState !== 'connected') {
      throw new Error('Not connected to OpenAI Realtime API')
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

    this.ws.send(JSON.stringify(message))
  }

  /**
   * Cancel the current AI response (for interruptions)
   */
  cancelResponse(): void {
    if (!this.ws || this.connectionState !== 'connected') {
      return
    }

    console.log('Canceling AI response')
    this.ws.send(
      JSON.stringify({
        type: 'response.cancel',
      })
    )
    this.isAiSpeaking = false
  }

  /**
   * Configure interruption detection
   */
  setInterruptionConfig(config: {
    enabled?: boolean
    threshold?: number
  }): void {
    if (config.enabled !== undefined) {
      this.interruptionEnabled = config.enabled
    }
    if (config.threshold !== undefined) {
      this.interruptionThreshold = config.threshold
    }
    console.log('Interruption config:', {
      enabled: this.interruptionEnabled,
      threshold: this.interruptionThreshold,
    })
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('Connected to OpenAI Realtime API')
    this.setConnectionState('connected')
    this.reconnectAttempts = 0

    // Configure session (voice and instructions are already set by backend via ephemeral token)
    if (this.ws) {
      this.ws.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
        })
      )
    }
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data as string)
      
      // Handle different message types
      switch (message.type) {
        case 'session.created':
        case 'session.updated':
          console.log('Session configured:', message)
          break

        case 'input_audio_buffer.speech_started':
          // User started speaking - voice activity detected
          break

        case 'input_audio_buffer.speech_stopped':
          // User stopped speaking - processing will begin
          break

        case 'input_audio_buffer.committed':
          // Audio buffer committed for processing
          break

        case 'conversation.item.created':
          // A new conversation item was created (user message or AI response)
          break

        case 'conversation.item.input_audio_transcription.completed':
          // User's speech was transcribed
          if (message.transcript) {
            console.log('User transcript:', message.transcript)
            this.config.onTranscriptUpdate?.(message.transcript, true)
          }
          break

        case 'conversation.item.input_audio_transcription.delta':
          // Partial transcript of user's speech
          if (message.delta) {
            this.config.onTranscriptUpdate?.(message.delta, false)
          }
          break

        case 'response.created':
          // AI response started
          break

        case 'response.output_item.added':
          // AI is adding a new output item (message, function call, etc)
          break

        case 'response.content_part.added':
          // AI is adding a new content part (audio, text, etc)
          break

        case 'response.audio.delta':
          // AI audio response chunk - AI is speaking
          this.isAiSpeaking = true
          if (message.delta) {
            const audioData = this.base64ToArrayBuffer(message.delta)
            this.config.onAudioResponse?.(audioData)
          }
          break

        case 'response.audio.done':
          // AI finished speaking
          console.log('AI audio response completed')
          this.isAiSpeaking = false
          break

        case 'response.audio_transcript.delta':
          // AI's speech transcript (partial)
          if (message.delta) {
            this.config.onTranscriptUpdate?.(message.delta, false)
          }
          break

        case 'response.audio_transcript.done':
          // AI's speech transcript (complete)
          if (message.transcript) {
            console.log('AI transcript:', message.transcript)
            this.config.onTranscriptUpdate?.(message.transcript, true)
          }
          break

        case 'response.text.delta':
          // AI text response chunk
          if (message.delta) {
            this.config.onTranscriptUpdate?.(message.delta, false)
          }
          break

        case 'response.content_part.done':
          // AI finished a content part
          break

        case 'response.output_item.done':
          // AI finished an output item
          break

        case 'response.done':
          console.log('Response completed')
          this.isAiSpeaking = false
          break

        case 'response.cancelled':
          console.log('Response was cancelled')
          this.isAiSpeaking = false
          break

        case 'rate_limits.updated':
          // Rate limit information updated (silent)
          break

        case 'error':
          console.error('OpenAI error:', message)
          console.error('Error details:', JSON.stringify(message.error, null, 2))
          this.isAiSpeaking = false
          const errorMsg = message.error?.message || message.error?.type || 'Unknown error'
          this.config.onError?.(new Error(errorMsg))
          break

        default:
          // Log other message types for debugging
          console.log('Unhandled message type:', message.type, message)
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error('WebSocket error:', event)
    this.setConnectionState('error')
    this.config.onError?.(new Error('WebSocket connection error'))
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log('WebSocket closed:', event.code, event.reason)
    this.setConnectionState('disconnected')
    this.stopAudioCapture()

    // Attempt reconnect if it wasn't a clean close
    if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      )
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error)
        })
      }, 2000)
    }
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
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }
}

