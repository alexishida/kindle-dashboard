import { useLayoutEffect, useRef, useState } from 'react'
import type { SupportedLanguage } from '../../shared/types'

const NATIVE_WIDTH = 1448
const NATIVE_HEIGHT = 1072

interface PreviewFrameProps {
  baseUrl: string
  language: SupportedLanguage
  previewKey: number
}

/**
 * Mostra PNG final servido ao Kindle. O arquivo e retrato, portanto a previa o
 * gira para paisagem sem buscar os coletores uma segunda vez.
 */
export default function PreviewFrame({ baseUrl, language: _language, previewKey }: PreviewFrameProps): React.JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const recompute = (): void => {
      const { width, height } = stage.getBoundingClientRect()
      if (width === 0 || height === 0) return
      const next = Math.min(1, width / NATIVE_WIDTH, height / NATIVE_HEIGHT)
      // arredonda para evitar recarregar o iframe a cada mudanca sub-pixel
      setScale((current) => (Math.abs(current - next) < 0.01 ? current : Math.round(next * 100) / 100))
    }

    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="preview-stage" ref={stageRef}>
      {scale > 0 ? (
        <img
          key={`${previewKey}-${scale}`}
          className="preview-frame preview-image"
          alt="Previa do dashboard"
          src={`${baseUrl}/dash.png?preview=${previewKey}`}
          style={{
            height: NATIVE_WIDTH * scale,
            width: NATIVE_HEIGHT * scale,
          }}
        />
      ) : null}
    </div>
  )
}
