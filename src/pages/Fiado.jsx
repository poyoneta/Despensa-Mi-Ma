import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { traerClientes, mensajeError } from '../lib/datos.js'
import { aNumero, fechaCorta, iniciales, nombreCliente, normalizar, pesos, textoBusquedaCliente } from '../lib/formato.js'
import { useAviso } from '../components/Toast.jsx'
import { usePerfil } from '../components/Perfil.jsx'
import Modal from '../components/Modal.jsx'
import { ClienteForm } from '../components/Clientes.jsx'
import { IconoBuscar, IconoMas } from '../components/Iconos.jsx'

// Libreta del fiado: quién debe cuánto, lo que llevó y lo que pagó
export default function Fiado() {
  const aviso = useAviso()
  const [clientes, setClientes] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [soloDeudores, setSoloDeudores] = useState(true)
  const [abierto, setAbierto] = useState(null)
  const [nuevo, setNuevo] = useState(false)

  async function cargar() {
    try { setClientes(await traerClientes()) } catch (e) { aviso(mensajeError(e), 'error'); setClientes([]) }
  }
  useEffect(() => { cargar() }, [])

  const lista = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return (clientes || [])
      .filter(c => !soloDeudores || Number(c.saldo) > 0)
      .filter(c => !q || textoBusquedaCliente(c).includes(q))
      .sort((a, b) => Number(b.saldo) - Number(a.saldo))
  }, [clientes, busqueda, soloDeudores])

  const totalDeuda = (clientes || []).reduce((s, c) => s + Math.max(Number(c.saldo), 0), 0)
  const cantDeudores = (clientes || []).filter(c => Number(c.saldo) > 0).length

  return (
    <div className="pagina">
      <div className="encabezado">
        <h1>Clientes y fiado</h1>
        <button className="btn btn-primario" onClick={() => setNuevo(true)}><IconoMas tam={18} />Nuevo cliente</button>
      </div>

      <div className="kpis">
        <div className="tarjeta kpi destacado"><span className="etiqueta">Les deben en total</span><strong>{pesos(totalDeuda)}</strong></div>
        <div className="tarjeta kpi"><span className="etiqueta">Clientes que deben</span><strong>{cantDeudores}</strong></div>
      </div>

      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: 13, color: 'var(--apagado)' }}><IconoBuscar /></span>
        <input className="input" style={{ paddingLeft: 44 }} placeholder="Buscar por nombre, apodo o DNI" aria-label="Buscar cliente"
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>
      <div className="chips" role="group" aria-label="Mostrar">
        <button className={`chip ${soloDeudores ? 'activo' : ''}`} onClick={() => setSoloDeudores(true)}>Los que deben</button>
        <button className={`chip ${!soloDeudores ? 'activo' : ''}`} onClick={() => setSoloDeudores(false)}>Todos</button>
      </div>

      <div className="tarjeta lista">
        {!clientes && <div className="cargando">Cargando…</div>}
        {clientes && lista.length === 0 && (
          <div className="vacio">{clientes.length === 0 ? 'Todavía no hay clientes. Se crean desde acá o al cobrar “Fiado” en la caja.' : 'Nadie debe nada'}</div>
        )}
        {lista.map(c => (
          <button className="fila" key={c.id} onClick={() => setAbierto(c)}>
            <span style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
              <span className="avatar">{iniciales(c.apodo || c.nombre)}</span>
              <span className="col">
                <span className="nombre">{nombreCliente(c)}</span>
                <span className="detalle">{c.dni ? `DNI ${c.dni} · ` : ''}{c.ultimo_movimiento ? `Último movimiento: ${fechaCorta(c.ultimo_movimiento)}` : 'Sin movimientos'}</span>
              </span>
            </span>
            <span className={Number(c.saldo) > 0 ? 'saldo-deuda' : 'saldo-ok'}>{Number(c.saldo) > 0 ? `Debe ${pesos(c.saldo)}` : 'Al día'}</span>
          </button>
        ))}
      </div>

      {abierto && <Cuenta cliente={abierto} onCerrar={() => setAbierto(null)} onCambio={cargar} />}
      {nuevo && <ClienteForm onCerrar={() => setNuevo(false)} onListo={() => { setNuevo(false); cargar() }} />}
    </div>
  )
}

