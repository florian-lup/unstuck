import { useState, useRef, useEffect } from 'react'

interface UseDropdownOptions {
  initialOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function useDropdown<T extends HTMLElement = HTMLDivElement>({
  initialOpen = false,
  onOpenChange
}: UseDropdownOptions = {}) {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const dropdownRef = useRef<T>(null)

  const setOpen = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)
  }

  const toggle = () => setOpen(!isOpen)
  const open = () => setOpen(true)
  const close = () => setOpen(false)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

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
  }, [isOpen])

  return {
    isOpen,
    setOpen,
    toggle,
    open,
    close,
    dropdownRef
  }
}
