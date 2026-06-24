import { useEffect, useRef, useState } from 'react'

type Props = {
  html: string
  title?: string
}

export function VisualizationIframe({ html, title }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(450)

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'viz-resize' && typeof event.data.height === 'number') {
        setHeight(Math.max(300, Math.min(event.data.height + 32, 800)))
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <div className="overflow-hidden rounded-xl border border-[#E3DACC] bg-[#FFFCF6] shadow-sm">
      {title && (
        <div className="border-b border-[#E3DACC] bg-[#F8F3EA] px-3 py-1.5">
          <span className="text-xs font-medium text-[#4B5563]">{title}</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={html}
        sandbox="allow-scripts"
        title={title || 'Visualization'}
        style={{ width: '100%', height, border: 'none' }}
      />
    </div>
  )
}
