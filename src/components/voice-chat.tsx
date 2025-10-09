import { Mic, MicOff, PhoneOff, Loader2, AlertCircle, X } from 'lucide-react'
import type { VoiceChatState } from '../hooks/use-voice-chat'
import { InteractiveArea } from './interactive-area'
import { Button } from './ui/button'

export interface VoiceChatProps {
  state: VoiceChatState
  onStop: () => void
  onToggleMute: () => void
  onClose?: () => void
}

export function VoiceChat({
  state,
  onStop,
  onToggleMute,
  onClose,
}: VoiceChatProps) {
  const { isConnected, isConnecting, isMuted, transcript, error, connectionState } = state

  return (
    <div className="w-full mx-auto mt-2">
      {/* Voice Chat Status */}
      <InteractiveArea className="p-4 rounded-3xl border border-overlay-border-primary bg-overlay-bg-primary">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                {isConnecting && (
                  <Loader2 className="w-6 h-6 text-overlay-accent-primary animate-spin" />
                )}
                {isConnected && !isMuted && (
                  <div className="relative">
                    <Mic className="w-6 h-6 text-overlay-accent-success" />
                    {/* Pulse animation for active mic */}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-overlay-accent-success opacity-75"></span>
                    </span>
                  </div>
                )}
                {isConnected && isMuted && (
                  <MicOff className="w-6 h-6 text-overlay-text-muted" />
                )}
                {error && (
                  <AlertCircle className="w-6 h-6 text-overlay-accent-error" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-overlay-text-primary">
                  Voice Chat
                </h3>
                <p className="text-xs text-overlay-text-secondary">
                  {isConnecting && 'Connecting...'}
                  {isConnected && !isMuted && 'Listening...'}
                  {isConnected && isMuted && 'Muted'}
                  {error && 'Connection Error'}
                  {!isConnecting && !isConnected && !error && 'Disconnected'}
                </p>
              </div>
            </div>
            {onClose && (
              <Button
                type="button"
                onClick={onClose}
                variant="gaming"
                size="icon"
                className="size-6 p-0 rounded-full"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-overlay-accent-error/10 border border-overlay-accent-error/20">
              <p className="text-xs text-overlay-accent-error">{error}</p>
            </div>
          )}

          {/* Transcript Display */}
          {transcript && (
            <div className="p-3 rounded-xl bg-overlay-bg-secondary border border-overlay-border-primary">
              <p className="text-xs text-overlay-text-muted mb-1">You said:</p>
              <p className="text-sm text-overlay-text-primary whitespace-pre-wrap">
                {transcript}
              </p>
            </div>
          )}

          {/* Connection State Info */}
          {isConnected && (
            <div className="text-xs text-overlay-text-muted text-center">
              <p>
                {isMuted
                  ? 'Click the microphone button to start speaking'
                  : 'Speak naturally - the AI is listening'}
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            {/* Mute/Unmute Button */}
            <Button
              onClick={onToggleMute}
              variant="gaming"
              size="icon"
              className="size-12 rounded-full"
              disabled={!isConnected || connectionState === 'error'}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>

            {/* Stop Button */}
            <Button
              onClick={onStop}
              variant="gaming"
              size="icon"
              className="size-12 rounded-full bg-overlay-accent-error hover:bg-overlay-accent-error/80"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <PhoneOff className="w-5 h-5" />
              )}
            </Button>
          </div>

          {/* Tips */}
          <div className="text-xs text-overlay-text-muted text-center space-y-1">
            <p>💡 Tips:</p>
            <ul className="list-none space-y-0.5">
              <li>• Ask questions about your game naturally</li>
              <li>• Wait for the AI to finish speaking before responding</li>
              <li>• Use the mute button if there's background noise</li>
            </ul>
          </div>
        </div>
      </InteractiveArea>
    </div>
  )
}

