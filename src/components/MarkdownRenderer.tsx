import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy } from 'lucide-react'

import 'highlight.js/styles/github.css'

type Props = {
  content: string
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
          className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] font-mono text-slate-800"
          {...props}
        >
          {children}
        </code>
      )
    }

    return (
      <CodeBlock language={match[1]}>{String(children).replace(/\n$/, '')}</CodeBlock>
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
      <blockquote className="mb-2 border-l-2 border-slate-300 pl-3 text-sm italic text-slate-600 last:mb-0">
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
        className="text-blue-600 underline hover:text-blue-800"
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
      <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left text-xs font-semibold">
        {children}
      </th>
    )
  },
  td({ children }) {
    return (
      <td className="border border-slate-200 px-2 py-1 text-sm">{children}</td>
    )
  },
  // Horizontal rule
  hr() {
    return <hr className="my-3 border-slate-200" />
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
}: {
  language: string
  children: string
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group/code relative mb-2 last:mb-0">
      <div className="flex items-center justify-between rounded-t-md border border-b-0 border-slate-200 bg-slate-50 px-3 py-1.5">
        <span className="text-xs font-medium text-slate-500">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover/code:opacity-100"
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
      <pre className="overflow-x-auto rounded-b-md border border-t-0 border-slate-200 bg-white p-3">
        <code className={`language-${language} text-[13px]`}>{children}</code>
      </pre>
    </div>
  )
}
