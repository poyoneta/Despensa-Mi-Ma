import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { traerProductos, traerProveedores, mensajeError } from '../lib/datos.js'
import { DIAS, bajoStock, fechaCorta, iniciales, soloNumeros } from '../lib/formato.js'
import { useAviso } from '../components/Toast.jsx'
import Modal from '../components/Modal.jsx'
import { IconoMas } from '../components/Iconos.jsx'

export default function Proveedores() {
  const aviso = useAviso()
  const [proveedores, setProveedores] = useState(null)
  const [productos, setProductos] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [editando, setEditando] = useState(null)

  async function cargar() {
    try {
      const [pr, p, ped] = await Promise.all([
        traerProveedores(),
        traerProductos(),
        supabase.from('pedidos')
          .select('id, creado_en, proveedores(nombre), pedido_items(nombre, cantidad)')
          .eq('estado', 'pendiente').order('creado_en', { ascending: false })
      ])
      if (ped.error) throw ped.error
      setProveedores(pr); setProductos(p); setPendientes(ped.data)
    } catch (e) { aviso(mensajeError(e), 'error') }
  }
  useEffect(() => { cargar() }, [])

  async function recibir(pedido) {
    if (!confirm('¿Llegó todo el pedido? Se va a sumar al stock.')) return
    const { error } = await supabase.rpc('recibir_pedido', { p_pedido_id: pedido.id })
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso('Pedido recibido, stock actualizado', 'ok')
    cargar()
  }

  const faltan = id => productos.filter(p => p.proveedor_id === id && bajoStock(p)).length
  const sinProveedor = productos.filter(p => !p.proveedor_id && bajoStock(p)).length

  return (
    <div className="pagina">
      <div className="encabezado">
        <h1>Proveedores</h1>
        <button className="btn btn-primario" onClick={() => setEditando('nuevo')}><IconoMas tam={18} />Nuevo proveedor</button>
      </div>

      {pendientes.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2>Pedidos por llegar</h2>
          <div className="grid-tarjetas">
            {pendientes.map(ped => (
              <div className="tarjeta tarjeta-pad" key={ped.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="col" style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>{ped.proveedores?.nombre || 'Proveedor borrado'}</strong>
                  <span className="detalle" style={{ color: 'var(--apagado)', fontSize: 13 }}>Pedido el {fechaCorta(ped.creado_en)}</span>
                </div>
                <div style={{ fontSize: 14 }}>
                  {ped.pedido_items.map(i => `${i.cantidad} × ${i.nombre}`).join(' · ')}
                </div>
                <button className="btn btn-ok" onClick={() => recibir(ped)}>Llegó el pedido</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pendientes.length > 0 && <h2>Tus proveedores</h2>}
        {!proveedores && <div className="cargando">Cargando…</div>}
        {proveedores && proveedores.length === 0 && (
          <div className="tarjeta vacio">Todavía no cargaste proveedores. Agregá el primero con “Nuevo proveedor”.</div>
        )}
        <div className="grid-tarjetas">
          {proveedores?.map(pr => {
            const n = faltan(pr.id)
            return (
              <div className="tarjeta tarjeta-pad" key={pr.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="avatar">{iniciales(pr.nombre)}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto', minWidth: 0 }}>
                    <strong style={{ fontSize: 16 }}>{pr.nombre}</strong>
                    <span style={{ fontSize: 13, color: 'var(--apagado)' }}>
                      {[pr.dia_visita && `Pasa los ${pr.dia_visita}`, pr.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                    </span>
                  </div>
                  {n > 0 && <span className="pastilla pastilla-aviso">{n} para reponer</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link to={`/pedido/${pr.id}`} className="btn btn-primario" style={{ flex: 1 }}>Armar pedido</Link>
                  <button className="btn" onClick={() => setEditando(pr)}>Editar</button>
                </div>
              </div>
            )
          })}
        </div>
        {sinProveedor > 0 && (
          <p style={{ color: 'var(--apagado)', fontSize: 14, margin: 0 }}>
            Hay {sinProveedor} productos con poco stock que no tienen proveedor asignado. Asignáselo desde Stock.
          </p>
        )}
      </section>

      {editando && (
        <ProveedorForm proveedor={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar() }} />
      )}
    </div>
  )
}

function ProveedorForm({ proveedor, onCerrar, onGuardado }) {
  const aviso = useAviso()
  const [f, setF] = useState({
    nombre: proveedor?.nombre || '',
    telefono: proveedor?.telefono || '',
    dia_visita: proveedor?.dia_visita || '',
    notas: proveedor?.notas || ''
  })
  const cambiar = campo => e => setF(v => ({ ...v, [campo]: e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    const datos = { ...f, nombre: f.nombre.trim(), telefono: soloNumeros(f.telefono) || null, dia_visita: f.dia_visita || null }
    const { error } = proveedor
      ? await supabase.from('proveedores').update(datos).eq('id', proveedor.id)
      : await supabase.from('proveedores').insert(datos)
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso('Proveedor guardado', 'ok')
    onGuardado()
  }

  async function borrar() {
    if (!confirm(`¿Borrar a ${proveedor.nombre}? Sus productos quedan sin proveedor.`)) return
    const { error } = await supabase.from('proveedores').delete().eq('id', proveedor.id)
    if (error) { aviso(mensajeError(error), 'error'); return }
    onGuardado()
  }

  return (
    <Modal titulo={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'} onCerrar={onCerrar}>
      <form className="form-grid" onSubmit={guardar}>
        <div className="campo ancho">
          <label htmlFor="pr-nombre">Nombre</label>
          <input id="pr-nombre" className="input" required autoFocus value={f.nombre} onChange={cambiar('nombre')} placeholder="Ej: Distribuidora del centro" />
        </div>
        <div className="campo">
          <label htmlFor="pr-tel">WhatsApp</label>
          <input id="pr-tel" className="input" inputMode="tel" value={f.telefono} onChange={cambiar('telefono')} placeholder="549 3573 123456" />
        </div>
        <div className="campo">
          <label htmlFor="pr-dia">Día que pasa</label>
          <select id="pr-dia" className="input" value={f.dia_visita} onChange={cambiar('dia_visita')}>
            <option value="">No tiene día fijo</option>
            {DIAS.slice(1).concat(DIAS[0]).map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
          </select>
        </div>
        <div className="campo ancho">
          <label htmlFor="pr-notas">Notas</label>
          <textarea id="pr-notas" className="input" value={f.notas} onChange={cambiar('notas')} placeholder="Ej: pedido mínimo, horario…" />
        </div>
        <p className="ancho" style={{ margin: 0, color: 'var(--apagado)', fontSize: 13 }}>
          El WhatsApp va con código de país: 54, después 9, después el número con característica sin el 0 ni el 15.
        </p>
        <div className="acciones ancho" style={{ justifyContent: 'space-between' }}>
          {proveedor ? <button type="button" className="btn btn-peligro" onClick={borrar}>Borrar</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
            <button className="btn btn-primario">Guardar</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
