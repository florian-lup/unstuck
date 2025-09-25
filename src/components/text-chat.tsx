import { Input } from './ui/input'
import { InteractiveArea } from './interactive-area'
import { CornerDownLeft, X, RotateCcw, Loader2, BookOpen, Wrench, Scroll, ClipboardList } from 'lucide-react'
import { Button } from './ui/button'
import { Toggle } from './ui/toggle'
import { useTextChat } from '../hooks/use-text-chat'
import { MarkdownContent } from '../utils/markdown-content'

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
    activeToggle,

    // Actions
    handleSubmit,
    handleClose,
    handleKeyDown,
    handleMessageChange,
    handleNewConversation,
    handleToggleClick,

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
          <div className="flex justify-between items-center h-9 px-3">
            <div className="flex items-center gap-2">
              <Toggle 
                variant="gaming" 
                size="sm" 
                className="h-6 px-2 text-xs"
                pressed={activeToggle === 'guides'}
                onPressedChange={() => { handleToggleClick('guides') }}
              >
                <BookOpen className="w-3 h-3 mr-1" />
                Guides
              </Toggle>
              <Toggle 
                variant="gaming" 
                size="sm" 
                className="h-6 px-2 text-xs"
                pressed={activeToggle === 'builds'}
                onPressedChange={() => { handleToggleClick('builds') }}
              >
                <ClipboardList className="w-3 h-3 mr-1" />
                Builds
              </Toggle>
              <Toggle 
                variant="gaming" 
                size="sm" 
                className="h-6 px-2 text-xs"
                pressed={activeToggle === 'lore'}
                onPressedChange={() => { handleToggleClick('lore') }}
              >
                <Scroll className="w-3 h-3 mr-1" />
                Lore
              </Toggle>
              <Toggle 
                variant="gaming" 
                size="sm" 
                className="h-6 px-2 text-xs"
                pressed={activeToggle === 'help'}
                onPressedChange={() => { handleToggleClick('help') }}
              >
                <Wrench className="w-3 h-3 mr-1" />
                Help
              </Toggle>
            </div>
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
                className="flex justify-start"
              >
                <div
                  className={`px-3 py-2 text-sm break-words w-full ${
                    msg.role === 'user'
                      ? 'text-overlay-text-secondary whitespace-pre-wrap border-b border-overlay-border-primary pb-4 mb-2 mr-2'
                      : 'text-overlay-text-primary'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <MarkdownContent content={msg.content} />
                  ) : (
                    msg.content
                  )}
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
