import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { traerProductos, mensajeError } from '../lib/datos.js'
import { METODOS, normalizar, pesos } from '../lib/formato.js'
import { useAviso } from '../components/Toast.jsx'
import Escaner from '../components/Escaner.jsx'
import { IconoBuscar, IconoEscanear } from '../components/Iconos.jsx'

export default function Caja() {
  const aviso = useAviso()
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState([]) // [{ p: producto, cantidad }]
  const [metodo, setMetodo] = useState('efectivo')
  const [camara, setCamara] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const inputRef = useRef()

  async function cargar() {
    try { setProductos(await traerProductos()) } catch (e) { aviso(mensajeError(e), 'error') }
  }
  useEffect(() => { cargar() }, [])

  function agregar(p) {
    setCarrito(c => {
      const ya = c.find(i => i.p.id === p.id)
      if (ya) return c.map(i => (i.p.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i))
      return [...c, { p, cantidad: 1 }]
    })
  }

  function cambiar(id, delta) {
    setCarrito(c => c
      .map(i => (i.p.id === id ? { ...i, cantidad: i.cantidad + delta } : i))
      .filter(i => i.cantidad > 0))
  }

  // Sirve para la cámara y para los lectores USB (que "escriben" el código y apretan Enter)
  function porCodigo(codigo) {
    const p = productos.find(x => x.codigo_barras === codigo.trim())
    if (p) {
      agregar(p)
      aviso(`+1 ${p.nombre}`)
      return true
    }
    aviso(`No encontré el código ${codigo}. Cargalo en Stock.`, 'error')
    return false
  }

  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return []
    return productos
      .filter(p => normalizar(p.nombre).includes(q) || (p.codigo_barras || '').startsWith(q))
      .slice(0, 8)
  }, [busqueda, productos])

  function alApretarTecla(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const txt = busqueda.trim()
    if (!txt) return
    const exacto = productos.find(p => p.codigo_barras === txt)
    if (exacto) { agregar(exacto); setBusqueda(''); return }
    if (/^\d{6,}$/.test(txt)) { porCodigo(txt); setBusqueda(''); return }
    if (resultados.length === 1) { agregar(resultados[0]); setBusqueda('') }
  }

  const total = carrito.reduce((s, i) => s + i.p.precio_venta * i.cantidad, 0)
  const unidades = carrito.reduce((s, i) => s + i.cantidad, 0)

  async function cobrar() {
    if (carrito.length === 0) return
    setCobrando(true)
    const { error } = await supabase.rpc('registrar_venta', {
      p_metodo: metodo,
      p_items: carrito.map(i => ({ producto_id: i.p.id, cantidad: i.cantidad }))
    })
    setCobrando(false)
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso(`Venta registrada: ${pesos(total)}`, 'ok')
    setCarrito([])
    setMetodo('efectivo')
    cargar() // refresca el stock
    inputRef.current?.focus()
  }

  function cancelar() {
    if (carrito.length && !confirm('¿Borrar la venta actual?')) return
    setCarrito([])
  }

  return (
    <div className="pagina">
      <div className="encabezado">
        <h1>Nueva venta</h1>
        <button className="btn" onClick={() => setCamara(c => !c)}>
          <IconoEscanear />{camara ? 'Cerrar cámara' : 'Escanear'}
        </button>
      </div>

      <div className="caja-grid">
        {/* Izquierda: buscar / escanear */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {camara && <Escaner onDetectado={porCodigo} />}

          <div className="campo">
            <label htmlFor="buscar-caja">Buscá por nombre o escribí el código</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: 13, color: 'var(--apagado)' }}><IconoBuscar /></span>
              <input id="buscar-caja" ref={inputRef} className="input" style={{ paddingLeft: 44 }}
                placeholder="Ej: alfajor, gaseosa, 779…" autoComplete="off" autoFocus
                value={busqueda} onChange={e => setBusqueda(e.target.value)} onKeyDown={alApretarTecla} />
            </div>
          </div>

          {busqueda.trim() && (
            <div className="tarjeta lista resultados">
              {resultados.length === 0 && <div className="vacio">No hay productos con “{busqueda}”</div>}
              {resultados.map(p => (
                <button className="fila" key={p.id} onClick={() => { agregar(p); setBusqueda(''); inputRef.current?.focus() }}>
                  <span className="col">
                    <span className="nombre">{p.nombre}</span>
                    <span className="detalle">Stock: {p.stock}</span>
                  </span>
                  <span className="precio">{pesos(p.precio_venta)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Derecha: ticket y cobro */}
        <div className="caja-ticket" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="tarjeta lista">
            {carrito.length === 0 && <div className="vacio">Escaneá o buscá un producto para empezar</div>}
            {carrito.map(({ p, cantidad }) => (
              <div className="fila" key={p.id}>
                <div className="col">
                  <span className="nombre">{p.nombre}</span>
                  <span className="detalle">
                    {pesos(p.precio_venta)} c/u
                    {cantidad > p.stock && <span style={{ color: 'var(--error)', fontWeight: 700 }}> · stock: {p.stock}</span>}
                  </span>
                </div>
                <div className="stepper">
                  <button className="btn btn-cuadrado" onClick={() => cambiar(p.id, -1)} aria-label={`Quitar un ${p.nombre}`}>−</button>
                  <span>{cantidad}</span>
                  <button className="btn btn-cuadrado" onClick={() => cambiar(p.id, 1)} aria-label={`Agregar un ${p.nombre}`}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="campo">
            <span className="etiqueta">Forma de pago</span>
            <div className="pago" role="group" aria-label="Forma de pago">
              {METODOS.map(m => (
                <button key={m.id} className={metodo === m.id ? 'activo' : ''} aria-pressed={metodo === m.id}
                  onClick={() => setMetodo(m.id)}>{m.nombre}</button>
              ))}
            </div>
          </div>

          <div className="tarjeta tarjeta-pad caja-cobrar" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="total-barra">
              <div className="col" style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="etiqueta">Total · {unidades} {unidades === 1 ? 'producto' : 'productos'}</span>
                <span className="monto">{pesos(total)}</span>
              </div>
              <button className="btn btn-primario" style={{ height: 56, padding: '0 28px', fontSize: 17 }}
                disabled={carrito.length === 0 || cobrando} onClick={cobrar}>
                {cobrando ? 'Cobrando…' : 'Cobrar'}
              </button>
            </div>
            {carrito.length > 0 && (
              <button className="btn btn-chico btn-peligro" style={{ alignSelf: 'flex-start' }} onClick={cancelar}>Cancelar venta</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
