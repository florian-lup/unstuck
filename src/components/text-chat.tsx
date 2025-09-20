import React, { useState } from 'react'
import { Input } from './ui/input'
import { InteractiveArea } from './interactive-area'
import { CornerDownLeft, X } from 'lucide-react'
import { Button } from './ui/button'

export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

interface TextChatProps {
  onClose?: () => void
  onSendMessage?: (message: string) => void
  messages?: Message[]
}

export function TextChat({ onClose, onSendMessage, messages = [] }: TextChatProps) {
  const [message, setMessage] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      onSendMessage?.(message.trim())
      setMessage('') // Clear input after sending
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose?.()
    }
  }

  return (
    <div className="w-full mx-auto mt-2">
      {/* Messages Area */}
      {messages.length > 0 && (
        <InteractiveArea className="mb-4 p-3 rounded-3xl border border-gaming-border-primary bg-gaming-bg-primary">
          <div className="max-h-120 overflow-y-auto space-y-2 gaming-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`px-3 py-2 text-sm break-words whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'max-w-[70%] text-gaming-text-primary'
                      : 'w-full text-gaming-text-secondary font-bold'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </InteractiveArea>
      )}

      {/* Input Area */}
      <InteractiveArea className="p-0 rounded-3xl border border-gaming-border-primary bg-gaming-bg-primary">
        <form onSubmit={handleSubmit} className="relative">
          <Input
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your game..."
            className="w-full pr-20" // Add right padding for buttons
            autoFocus
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button
              type="submit"
              variant="gaming"
              size="icon"
              className="size-6 p-0 rounded-full"
              disabled={!message.trim()}
            >
              <CornerDownLeft className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              onClick={onClose}
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