function Cuenta({ cliente, onCerrar, onCambio }) {
  const aviso = useAviso()
  const { nombreDe } = usePerfil()
  const [movs, setMovs] = useState(null)
  const [monto, setMonto] = useState('')
  const [tipo, setTipo] = useState('pago')
  const [nota, setNota] = useState('')
  const [editar, setEditar] = useState(false)

  async function cargar() {
    const { data, error } = await supabase.from('fiado_movimientos').select('*')
      .eq('cliente_id', cliente.id).order('fecha', { ascending: false }).limit(100)
    if (error) { aviso(mensajeError(error), 'error'); return }
    setMovs(data)
  }
  useEffect(() => { cargar() }, [cliente.id])

  const saldo = (movs || []).reduce((s, m) => s + (m.tipo === 'compra' ? 1 : -1) * Number(m.monto), 0)

  async function registrar(e) {
    e.preventDefault()
    const n = aNumero(monto)
    if (!(n > 0)) return
    const { error } = await supabase.from('fiado_movimientos').insert({
      cliente_id: cliente.id, tipo, monto: n, nota: nota.trim() || (tipo === 'pago' ? 'Pago' : 'Anotado a mano')
    })
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso(tipo === 'pago' ? `Pago de ${pesos(n)} registrado` : `Se anotaron ${pesos(n)}`, 'ok')
    setMonto(''); setNota('')
    cargar(); onCambio()
  }

  async function borrarMov(m) {
    if (m.venta_id) { aviso('Ese fiado viene de una venta: anulá la venta desde Ventas', 'error'); return }
    if (!confirm(`¿Borrar este movimiento de ${pesos(m.monto)}?`)) return
    const { error } = await supabase.from('fiado_movimientos').delete().eq('id', m.id)
    if (error) { aviso(mensajeError(error), 'error'); return }
    cargar(); onCambio()
  }

  const wsp = cliente.telefono && saldo > 0
    ? `https://wa.me/${cliente.telefono}?text=${encodeURIComponent(`Hola ${cliente.nombre}! Te paso el saldo de tu cuenta en Despensa Mi-Ma: ${pesos(saldo)}. Gracias!`)}`
    : null

  async function archivar() {
    if (saldo > 0 && !confirm(`${cliente.nombre} todavía debe ${pesos(saldo)}. ¿Ocultarlo igual?`)) return
    if (saldo <= 0 && !confirm(`¿Ocultar a ${cliente.nombre} de la lista?`)) return
    const { error } = await supabase.from('clientes').update({ activo: false }).eq('id', cliente.id)
    if (error) { aviso(mensajeError(error), 'error'); return }
    onCambio(); onCerrar()
  }

  if (editar) {
    return <ClienteForm cliente={cliente} onArchivar={archivar} onCerrar={() => setEditar(false)}
      onListo={() => { setEditar(false); onCambio(); onCerrar() }} />
  }

  return (
    <Modal titulo={nombreCliente(cliente)} onCerrar={onCerrar}>
      {(cliente.dni || cliente.telefono || cliente.notas) && (
        <div style={{ fontSize: 14, color: 'var(--apagado)' }}>
          {[cliente.dni && `DNI ${cliente.dni}`, cliente.telefono && `WhatsApp ${cliente.telefono}`, cliente.notas].filter(Boolean).join(' · ')}
        </div>
      )}
      <div className="tarjeta kpi" style={saldo > 0 ? { borderColor: 'var(--error)' } : undefined}>
        <span className="etiqueta">Saldo</span>
        <strong className={saldo > 0 ? 'saldo-deuda' : 'saldo-ok'}>{saldo > 0 ? `Debe ${pesos(saldo)}` : 'Al día'}</strong>
      </div>

      <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={registrar}>
        <div className="pago" style={{ gridTemplateColumns: '1fr 1fr' }} role="group" aria-label="Tipo de movimiento">
          <button type="button" className={tipo === 'pago' ? 'activo' : ''} onClick={() => setTipo('pago')}>Pagó</button>
          <button type="button" className={tipo === 'compra' ? 'activo' : ''} onClick={() => setTipo('compra')}>Llevó (anotar)</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" inputMode="decimal" placeholder="Monto" aria-label="Monto" required value={monto} onChange={e => setMonto(e.target.value)} />
          <button className="btn btn-primario">Guardar</button>
        </div>
        <input className="input" placeholder="Nota (opcional)" aria-label="Nota" value={nota} onChange={e => setNota(e.target.value)} />
      </form>

      <div className="tarjeta lista" style={{ maxHeight: 300, overflowY: 'auto' }}>
        {!movs && <div className="cargando">Cargando…</div>}
        {movs && movs.length === 0 && <div className="vacio">Sin movimientos</div>}
        {movs?.map(m => (
          <div className="fila" key={m.id}>
            <span className="col">
              <span className="nombre">{m.tipo === 'pago' ? 'Pagó' : 'Llevó'} · {pesos(m.monto)}</span>
              <span className="detalle">{fechaCorta(m.fecha)} · {nombreDe(m.usuario_id)}{m.nota ? ` · ${m.nota}` : ''}</span>
            </span>
            {!m.venta_id && <button className="btn btn-chico btn-peligro" onClick={() => borrarMov(m)}>Borrar</button>}
          </div>
        ))}
      </div>

      <div className="acciones" style={{ justifyContent: 'space-between' }}>
        <button className="btn" onClick={() => setEditar(true)}>Editar cliente</button>
        {wsp && <a className="btn btn-ok" href={wsp} target="_blank" rel="noreferrer">Mandar saldo por WhatsApp</a>}
      </div>
    </Modal>
  )
}
