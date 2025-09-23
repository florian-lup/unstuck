import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { InteractiveArea } from '../interactive-area'
import '../../overlay.css'

// Internal hook for dropdown functionality
interface UseDropdownOptions {
  initialOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

function useDropdown<T extends HTMLElement = HTMLDivElement>({
  initialOpen = false,
  onOpenChange,
}: UseDropdownOptions = {}) {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const dropdownRef = useRef<T>(null)

  const setOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      onOpenChange?.(open)
    },
    [onOpenChange]
  )

  const toggle = () => {
    setOpen(!isOpen)
  }
  const open = () => {
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, setOpen])

  // Close dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, setOpen])

  return {
    isOpen,
    setOpen,
    toggle,
    open,
    close,
    dropdownRef,
  }
}

interface DropdownTriggerProps {
  children: React.ReactNode
  isOpen?: boolean
  className?: string
}

interface DropdownItemProps {
  children: React.ReactNode
  onSelect?: () => void
  selected?: boolean
  className?: string
  close?: () => void
}

interface DropdownProps {
  children: React.ReactNode
  className?: string
  onOpenChange?: (open: boolean) => void
  maxWidth?: string
}

interface DropdownContentProps {
  children: React.ReactNode
  className?: string
}

// Main Dropdown Container
export function Dropdown({
  children,
  className = '',
  onOpenChange,
}: DropdownProps) {
  const { isOpen, toggle, close, dropdownRef } = useDropdown({
    onOpenChange,
  })

  const contextValue = {
    isOpen,
    toggle,
    close,
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement, {
              ...contextValue,
            })
          : child
      )}
    </div>
  )
}

// Dropdown Trigger Button
export function DropdownTrigger({
  children,
  isOpen,
  className = '',
  ...contextProps
}: DropdownTriggerProps & { toggle?: () => void }) {
  const { toggle } = contextProps

  return (
    <button
      onClick={toggle}
      className={`border border-overlay-border-primary rounded-3xl px-3 py-1.5 flex items-center gap-2 text-sm font-medium text-overlay-text-primary hover:border-overlay-accent-primary transition-all duration-200 w-full justify-between ${className}`}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
    >
      <div className="flex items-center gap-2">{children}</div>
      <ChevronDown
        className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
  )
}

// Dropdown Content Wrapper
export function DropdownContent({
  children,
  className = '',
  isOpen,
  close,
  maxWidth = 'max-w-[200px]',
}: DropdownContentProps & {
  isOpen?: boolean
  close?: () => void
  maxWidth?: string
}) {
  if (!isOpen) return null

  return (
    <div className={`absolute top-full left-0 mt-1 w-full ${maxWidth} z-50`}>
      <InteractiveArea
        className={`bg-overlay-bg-primary border border-overlay-border-primary rounded-2xl p-1 ${className}`}
      >
        <div className="py-1" role="listbox">
          {React.Children.map(children, (child) =>
            React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement, { close })
              : child
          )}
        </div>
      </InteractiveArea>
    </div>
  )
}

// Individual Dropdown Item
export function DropdownItem({
  children,
  onSelect,
  selected = false,
  className = '',
  close,
}: DropdownItemProps) {
  const handleClick = () => {
    onSelect?.()
    close?.()
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full px-3 py-2 text-left flex items-center gap-2 text-xs text-overlay-text-primary hover:bg-overlay-bg-hover hover:text-overlay-accent-primary transition-all duration-150 focus:outline-none focus:bg-overlay-bg-hover focus:text-overlay-accent-primary rounded-3xl ${className}`}
      role="option"
      aria-selected={selected}
    >
      <div
        className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
          selected ? 'bg-overlay-accent-primary' : 'bg-overlay-text-muted'
        }`}
      />
      <span>{children}</span>
    </button>
  )
}

// Compound component exports
Dropdown.Trigger = DropdownTrigger
Dropdown.Content = DropdownContent
Dropdown.Item = DropdownItem
