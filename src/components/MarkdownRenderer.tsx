import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy } from 'lucide-react'

import 'highlight.js/styles/github-dark.css'

type Props = {
  content: string
}

/** Recursively extract raw text from React nodes (rehype-highlight wraps tokens in <span>s). */
function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (typeof node === 'object' && 'props' in node) {
    return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children)
  }
  return ''
}

const components: Components = {
  // Code blocks with copy button
  pre({ children }) {
    return <>{children}</>
  },
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const isInline = !match

    if (isInline) {
      return (
        <code
          className="rounded-md bg-[#F8F3EA] px-1.5 py-0.5 text-[13px] font-mono text-[#111827] ring-1 ring-[#E3DACC]"
          {...props}
        >
          {children}
        </code>
      )
    }

    const rawText = extractText(children).replace(/\n$/, '')
    return (
      <CodeBlock language={match[1]} rawText={rawText}>
        {children}
      </CodeBlock>
    )
  },
  // Headings
  h1({ children }) {
    return <h1 className="mb-2 mt-4 text-lg font-bold first:mt-0">{children}</h1>
  },
  h2({ children }) {
    return <h2 className="mb-1.5 mt-3 text-base font-bold first:mt-0">{children}</h2>
  },
  h3({ children }) {
    return <h3 className="mb-1 mt-2.5 text-sm font-bold first:mt-0">{children}</h3>
  },
  // Paragraphs
  p({ children }) {
    return <p className="mb-2 last:mb-0">{children}</p>
  },
  // Lists
  ul({ children }) {
    return <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
  },
  ol({ children }) {
    return <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
  },
  li({ children }) {
    return <li className="text-sm leading-relaxed">{children}</li>
  },
  // Blockquote
  blockquote({ children }) {
    return (
      <blockquote className="mb-2 border-l-2 border-[#CDBFAE] pl-3 text-sm italic text-[#4B5563] last:mb-0">
        {children}
      </blockquote>
    )
  },
  // Links
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#1D4ED8] underline hover:text-[#1E3A8A]"
      >
        {children}
      </a>
    )
  },
  // Tables
  table({ children }) {
    return (
      <div className="mb-2 overflow-x-auto last:mb-0">
        <table className="w-full text-sm">{children}</table>
      </div>
    )
  },
  th({ children }) {
    return (
      <th className="border border-[#E3DACC] bg-[#F8F3EA] px-2 py-1 text-left text-xs font-semibold text-[#080B14]">
        {children}
      </th>
    )
  },
  td({ children }) {
    return (
      <td className="border border-[#E3DACC] px-2 py-1 text-sm">{children}</td>
    )
  },
  // Horizontal rule
  hr() {
    return <hr className="my-3 border-[#E3DACC]" />
  },
}

export function MarkdownRenderer({ content }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
}

// ── CodeBlock with copy button ───────────────────────────────────────────────

function CodeBlock({
  language,
  children,
  rawText,
}: {
  language: string
  children: React.ReactNode
  rawText: string
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(rawText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group/code relative mb-2 last:mb-0">
      <div className="flex items-center justify-between rounded-t-2xl border border-b-0 border-[#2A2F3A] bg-[#1B2028] px-4 py-2">
        <span className="text-xs font-medium text-[#8B949E]">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-[#8B949E] opacity-0 transition-opacity hover:bg-white/10 hover:text-[#C9D1D9] group-hover/code:opacity-100"
        >
          {copied ? (
            <>
              <Check className="size-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-b-2xl border border-t-0 border-[#2A2F3A] bg-[#1B2028] p-4 text-[13px] leading-[1.65]">
        <code className={`language-${language}`}>{children}</code>
      </pre>
    </div>
  )
}
