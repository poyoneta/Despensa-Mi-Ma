import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { traerTodo, mensajeError } from '../lib/datos.js'
import { METODOS, aNumero, hora, hoyTexto, nombreCliente, nombreMetodo, pesos, rangoDia } from '../lib/formato.js'
import { useAviso } from '../components/Toast.jsx'
import { usePerfil } from '../components/Perfil.jsx'
import FiltroPersona from '../components/FiltroPersona.jsx'
import Modal from '../components/Modal.jsx'

export default function Ventas() {
  const aviso = useAviso()
  const { perfiles, nombreDe } = usePerfil()
  const [dia, setDia] = useState(hoyTexto())
  const [persona, setPersona] = useState(null)
  const [ventas, setVentas] = useState(null)
  const [cierres, setCierres] = useState([])
  const [cobros, setCobros] = useState([]) // pagos de fiado del día (entra plata a la caja)
  const [abierta, setAbierta] = useState(null)
  const [cerrando, setCerrando] = useState(false)

  async function cargar() {
    try {
      const [desde, hasta] = rangoDia(dia)
      const [v, c, f] = await Promise.all([
        traerTodo(() => supabase.from('ventas')
          .select('*, clientes(nombre, apellido, apodo, dni), venta_items(nombre, cantidad, precio_unitario, subtotal)')
          .gte('fecha', desde).lt('fecha', hasta).order('fecha', { ascending: false })),
        supabase.from('cierres_caja').select('*').eq('dia', dia).order('creado_en', { ascending: false }),
        supabase.from('fiado_movimientos').select('monto, usuario_id').eq('tipo', 'pago').gte('fecha', desde).lt('fecha', hasta)
      ])
      if (c.error) throw c.error
      if (f.error) throw f.error
      setVentas(v); setCierres(c.data); setCobros(f.data)
    } catch (e) { aviso(mensajeError(e), 'error'); setVentas([]) }
  }
  useEffect(() => { setVentas(null); cargar() }, [dia])

  const filtradas = useMemo(
    () => (ventas || []).filter(v => persona === null || v.usuario_id === persona),
    [ventas, persona]
  )
  const validas = filtradas.filter(v => !v.anulada)
  const total = validas.reduce((s, v) => s + Number(v.total), 0)

  // resumen por persona (siempre de todas las ventas del día, no del filtro)
  const resumen = useMemo(() => calcularResumen((ventas || []).filter(v => !v.anulada), cobros, perfiles), [ventas, cobros, perfiles])

  async function anular(v) {
    const motivo = prompt(`¿Por qué anulás la venta de ${pesos(v.total)} de las ${hora(v.fecha)}?\n(Se devuelve el stock)`)
    if (motivo === null) return
    const { error } = await supabase.rpc('anular_venta', { p_venta_id: v.id, p_motivo: motivo || null })
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso('Venta anulada, stock devuelto', 'ok')
    cargar()
  }

  const esHoy = dia === hoyTexto()

  return (
    <div className="pagina">
      <div className="encabezado">
        <h1>Ventas</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="v-dia" className="etiqueta" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Día</label>
          <input id="v-dia" type="date" className="input" style={{ width: 'auto' }} max={hoyTexto()} value={dia} onChange={e => e.target.value && setDia(e.target.value)} />
          <button className="btn btn-primario" onClick={() => setCerrando(true)} disabled={!ventas}>Cerrar caja</button>
        </div>
      </div>

      {/* Resumen: cada uno por separado y los dos juntos */}
      <div className="tarjeta tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>{esHoy ? 'Hoy' : dia.split('-').reverse().join('/')}</th>
              {METODOS.map(m => <th key={m.id} className="num">{m.corto}</th>)}
              <th className="num">Ventas</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {resumen.filas.map(f => (
              <tr key={f.id}>
                <td>{f.nombre}</td>
                {METODOS.map(m => <td key={m.id} className="num">{pesos(f.metodos[m.id])}</td>)}
                <td className="num">{f.cantidad}</td>
                <td className="num"><strong>{pesos(f.total)}</strong></td>
              </tr>
            ))}
            <tr className="total">
              <td>Los dos juntos</td>
              {METODOS.map(m => <td key={m.id} className="num">{pesos(resumen.juntos.metodos[m.id])}</td>)}
              <td className="num">{resumen.juntos.cantidad}</td>
              <td className="num">{pesos(resumen.juntos.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {resumen.juntos.cobros > 0 && (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--apagado)' }}>
          Además cobraron {pesos(resumen.juntos.cobros)} de fiado
          {resumen.filas.filter(f => f.cobros > 0).length > 1 && ` (${resumen.filas.filter(f => f.cobros > 0).map(f => `${f.nombre} ${pesos(f.cobros)}`).join(' · ')})`}.
        </p>
      )}

      {cierres.length > 0 && (
        <div className="tarjeta lista">
          {cierres.map(c => (
            <div className="fila" key={c.id}>
              <div className="col">
                <span className="nombre">Caja cerrada {c.de_usuario ? `de ${nombreDe(c.de_usuario)}` : '(los dos juntos)'}</span>
                <span className="detalle">
                  A las {hora(c.creado_en)} por {nombreDe(c.usuario_id)} · efectivo esperado {pesos(c.efectivo_esperado)}
                  {c.efectivo_contado !== null && ` · contado ${pesos(c.efectivo_contado)}`}
                  {c.notas && ` · ${c.notas}`}
                </span>
              </div>
              {c.diferencia !== null && (
                <span className={`pastilla ${Number(c.diferencia) === 0 ? 'pastilla-ok' : Number(c.diferencia) < 0 ? 'pastilla-error' : 'pastilla-aviso'}`}>
                  {Number(c.diferencia) === 0 ? 'Cerró justo' : `${Number(c.diferencia) > 0 ? 'Sobra' : 'Falta'} ${pesos(Math.abs(c.diferencia))}`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <FiltroPersona valor={persona} onCambio={setPersona} />

      <div className="encabezado">
        <h2>{validas.length} {validas.length === 1 ? 'venta' : 'ventas'} · {pesos(total)}</h2>
      </div>

      <div className="tarjeta lista">
        {!ventas && <div className="cargando">Cargando…</div>}
        {ventas && filtradas.length === 0 && <div className="vacio">No hay ventas {esHoy ? 'hoy' : 'ese día'}{persona ? ` de ${nombreDe(persona)}` : ''}</div>}
        {filtradas.map(v => (
          <div key={v.id} className={v.anulada ? 'venta-anulada' : ''} style={{ borderBottom: '1px solid #EEF0F3' }}>
            <button className="fila" style={{ borderBottom: 'none' }} onClick={() => setAbierta(abierta === v.id ? null : v.id)} aria-expanded={abierta === v.id}>
              <span className="col">
                <span className="nombre">{hora(v.fecha)} · {nombreDe(v.usuario_id)}</span>
                <span className="detalle">
                  {nombreMetodo(v.metodo_pago)}{v.clientes ? ` · ${nombreCliente(v.clientes)}` : ''} · {v.venta_items.length} {v.venta_items.length === 1 ? 'ítem' : 'ítems'}
                  {v.anulada && ` · ANULADA${v.motivo_anulacion ? `: ${v.motivo_anulacion}` : ''}`}
                </span>
              </span>
              <span className="precio">{pesos(v.total)}</span>
            </button>
            {abierta === v.id && (
              <div className="items-venta" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>{v.venta_items.map(i => `${i.cantidad} × ${i.nombre} (${pesos(i.subtotal)})`).join(' · ')}</div>
                {v.anulada
                  ? <span>Anulada por {nombreDe(v.anulada_por)} a las {hora(v.anulada_en)}</span>
                  : <button className="btn btn-chico btn-peligro" style={{ alignSelf: 'flex-start' }} onClick={() => anular(v)}>Anular venta</button>}
              </div>
            )}
          </div>
        ))}
      </div>

      {cerrando && (
        <CierreCaja dia={dia} resumen={resumen} onCerrar={() => setCerrando(false)} onListo={() => { setCerrando(false); cargar() }} />
      )}
    </div>
  )
}

function calcularResumen(ventas, cobros, perfiles) {
  const vacio = () => ({ metodos: Object.fromEntries(METODOS.map(m => [m.id, 0])), cantidad: 0, total: 0, cobros: 0 })
  const porId = {}
  const juntos = vacio()
  for (const c of cobros) {
    const r = porId[c.usuario_id] || (porId[c.usuario_id] = vacio())
    r.cobros += Number(c.monto)
    juntos.cobros += Number(c.monto)
  }
  for (const v of ventas) {
    const t = Number(v.total)
    const r = porId[v.usuario_id] || (porId[v.usuario_id] = vacio())
    for (const x of [r, juntos]) {
      x.metodos[v.metodo_pago] = (x.metodos[v.metodo_pago] || 0) + t
      x.cantidad += 1
      x.total += t
    }
  }
  const filas = perfiles.map(p => ({ id: p.id, nombre: p.nombre, ...(porId[p.id] || vacio()) }))
  // ventas de usuarios sin nombre (por ejemplo, de antes de la actualización)
  const otros = Object.keys(porId).filter(id => !perfiles.some(p => p.id === id))
  if (otros.length) {
    const o = vacio()
    for (const id of otros) {
      for (const m of METODOS) o.metodos[m.id] += porId[id].metodos[m.id]
      o.cantidad += porId[id].cantidad
      o.total += porId[id].total
      o.cobros += porId[id].cobros
    }
    filas.push({ id: 'otros', nombre: 'Sin nombre', ...o })
  }
  return { filas, juntos, porId }
}

function CierreCaja({ dia, resumen, onCerrar, onListo }) {
  const aviso = useAviso()
  const { perfiles } = usePerfil()
  const [de, setDe] = useState('juntos')
  const [contado, setContado] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  const datos = de === 'juntos' ? resumen.juntos : (resumen.porId[de] || { metodos: {}, total: 0, cantidad: 0, cobros: 0 })
  // efectivo de las ventas + lo que pagaron del fiado (se supone en efectivo)
  const esperado = (datos.metodos.efectivo || 0) + (datos.cobros || 0)
  const numContado = contado === '' ? null : aNumero(contado)
  const diferencia = numContado === null || Number.isNaN(numContado) ? null : numContado - esperado

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase.from('cierres_caja').insert({
      dia,
      de_usuario: de === 'juntos' ? null : de,
      total_ventas: datos.total,
      efectivo_esperado: esperado,
      efectivo_contado: numContado,
      diferencia,
      notas: notas.trim() || null
    })
    setGuardando(false)
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso('Cierre de caja guardado', 'ok')
    onListo()
  }

  return (
    <Modal titulo="Cerrar caja" onCerrar={onCerrar}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={guardar}>
        {perfiles.length > 1 && (
          <div className="chips" role="group" aria-label="Cierre de">
            <button type="button" className={`chip ${de === 'juntos' ? 'activo' : ''}`} onClick={() => setDe('juntos')}>Los dos juntos</button>
            {perfiles.map(p => (
              <button type="button" key={p.id} className={`chip ${de === p.id ? 'activo' : ''}`} onClick={() => setDe(p.id)}>Solo {p.nombre}</button>
            ))}
          </div>
        )}

        <div className="tarjeta lista">
          {METODOS.map(m => (
            <div className="fila" key={m.id}><span>{m.nombre}</span><strong>{pesos(datos.metodos[m.id])}</strong></div>
          ))}
          <div className="fila"><span className="nombre">Total vendido ({datos.cantidad} ventas)</span><strong>{pesos(datos.total)}</strong></div>
          {datos.cobros > 0 && <div className="fila"><span>Cobros de fiado (efectivo)</span><strong>{pesos(datos.cobros)}</strong></div>}
        </div>

        <div className="campo">
          <label htmlFor="c-contado">¿Cuánta plata en efectivo hay en la caja? (tiene que haber {pesos(esperado)})</label>
          <input id="c-contado" className="input" inputMode="decimal" placeholder="Contá y escribilo acá" autoFocus
            value={contado} onChange={e => setContado(e.target.value)} />
        </div>
        {diferencia !== null && (
          <div className={`pastilla ${diferencia === 0 ? 'pastilla-ok' : diferencia < 0 ? 'pastilla-error' : 'pastilla-aviso'}`} style={{ alignSelf: 'flex-start', fontSize: 15 }}>
            {diferencia === 0 ? 'Cierra justo' : `${diferencia > 0 ? 'Sobran' : 'Faltan'} ${pesos(Math.abs(diferencia))}`}
          </div>
        )}
        <div className="campo">
          <label htmlFor="c-notas">Notas (opcional)</label>
          <input id="c-notas" className="input" placeholder="Ej: saqué $5000 para el proveedor" value={notas} onChange={e => setNotas(e.target.value)} />
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--apagado)' }}>
          El efectivo esperado no incluye el cambio con el que arrancaron el día: si dejan cambio en la caja, restalo antes de contar.
        </p>
        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cierre'}</button>
        </div>
      </form>
    </Modal>
  )
}
