import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { mercadoPago } from '../lib/mercadopago.js'
import { pesos } from '../lib/formato.js'
import Modal from './Modal.jsx'

// Muestra un QR de Mercado Pago por el monto exacto y espera a que lo paguen.
// Cuando se paga llama a onPagado(referencia).
export default function CobroQR({ monto, descripcion, onPagado, onCerrar }) {
  const [estado, setEstado] = useState('creando') // creando | esperando | pagado | vencido | error
  const [imagen, setImagen] = useState('')
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const orden = useRef(null) // { id, referencia }
  const pagadoRef = useRef(onPagado)
  pagadoRef.current = onPagado

  // crear el QR
  useEffect(() => {
    let vivo = true
    async function crear() {
      setEstado('creando'); setError(''); setImagen('')
      try {
        const referencia = 'MIMA-' + crypto.randomUUID().replace(/-/g, '').slice(0, 20)
        const r = await mercadoPago('crear_qr', { monto, referencia, descripcion })
        if (!r.qr_data) throw new Error('Mercado Pago no devolvió el QR. Revisá que la caja esté configurada.')
        orden.current = { id: r.id, referencia }
        const img = await QRCode.toDataURL(r.qr_data, { width: 320, margin: 1 })
        if (!vivo) return
        setImagen(img)
        setEstado('esperando')
      } catch (e) {
        if (vivo) { setError(e.message); setEstado('error') }
      }
    }
    crear()
    return () => { vivo = false }
  }, [monto, intento])

  // preguntar cada 3 segundos si ya pagaron
  useEffect(() => {
    if (estado !== 'esperando') return
    const t = setInterval(async () => {
      try {
        const r = await mercadoPago('estado_qr', { id: orden.current.id })
        if (r.estado === 'processed') {
          clearInterval(t)
          setEstado('pagado')
          navigator.vibrate?.([80, 60, 80])
          pagadoRef.current(orden.current.referencia)
        } else if (['expired', 'canceled', 'refunded'].includes(r.estado)) {
          clearInterval(t)
          setEstado('vencido')
        }
      } catch { /* sin internet un momento: sigue intentando */ }
    }, 3000)
    return () => clearInterval(t)
  }, [estado])

  function cerrar() {
    if (estado === 'esperando' && orden.current) {
      if (!confirm('¿Cancelar el cobro con QR? Si el cliente ya pagó, esperá unos segundos.')) return
      mercadoPago('cancelar_qr', { id: orden.current.id }).catch(() => {})
    }
    onCerrar()
  }

  return (
    <Modal titulo="Cobrar con QR" onCerrar={cerrar}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>{pesos(monto)}</div>

        {estado === 'creando' && <div className="cargando">Generando QR…</div>}

        {estado === 'esperando' && (
          <>
            <img src={imagen} alt="Código QR para pagar con Mercado Pago" style={{ width: 280, height: 280, borderRadius: 12, border: '1px solid var(--borde)' }} />
            <div style={{ fontWeight: 700 }}>Que el cliente lo escanee con Mercado Pago o la app de su banco</div>
            <div style={{ color: 'var(--apagado)', fontSize: 14 }}>Esperando el pago… se confirma solo. Vence en 10 minutos.</div>
          </>
        )}

        {estado === 'pagado' && (
          <div className="pastilla pastilla-ok" style={{ fontSize: 18, padding: '12px 18px' }}>¡Pagado! Registrando la venta…</div>
        )}

        {estado === 'vencido' && (
          <>
            <div className="pastilla pastilla-aviso" style={{ fontSize: 15 }}>El QR venció o se canceló</div>
            <button className="btn btn-primario" onClick={() => setIntento(i => i + 1)}>Generar otro QR</button>
          </>
        )}

        {estado === 'error' && (
          <>
            <div className="error-txt">{error}</div>
            <button className="btn" onClick={() => setIntento(i => i + 1)}>Reintentar</button>
          </>
        )}
      </div>
    </Modal>
  )
}
