import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { mensajeError } from '../lib/datos.js'
import { bajoStock, cantidadSugerida, estadoStock, iniciales } from '../lib/formato.js'
import { useAviso } from '../components/Toast.jsx'
import { IconoEnviar, IconoVolver } from '../components/Iconos.jsx'

export default function Pedido() {
  const { id } = useParams()
  const navegar = useNavigate()
  const aviso = useAviso()
  const [proveedor, setProveedor] = useState(null)
  const [productos, setProductos] = useState([])
  const [cantidades, setCantidades] = useState({}) // { productoId: cantidad }
  const [verTodos, setVerTodos] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    async function cargar() {
      const [pr, p] = await Promise.all([
        supabase.from('proveedores').select('*').eq('id', id).single(),
        supabase.from('productos').select('*').eq('proveedor_id', id).eq('activo', true).order('nombre')
      ])
      if (pr.error || p.error) { aviso(mensajeError(pr.error || p.error), 'error'); return }
      setProveedor(pr.data)
      // los que faltan primero
      const ordenados = [...p.data].sort((a, b) => Number(bajoStock(b)) - Number(bajoStock(a)) || a.stock - b.stock)
      setProductos(ordenados)
      const inicial = {}
      for (const prod of ordenados) inicial[prod.id] = bajoStock(prod) ? cantidadSugerida(prod) : 0
      setCantidades(inicial)
    }
    cargar()
  }, [id])

  const visibles = verTodos ? productos : productos.filter(p => bajoStock(p) || cantidades[p.id] > 0)
  const elegidos = productos.filter(p => cantidades[p.id] > 0)

  const mensaje = useMemo(() => {
    if (!proveedor) return ''
    const dia = proveedor.dia_visita ? ` para el ${proveedor.dia_visita}` : ''
    const lineas = elegidos.map(p => `• ${cantidades[p.id]} × ${p.nombre}`).join('\n')
    return `Hola! Te paso el pedido de Despensa Mi-Ma${dia}:\n${lineas}\nGracias!`
  }, [proveedor, elegidos, cantidades])

  function setCant(pid, valor) {
    setCantidades(c => ({ ...c, [pid]: Math.max(0, Number(valor) || 0) }))
  }

  async function guardarPedido() {
    const { data: ped, error } = await supabase.from('pedidos').insert({ proveedor_id: Number(id) }).select().single()
    if (error) throw error
    const { error: e2 } = await supabase.from('pedido_items').insert(
      elegidos.map(p => ({ pedido_id: ped.id, producto_id: p.id, nombre: p.nombre, cantidad: cantidades[p.id] }))
    )
    if (e2) throw e2
  }

  async function enviar(porWhatsapp) {
    if (elegidos.length === 0) { aviso('Elegí al menos un producto', 'error'); return }
    // abrimos la ventana antes del await para que el navegador no la bloquee
    const ventana = porWhatsapp && proveedor.telefono ? window.open('', '_blank') : null
    setEnviando(true)
    try {
      await guardarPedido()
      if (porWhatsapp) {
        if (ventana) {
          ventana.location.href = `https://wa.me/${proveedor.telefono}?text=${encodeURIComponent(mensaje)}`
        } else {
          await navigator.clipboard?.writeText(mensaje)
          aviso('Este proveedor no tiene WhatsApp cargado. Copié el mensaje.', 'ok')
        }
      } else {
        aviso('Pedido guardado', 'ok')
      }
      navegar('/proveedores')
    } catch (e) {
      ventana?.close()
      aviso(mensajeError(e), 'error')
    } finally {
      setEnviando(false)
    }
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(mensaje); aviso('Mensaje copiado') }
    catch { aviso('No se pudo copiar', 'error') }
  }

  if (!proveedor) return <div className="cargando">Cargando…</div>

  return (
    <div className="pagina" style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link to="/proveedores" className="btn btn-cuadrado" aria-label="Volver a proveedores"><IconoVolver /></Link>
        <h1>Pedido a proveedor</h1>
      </div>

      <div className="tarjeta tarjeta-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="avatar">{iniciales(proveedor.nombre)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong style={{ fontSize: 16 }}>{proveedor.nombre}</strong>
          <span style={{ fontSize: 13, color: 'var(--apagado)' }}>
            {proveedor.dia_visita ? `Pasa los ${proveedor.dia_visita}` : 'Sin día fijo'}
          </span>
        </div>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="encabezado">
          <span className="etiqueta">Productos a pedir (sugerido según el mínimo)</span>
          {productos.length > 0 && (
            <button className="btn btn-chico" onClick={() => setVerTodos(v => !v)}>
              {verTodos ? 'Ver solo los que faltan' : `Ver todos (${productos.length})`}
            </button>
          )}
        </div>
        <div className="tarjeta lista">
          {productos.length === 0 && <div className="vacio">Este proveedor no tiene productos asignados. Asignáselos desde Stock.</div>}
          {productos.length > 0 && visibles.length === 0 && <div className="vacio">No falta nada de este proveedor.</div>}
          {visibles.map(p => {
            const est = estadoStock(p)
            return (
              <div className="fila" key={p.id}>
                <div className="col">
                  <span className="nombre">{p.nombre}</span>
                  <span className="detalle" style={est ? { color: est.clase === 'pastilla-error' ? 'var(--error)' : 'var(--aviso)', fontWeight: 600 } : undefined}>
                    {p.stock <= 0 ? 'Sin stock' : `Quedan ${p.stock}`} · mínimo {p.stock_minimo}
                  </span>
                </div>
                <div className="stepper">
                  <button className="btn btn-cuadrado" onClick={() => setCant(p.id, (cantidades[p.id] || 0) - 1)} aria-label={`Pedir uno menos de ${p.nombre}`}>−</button>
                  <input className="input-cant" type="number" min="0" inputMode="numeric" aria-label={`Cantidad de ${p.nombre}`}
                    value={cantidades[p.id] ?? 0} onChange={e => setCant(p.id, e.target.value)} />
                  <button className="btn btn-cuadrado" onClick={() => setCant(p.id, (cantidades[p.id] || 0) + 1)} aria-label={`Pedir uno más de ${p.nombre}`}>+</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {elegidos.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="encabezado">
            <span className="etiqueta">Vista previa del mensaje</span>
            <button className="btn btn-chico" onClick={copiar}>Copiar</button>
          </div>
          <div className="mensaje-wsp">{mensaje}</div>
        </section>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn btn-ok btn-grande" disabled={enviando || elegidos.length === 0} onClick={() => enviar(true)}>
          <IconoEnviar />Enviar por WhatsApp
        </button>
        <button className="btn" disabled={enviando || elegidos.length === 0} onClick={() => enviar(false)}>
          Solo guardar el pedido
        </button>
      </div>
    </div>
  )
}
