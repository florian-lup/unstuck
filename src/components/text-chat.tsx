import { Input } from './ui/input'
import { InteractiveArea } from './interactive-area'
import { CornerDownLeft, X, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { useTextChat } from '../hooks/use-text-chat'

export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

interface TextChatProps {
  onClose?: () => void
  onSendMessage?: (message: string) => void
  onStartNewConversation?: () => void
  messages?: Message[]
  isLoading?: boolean
}

export function TextChat({
  onClose,
  onSendMessage,
  onStartNewConversation,
  messages = [],
  isLoading = false,
}: TextChatProps) {
  const {
    // State
    message,
    messagesEndRef,
    messagesContainerRef,

    // Actions
    handleSubmit,
    handleClose,
    handleKeyDown,
    handleMessageChange,
    handleNewConversation,

    // Computed
    hasMessages,
    canSubmit,
  } = useTextChat({ 
    onClose, 
    onSendMessage, 
    onStartNewConversation,
    messages, 
    isLoading 
  })

  return (
    <div className="w-full mx-auto mt-2">
      {/* Header with New Conversation Button */}
      <div className="mb-2">
        <InteractiveArea className="p-0 rounded-3xl border border-overlay-border-primary bg-overlay-bg-primary">
          <div className="flex justify-end items-center h-9 px-3">
            <Button
              onClick={handleNewConversation}
              variant="gaming"
              size="sm"
              className="h-6 px-2 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              New Chat
            </Button>
          </div>
        </InteractiveArea>
      </div>
      
      {/* Messages Area */}
      {hasMessages && (
        <InteractiveArea className="mb-2 p-3 rounded-3xl border border-overlay-border-primary bg-overlay-bg-primary">
          <div
            ref={messagesContainerRef}
            className="max-h-120 overflow-y-auto space-y-2 overlay-scrollbar"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`px-3 py-2 text-sm break-words whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'max-w-[70%] text-overlay-text-primary'
                      : 'w-full text-overlay-text-secondary'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 text-sm text-overlay-text-secondary flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Getting response...
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </InteractiveArea>
      )}

      {/* Input Area */}
      <InteractiveArea className="p-0 rounded-3xl border border-overlay-border-primary bg-overlay-bg-primary">
        <form onSubmit={handleSubmit} className="relative">
          <Input
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "Getting response..." : "Ask about your game..."}
            className="w-full pr-20" // Add right padding for buttons
            autoFocus
            disabled={isLoading}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button
              type="submit"
              variant="gaming"
              size="icon"
              className="size-6 p-0 rounded-full"
              disabled={!canSubmit || isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CornerDownLeft className="w-3 h-3" />
              )}
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              variant="gaming"
              size="icon"
              className="size-6 p-0 rounded-full"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </form>
      </InteractiveArea>
    </div>
  )
}
