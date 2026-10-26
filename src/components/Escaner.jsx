import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats as F } from 'html5-qrcode'

// Lector de códigos de barras con la cámara del celular (o la webcam de la compu).
// Ojo: la cámara solo funciona en https (Render) o en localhost.
export default function Escaner({ onDetectado }) {
  const id = 'lector-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [error, setError] = useState('')
  const callback = useRef(onDetectado)
  callback.current = onDetectado

  useEffect(() => {
    const lector = new Html5Qrcode(id, {
      verbose: false,
      formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39]
    })
    let ultimo = ''
    let cuando = 0

    const arranque = lector.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 120 } },
      texto => {
        // evita leer el mismo código 10 veces seguidas
        const ahora = Date.now()
        if (texto === ultimo && ahora - cuando < 1500) return
        ultimo = texto
        cuando = ahora
        navigator.vibrate?.(60)
        callback.current(texto)
      },
      () => {}
    ).catch(() => setError('No se pudo abrir la cámara. Revisá que le diste permiso.'))

    return () => {
      arranque
        .then(() => lector.isScanning && lector.stop())
        .then(() => lector.clear())
        .catch(() => {})
    }
  }, [id])

  return (
    <div className="lector">
      <div id={id} />
      {error && <div className="msj">{error}</div>}
    </div>
  )
}
