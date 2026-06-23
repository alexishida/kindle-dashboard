import { useLayoutEffect, useRef, useState } from 'react'

const NATIVE_WIDTH = 1448
const NATIVE_HEIGHT = 1072

interface PreviewFrameProps {
  baseUrl: string
  language: 'en' | 'pt-BR' | 'es'
  previewKey: number
}

/**
 * Mostra o dashboard na orientacao paisagem (Kindle deitado) usando o mesmo
 * caminho de captura que gera o PNG real (`captureScale`). O render se auto-escala
 * para `1448*scale x 1072*scale`; dimensionamos o iframe igual, sem transform,
 * garantindo encaixe exato sem corte.
 */
export default function PreviewFrame({ baseUrl, language, previewKey }: PreviewFrameProps): React.JSX.Element {
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
        <iframe
          key={`${previewKey}-${scale}`}
          className="preview-frame"
          title="Previa do dashboard"
          src={`${baseUrl}/render?captureScale=${scale}&preview=${previewKey}&lang=${encodeURIComponent(language)}`}
          style={{ width: NATIVE_WIDTH * scale, height: NATIVE_HEIGHT * scale }}
        />
      ) : null}
    </div>
  )
}
