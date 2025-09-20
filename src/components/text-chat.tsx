import React, { useState } from 'react'
import { Input } from './ui/input'
import { InteractiveArea } from './interactive-area'
import { CornerDownLeft, X } from 'lucide-react'
import { Button } from './ui/button'

interface TextChatProps {
  onClose?: () => void
  onSendMessage?: (message: string) => void
}

export function TextChat({ onClose, onSendMessage }: TextChatProps) {
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
