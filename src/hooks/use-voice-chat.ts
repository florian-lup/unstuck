import { useState, useEffect, useCallback, useRef } from 'react'
import { OpenAIRealtimeManager, type ConnectionState } from '../lib/openai-realtime-manager'
import { voiceSessionService } from '../lib/voice-session-service'
import { secureAuth } from '../lib/auth-client'
import type { Game } from '../lib/games'

export interface VoiceChatState {
  isConnected: boolean
  isConnecting: boolean
  isMuted: boolean
  transcript: string
  error: string | null
  connectionState: ConnectionState
}

export interface UseVoiceChatOptions {
  selectedGame: Game | null
  onError?: (error: Error) => void
}

export function useVoiceChat({ selectedGame, onError }: UseVoiceChatOptions) {
  const [state, setState] = useState<VoiceChatState>({
    isConnected: false,
    isConnecting: false,
    isMuted: true,
    transcript: '',
    error: null,
    connectionState: 'disconnected',
  })

  const realtimeManagerRef = useRef<OpenAIRealtimeManager | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioQueueRef = useRef<ArrayBuffer[]>([])
  const isPlayingRef = useRef(false)

  /**
   * Update connection state
   */
  const updateConnectionState = useCallback((connectionState: ConnectionState) => {
    setState((prev) => ({
      ...prev,
      connectionState,
      isConnected: connectionState === 'connected',
      isConnecting: connectionState === 'connecting',
      error: connectionState === 'error' ? prev.error : null,
    }))
  }, [])

  /**
   * Update transcript
   */
  const updateTranscript = useCallback((text: string, isFinal: boolean) => {
    setState((prev) => ({
      ...prev,
      transcript: isFinal ? text : `${prev.transcript} ${text}`,
    }))
  }, [])

  /**
   * Handle audio response from OpenAI
   */
  const handleAudioResponse = useCallback((audioData: ArrayBuffer) => {
    // Add to queue
    audioQueueRef.current.push(audioData)
    
    // Start playing if not already playing
    if (!isPlayingRef.current) {
      playAudioQueue()
    }
  }, [])

  /**
   * Play audio from queue
   */
  const playAudioQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false
      return
    }

    isPlayingRef.current = true

    // Initialize audio context if needed
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      })
    }

    try {
      const audioData = audioQueueRef.current.shift()
      if (!audioData) return

      // Convert PCM16 to AudioBuffer
      const audioBuffer = await convertPCM16ToAudioBuffer(
        audioData,
        audioContextRef.current
      )

      // Create source and play
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)
      
      source.onended = () => {
        // Play next in queue
        playAudioQueue()
      }

      source.start()
    } catch (error) {
      console.error('Error playing audio:', error)
      isPlayingRef.current = false
    }
  }, [])

  /**
   * Handle errors
   */
  const handleError = useCallback(
    (error: Error) => {
      setState((prev) => ({
        ...prev,
        error: error.message,
        connectionState: 'error',
      }))
      onError?.(error)
    },
    [onError]
  )

  /**
   * Start voice chat
   */
  const startVoiceChat = useCallback(async () => {
    if (state.isConnected || state.isConnecting) {
      console.warn('Already connected or connecting')
      return
    }

    try {
      setState((prev) => ({ ...prev, isConnecting: true, error: null }))

      // Get access token
      const accessToken = await secureAuth.getValidAccessToken()
      if (!accessToken) {
        throw new Error('No authentication token available')
      }

      // Get ephemeral token from backend
      const session = await voiceSessionService.createVoiceSession(
        {
          game: selectedGame?.gameName || null,
        },
        accessToken
      )
      
      console.log('Voice session created - expires:', new Date(session.expires_at * 1000).toISOString())

      // Create WebSocket manager
      realtimeManagerRef.current = new OpenAIRealtimeManager({
        session,
        onConnectionStateChange: updateConnectionState,
        onTranscriptUpdate: updateTranscript,
        onAudioResponse: handleAudioResponse,
        onError: handleError,
      })

      // Connect to OpenAI
      await realtimeManagerRef.current.connect()

      // Start audio capture (unmute)
      await realtimeManagerRef.current.startAudioCapture()
      setState((prev) => ({ ...prev, isMuted: false }))
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to start voice chat'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isConnecting: false,
        connectionState: 'error',
      }))
      handleError(
        error instanceof Error ? error : new Error(errorMessage)
      )
    }
  }, [
    state.isConnected,
    state.isConnecting,
    selectedGame,
    updateConnectionState,
    updateTranscript,
    handleAudioResponse,
    handleError,
  ])

  /**
   * Stop voice chat
   */
  const stopVoiceChat = useCallback(() => {
    if (realtimeManagerRef.current) {
      realtimeManagerRef.current.disconnect()
      realtimeManagerRef.current = null
    }

    // Clear audio queue
    audioQueueRef.current = []
    isPlayingRef.current = false

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setState({
      isConnected: false,
      isConnecting: false,
      isMuted: true,
      transcript: '',
      error: null,
      connectionState: 'disconnected',
    })
  }, [])

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    if (!realtimeManagerRef.current) return

    if (state.isMuted) {
      // Unmute - start audio capture
      realtimeManagerRef.current
        .startAudioCapture()
        .then(() => {
          setState((prev) => ({ ...prev, isMuted: false }))
        })
        .catch((error) => {
          console.error('Failed to start audio capture:', error)
          handleError(error)
        })
    } else {
      // Mute - stop audio capture
      realtimeManagerRef.current.stopAudioCapture()
      setState((prev) => ({ ...prev, isMuted: true }))
    }
  }, [state.isMuted, handleError])

  /**
   * Send text message
   */
  const sendTextMessage = useCallback((text: string) => {
    if (!realtimeManagerRef.current || !state.isConnected) {
      throw new Error('Not connected to voice chat')
    }

    realtimeManagerRef.current.sendTextMessage(text)
  }, [state.isConnected])

  /**
   * Clear transcript
   */
  const clearTranscript = useCallback(() => {
    setState((prev) => ({ ...prev, transcript: '' }))
  }, [])

  /**
   * Configure interruption detection
   */
  const setInterruptionConfig = useCallback((config: {
    enabled?: boolean
    threshold?: number
  }) => {
    if (realtimeManagerRef.current) {
      realtimeManagerRef.current.setInterruptionConfig(config)
    }
  }, [])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (realtimeManagerRef.current) {
        realtimeManagerRef.current.disconnect()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  return {
    ...state,
    startVoiceChat,
    stopVoiceChat,
    toggleMute,
    sendTextMessage,
    clearTranscript,
    setInterruptionConfig,
  }
}

/**
 * Convert PCM16 buffer to AudioBuffer
 */
function convertPCM16ToAudioBuffer(
  pcm16Buffer: ArrayBuffer,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    try {
      // PCM16 is 16-bit signed integer
      const int16Array = new Int16Array(pcm16Buffer)
      
      // Create AudioBuffer
      const audioBuffer = audioContext.createBuffer(
        1, // mono
        int16Array.length,
        24000 // sample rate
      )

      // Convert int16 to float32 and copy to AudioBuffer
      const channelData = audioBuffer.getChannelData(0)
      for (let i = 0; i < int16Array.length; i++) {
        // Convert from int16 (-32768 to 32767) to float32 (-1.0 to 1.0)
        channelData[i] = int16Array[i] / (int16Array[i] < 0 ? 32768 : 32767)
      }

      resolve(audioBuffer)
    } catch (error) {
      reject(error)
    }
  })
}

