import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { traerClientes, mensajeError } from '../lib/datos.js'
import { nombreCliente, normalizar, pesos, soloNumeros, textoBusquedaCliente } from '../lib/formato.js'
import { useAviso } from './Toast.jsx'
import Modal from './Modal.jsx'

// Buscar un cliente o crear uno nuevo en el momento
export function ElegirCliente({ titulo = '¿Quién compra?', inicial, onCerrar, onElegir, onSinCliente }) {
  const aviso = useAviso()
  const [clientes, setClientes] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    traerClientes().then(setClientes).catch(e => { aviso(mensajeError(e), 'error'); setClientes([]) })
  }, [])

  const q = normalizar(busqueda.trim())
  const lista = (clientes || []).filter(c => !q || textoBusquedaCliente(c).includes(q)).slice(0, 50)

  if (creando) {
    return <ClienteForm inicial={{ ...inicial, nombre: busqueda.trim() || inicial?.nombre || '' }} onCerrar={() => setCreando(false)} onListo={onElegir} />
  }

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <input className="input" autoFocus placeholder="Buscar por nombre, apodo o DNI" aria-label="Buscar cliente"
        value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      <div className="tarjeta lista" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {!clientes && <div className="cargando">Cargando…</div>}
        {lista.map(c => (
          <button className="fila" key={c.id} onClick={() => onElegir(c)}>
            <span className="col">
              <span className="nombre">{nombreCliente(c)}</span>
              {(c.dni || c.telefono) && <span className="detalle">{[c.dni && `DNI ${c.dni}`, c.telefono].filter(Boolean).join(' · ')}</span>}
            </span>
            {Number(c.saldo) > 0 && <span className="saldo-deuda">Debe {pesos(c.saldo)}</span>}
          </button>
        ))}
        {clientes && lista.length === 0 && <div className="vacio">{busqueda ? 'No hay nadie con ese nombre' : 'Todavía no hay clientes'}</div>}
      </div>
      <button className="btn btn-primario" onClick={() => setCreando(true)}>
        {busqueda.trim() ? `Nuevo cliente: “${busqueda.trim()}”` : 'Nuevo cliente'}
      </button>
      {onSinCliente && <button className="btn" onClick={onSinCliente}>Sin cliente</button>}
    </Modal>
  )
}

// Alta y edición de clientes: nombre, apellido, apodo, DNI, WhatsApp, notas
export function ClienteForm({ cliente, inicial, onCerrar, onListo, onArchivar }) {
  const aviso = useAviso()
  const base = cliente || inicial || {}
  const [f, setF] = useState({
    nombre: base.nombre || '', apellido: base.apellido || '', apodo: base.apodo || '',
    dni: base.dni || '', telefono: base.telefono || '', notas: base.notas || ''
  })
  const [guardando, setGuardando] = useState(false)
  const cambiar = c => e => setF(v => ({ ...v, [c]: e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    if (!f.nombre.trim() && !f.apodo.trim()) { aviso('Poné al menos el nombre o el apodo', 'error'); return }
    setGuardando(true)
    const datos = {
      nombre: f.nombre.trim() || f.apodo.trim(),
      apellido: f.apellido.trim() || null,
      apodo: f.apodo.trim() || null,
      dni: soloNumeros(f.dni) || null,
      telefono: soloNumeros(f.telefono) || null,
      notas: f.notas.trim() || null
    }
    const { data, error } = cliente
      ? await supabase.from('clientes').update(datos).eq('id', cliente.id).select().single()
      : await supabase.from('clientes').insert(datos).select().single()
    setGuardando(false)
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso('Cliente guardado', 'ok')
    onListo({ ...data, saldo: cliente?.saldo ?? 0 })
  }

  return (
    <Modal titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={onCerrar}>
      <form className="form-grid" onSubmit={guardar}>
        <div className="campo">
          <label htmlFor="cl-nombre">Nombre</label>
          <input id="cl-nombre" className="input" autoFocus value={f.nombre} onChange={cambiar('nombre')} placeholder="Ej: Rosa" />
        </div>
        <div className="campo">
          <label htmlFor="cl-apellido">Apellido</label>
          <input id="cl-apellido" className="input" value={f.apellido} onChange={cambiar('apellido')} placeholder="Opcional" />
        </div>
        <div className="campo">
          <label htmlFor="cl-apodo">Apodo</label>
          <input id="cl-apodo" className="input" value={f.apodo} onChange={cambiar('apodo')} placeholder="Ej: la del perro" />
        </div>
        <div className="campo">
          <label htmlFor="cl-dni">DNI</label>
          <input id="cl-dni" className="input" inputMode="numeric" value={f.dni} onChange={cambiar('dni')} placeholder="Opcional" />
        </div>
        <div className="campo ancho">
          <label htmlFor="cl-tel">WhatsApp</label>
          <input id="cl-tel" className="input" inputMode="tel" value={f.telefono} onChange={cambiar('telefono')} placeholder="549 3573 123456 (opcional)" />
        </div>
        <div className="campo ancho">
          <label htmlFor="cl-notas">Notas</label>
          <input id="cl-notas" className="input" value={f.notas} onChange={cambiar('notas')} placeholder="Ej: paga los viernes" />
        </div>
        <div className="acciones ancho" style={{ justifyContent: 'space-between' }}>
          {onArchivar ? <button type="button" className="btn btn-peligro" onClick={onArchivar}>Ocultar cliente</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
            <button className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
