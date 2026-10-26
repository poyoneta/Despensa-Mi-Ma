import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { traerClientes, traerProductos, mensajeError } from '../lib/datos.js'
import { METODOS, aNumero, normalizar, pesos } from '../lib/formato.js'
import { useAviso } from '../components/Toast.jsx'
import { usePerfil } from '../components/Perfil.jsx'
import Modal from '../components/Modal.jsx'
import Escaner from '../components/Escaner.jsx'
import { IconoBuscar, IconoEscanear, IconoRayo } from '../components/Iconos.jsx'

let contadorVarios = 0

export default function Caja() {
  const aviso = useAviso()
  const { yo } = usePerfil()
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  // cada ítem: { clave, productoId (o null si es precio libre), nombre, precio, stock, cantidad }
  const [carrito, setCarrito] = useState([])
  const [metodo, setMetodo] = useState('efectivo')
  const [cliente, setCliente] = useState(null)
  const [elegirCliente, setElegirCliente] = useState(false)
  const [varios, setVarios] = useState(false)
  const [camara, setCamara] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const inputRef = useRef()

  async function cargar() {
    try { setProductos(await traerProductos()) } catch (e) { aviso(mensajeError(e), 'error') }
  }
  useEffect(() => { cargar() }, [])

  const rapidos = useMemo(() => productos.filter(p => p.acceso_rapido), [productos])

  function agregar(p) {
    setCarrito(c => {
      const clave = 'p' + p.id
      const ya = c.find(i => i.clave === clave)
      if (ya) return c.map(i => (i.clave === clave ? { ...i, cantidad: i.cantidad + 1 } : i))
      return [...c, { clave, productoId: p.id, nombre: p.nombre, precio: Number(p.precio_venta), stock: p.stock, cantidad: 1 }]
    })
  }

  function agregarVarios({ nombre, precio, cantidad }) {
    contadorVarios += 1
    setCarrito(c => [...c, { clave: 'v' + contadorVarios, productoId: null, nombre, precio, stock: null, cantidad }])
  }

  function cambiar(clave, delta) {
    setCarrito(c => c
      .map(i => (i.clave === clave ? { ...i, cantidad: i.cantidad + delta } : i))
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

  function elegirMetodo(id) {
    setMetodo(id)
    if (id === 'fiado' && !cliente) setElegirCliente(true)
  }

  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const unidades = carrito.reduce((s, i) => s + i.cantidad, 0)

  async function cobrar() {
    if (carrito.length === 0) return
    if (metodo === 'fiado' && !cliente) { setElegirCliente(true); return }
    setCobrando(true)
    const { error } = await supabase.rpc('registrar_venta', {
      p_metodo: metodo,
      p_cliente_id: metodo === 'fiado' ? cliente.id : null,
      p_items: carrito.map(i => (i.productoId
        ? { producto_id: i.productoId, cantidad: i.cantidad }
        : { producto_id: null, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad }))
    })
    setCobrando(false)
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso(metodo === 'fiado' ? `Anotado en el fiado de ${cliente.nombre}: ${pesos(total)}` : `Venta registrada: ${pesos(total)}`, 'ok')
    setCarrito([])
    setMetodo('efectivo')
    setCliente(null)
    cargar() // refresca el stock
    inputRef.current?.focus()
  }

  function cancelar() {
    if (carrito.length && !confirm('¿Borrar la venta actual?')) return
    setCarrito([])
    setCliente(null)
    setMetodo('efectivo')
  }

  return (
    <div className="pagina">
      <div className="encabezado">
        <div>
          <h1>Nueva venta</h1>
          <div className="sub">Vende: {yo.nombre}</div>
        </div>
        <button className="btn" onClick={() => setCamara(c => !c)}>
          <IconoEscanear />{camara ? 'Cerrar cámara' : 'Escanear'}
        </button>
      </div>

      <div className="caja-grid">
        {/* Izquierda: buscar / escanear / rápidos */}
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

          {busqueda.trim() ? (
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="etiqueta">Accesos rápidos</span>
              <div className="tiles">
                <button className="tile varios" onClick={() => setVarios(true)}>
                  <IconoRayo />
                  <span className="nombre">Varios / precio libre</span>
                </button>
                {rapidos.map(p => (
                  <button className="tile" key={p.id} onClick={() => agregar(p)}>
                    <span className="nombre">{p.nombre}</span>
                    <span className="precio">{pesos(p.precio_venta)}</span>
                  </button>
                ))}
              </div>
              {rapidos.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--apagado)' }}>
                  Tip: en Stock, editá un producto y marcá “Acceso rápido en la caja” para que aparezca acá.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Derecha: ticket y cobro */}
        <div className="caja-ticket" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="tarjeta lista">
            {carrito.length === 0 && <div className="vacio">Escaneá o buscá un producto para empezar</div>}
            {carrito.map(i => (
              <div className="fila" key={i.clave}>
                <div className="col">
                  <span className="nombre">{i.nombre}</span>
                  <span className="detalle">
                    {pesos(i.precio)} c/u
                    {i.productoId === null && ' · precio libre'}
                    {i.stock !== null && i.cantidad > i.stock && <span style={{ color: 'var(--error)', fontWeight: 700 }}> · stock: {i.stock}</span>}
                  </span>
                </div>
                <div className="stepper">
                  <button className="btn btn-cuadrado" onClick={() => cambiar(i.clave, -1)} aria-label={`Quitar un ${i.nombre}`}>−</button>
                  <span>{i.cantidad}</span>
                  <button className="btn btn-cuadrado" onClick={() => cambiar(i.clave, 1)} aria-label={`Agregar un ${i.nombre}`}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="campo">
            <span className="etiqueta">Forma de pago</span>
            <div className="pago pago-4" role="group" aria-label="Forma de pago">
              {METODOS.map(m => (
                <button key={m.id} className={metodo === m.id ? 'activo' : ''} aria-pressed={metodo === m.id}
                  onClick={() => elegirMetodo(m.id)}>{m.corto}</button>
              ))}
            </div>
            {metodo === 'fiado' && (
              <div className="tarjeta tarjeta-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span>{cliente ? <>Se anota a <strong>{cliente.nombre}</strong></> : 'Elegí a quién se le fía'}</span>
                <button className="btn btn-chico" onClick={() => setElegirCliente(true)}>{cliente ? 'Cambiar' : 'Elegir'}</button>
              </div>
            )}
          </div>

          <div className="tarjeta tarjeta-pad caja-cobrar" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="total-barra">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="etiqueta">Total · {unidades} {unidades === 1 ? 'producto' : 'productos'}</span>
                <span className="monto">{pesos(total)}</span>
              </div>
              <button className="btn btn-primario" style={{ height: 56, padding: '0 28px', fontSize: 17 }}
                disabled={carrito.length === 0 || cobrando} onClick={cobrar}>
                {cobrando ? 'Cobrando…' : metodo === 'fiado' ? 'Anotar' : 'Cobrar'}
              </button>
            </div>
            {carrito.length > 0 && (
              <button className="btn btn-chico btn-peligro" style={{ alignSelf: 'flex-start' }} onClick={cancelar}>Cancelar venta</button>
            )}
          </div>
        </div>
      </div>

      {varios && <PrecioLibre onCerrar={() => setVarios(false)} onAgregar={it => { agregarVarios(it); setVarios(false) }} />}
      {elegirCliente && (
        <ElegirCliente
          onCerrar={() => { setElegirCliente(false); if (!cliente) setMetodo('efectivo') }}
          onElegir={c => { setCliente(c); setMetodo('fiado'); setElegirCliente(false) }}
        />
      )}
    </div>
  )
}

function PrecioLibre({ onCerrar, onAgregar }) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [cantidad, setCantidad] = useState(1)

  function agregar(e) {
    e.preventDefault()
    const p = aNumero(precio)
    if (!(p > 0)) return
    onAgregar({ nombre: nombre.trim() || 'Varios', precio: p, cantidad: Math.max(1, Number(cantidad) || 1) })
  }

  return (
    <Modal titulo="Varios / precio libre" onCerrar={onCerrar}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={agregar}>
        <p style={{ margin: 0, color: 'var(--apagado)', fontSize: 14 }}>Para cosas sin código: pan, fiambre, sueltos… No descuenta stock.</p>
        <div className="campo">
          <label htmlFor="pl-precio">Precio</label>
          <input id="pl-precio" className="input" inputMode="decimal" required autoFocus placeholder="Ej: 1500"
            value={precio} onChange={e => setPrecio(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="pl-nombre">Qué es (opcional)</label>
          <input id="pl-nombre" className="input" placeholder="Ej: Pan, Fiambre" value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="pl-cant">Cantidad</label>
          <input id="pl-cant" className="input" type="number" min="1" inputMode="numeric" value={cantidad} onChange={e => setCantidad(e.target.value)} />
        </div>
        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario">Agregar</button>
        </div>
      </form>
    </Modal>
  )
}

function ElegirCliente({ onCerrar, onElegir }) {
  const aviso = useAviso()
  const [clientes, setClientes] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    traerClientes().then(setClientes).catch(e => { aviso(mensajeError(e), 'error'); setClientes([]) })
  }, [])

  const q = normalizar(busqueda.trim())
  const lista = (clientes || []).filter(c => !q || normalizar(c.nombre).includes(q))

  async function crear() {
    const nombre = busqueda.trim()
    if (!nombre) return
    const { data, error } = await supabase.from('clientes').insert({ nombre }).select().single()
    if (error) { aviso(mensajeError(error), 'error'); return }
    onElegir(data)
  }

  return (
    <Modal titulo="¿A quién se le fía?" onCerrar={onCerrar}>
      <input className="input" autoFocus placeholder="Buscar o escribir un nombre nuevo" aria-label="Buscar cliente"
        value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      <div className="tarjeta lista" style={{ maxHeight: 340, overflowY: 'auto' }}>
        {!clientes && <div className="cargando">Cargando…</div>}
        {lista.map(c => (
          <button className="fila" key={c.id} onClick={() => onElegir(c)}>
            <span className="nombre">{c.nombre}</span>
            <span className={Number(c.saldo) > 0 ? 'saldo-deuda' : 'saldo-ok'}>Debe {pesos(c.saldo)}</span>
          </button>
        ))}
        {clientes && lista.length === 0 && !busqueda.trim() && <div className="vacio">Todavía no hay clientes. Escribí un nombre para crear uno.</div>}
      </div>
      {busqueda.trim() && !lista.some(c => normalizar(c.nombre) === q) && (
        <button className="btn btn-primario" onClick={crear}>Crear cliente “{busqueda.trim()}”</button>
      )}
    </Modal>
  )
}
