import { memo } from 'react'
import ReactMarkdown from 'react-markdown'

interface MarkdownContentProps {
  content: string
  className?: string
}

/**
 * Clean up citation references like [1], [2], [3] etc from the content
 */
function cleanCitations(content: string): string {
  // Remove citation references like [1], [2], [3] etc.
  return content.replace(/\[\d+\]/g, '')
}

/**
 * A safe, optimized markdown renderer for simple text formatting
 * Supports: bold, italic, lists, links, headings, blockquotes
 * Excludes: code blocks, images, tables, and other complex elements
 */
export const MarkdownContent = memo(({ 
  content, 
  className = "text-overlay-text-secondary" 
}: MarkdownContentProps) => {
  // Clean up citation references before rendering
  const cleanedContent = cleanCitations(content)
  
  return (
    <div className={className}>
      <ReactMarkdown 
        allowedElements={[
          // Text formatting
          'p', 'br', 'strong', 'em', 'del', 'b', 'i',
          // Lists
          'ul', 'ol', 'li',
          // Links
          'a',
          // Headings (simple ones)
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          // Structure
          'div', 'span',
          // Blockquotes and other formatting
          'blockquote',
        ]}
        unwrapDisallowed={true}
        components={{
          // Headings with proper hierarchy
          h1: ({children}) => <h1 className="text-2xl font-bold mt-6 mb-4 text-white">{children}</h1>,
          h2: ({children}) => <h2 className="text-xl font-bold mt-5 mb-3 text-white">{children}</h2>,
          h3: ({children}) => <h3 className="text-lg font-semibold mt-4 mb-2 text-white">{children}</h3>,
          h4: ({children}) => <h4 className="text-base font-semibold mt-3 mb-2 text-white">{children}</h4>,
          // Paragraphs
          p: ({children}) => <p className="mb-3 leading-relaxed">{children}</p>,
          // Lists
          ul: ({children}) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
          li: ({children}) => <li className="text-sm">{children}</li>,
          // Text formatting
          strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({children}) => <em className="italic">{children}</em>,
          // Links
          a: ({href, children}) => <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
        }}
      >
        {cleanedContent}
      </ReactMarkdown>
    </div>
  )
})

MarkdownContent.displayName = 'MarkdownContent'
