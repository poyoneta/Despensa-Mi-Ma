import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { traerTodo, mensajeError } from '../lib/datos.js'
import { METODOS, hoyTexto, pesos } from '../lib/formato.js'
import { useAviso } from '../components/Toast.jsx'
import { usePerfil } from '../components/Perfil.jsx'
import FiltroPersona from '../components/FiltroPersona.jsx'

const PERIODOS = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: '7', nombre: 'Últimos 7 días' },
  { id: 'mes', nombre: 'Este mes' },
  { id: 'mesPasado', nombre: 'Mes pasado' },
  { id: '30', nombre: 'Últimos 30 días' }
]

// Solo cuenta ganancia si el producto tenía precio de costo cargado
function gananciaItem(i) {
  const costo = Number(i.precio_costo)
  return costo > 0 ? Number(i.subtotal) - costo * i.cantidad : 0
}

function rangoPeriodo(id) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)
  if (id === 'hoy') return [hoy, manana]
  if (id === '7' || id === '30') {
    const d = new Date(hoy); d.setDate(d.getDate() - (Number(id) - 1))
    return [d, manana]
  }
  if (id === 'mes') return [new Date(hoy.getFullYear(), hoy.getMonth(), 1), manana]
  return [new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), new Date(hoy.getFullYear(), hoy.getMonth(), 1)]
}

export default function Reportes() {
  const aviso = useAviso()
  const { perfiles, nombreDe } = usePerfil()
  const [periodo, setPeriodo] = useState('7')
  const [persona, setPersona] = useState(null)
  const [ventas, setVentas] = useState(null)

  useEffect(() => {
    async function cargar() {
      setVentas(null)
      try {
        const [desde, hasta] = rangoPeriodo(periodo)
        setVentas(await traerTodo(() => supabase.from('ventas')
          .select('id, fecha, total, metodo_pago, usuario_id, venta_items(nombre, cantidad, subtotal, precio_costo)')
          .eq('anulada', false).gte('fecha', desde.toISOString()).lt('fecha', hasta.toISOString())
          .order('fecha')))
      } catch (e) { aviso(mensajeError(e), 'error'); setVentas([]) }
    }
    cargar()
  }, [periodo])

  const r = useMemo(() => {
    if (!ventas) return null
    const lista = ventas.filter(v => persona === null || v.usuario_id === persona)
    let total = 0, ganancia = 0
    const porDia = {}, porProducto = {}, porMetodo = {}, porPersona = {}

    // días del período (para que aparezcan también los días sin ventas)
    const [desde, hasta] = rangoPeriodo(periodo)
    for (let d = new Date(desde); d < hasta; d.setDate(d.getDate() + 1)) porDia[hoyTexto(d)] = 0

    for (const v of ventas) {
      const p = porPersona[v.usuario_id] || (porPersona[v.usuario_id] = { total: 0, cantidad: 0, ganancia: 0 })
      p.total += Number(v.total); p.cantidad += 1
      for (const i of v.venta_items) p.ganancia += gananciaItem(i)
    }
    for (const v of lista) {
      const t = Number(v.total)
      total += t
      const dia = hoyTexto(new Date(v.fecha))
      porDia[dia] = (porDia[dia] || 0) + t
      porMetodo[v.metodo_pago] = (porMetodo[v.metodo_pago] || 0) + t
      for (const i of v.venta_items) {
        const g = gananciaItem(i)
        ganancia += g
        const x = porProducto[i.nombre] || (porProducto[i.nombre] = { nombre: i.nombre, cantidad: 0, total: 0, ganancia: 0, sinCosto: false })
        x.cantidad += i.cantidad
        x.total += Number(i.subtotal)
        x.ganancia += g
        if (Number(i.precio_costo) === 0) x.sinCosto = true
      }
    }
    const dias = Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b))
    const max = Math.max(1, ...dias.map(([, t]) => t))
    return {
      total, cantidad: lista.length, ganancia,
      promedio: lista.length ? total / lista.length : 0,
      dias, max, porMetodo, porPersona,
      top: Object.values(porProducto).sort((a, b) => b.total - a.total).slice(0, 15)
    }
  }, [ventas, persona, periodo])

  const juntos = r ? Object.values(r.porPersona).reduce((s, p) => ({ total: s.total + p.total, cantidad: s.cantidad + p.cantidad, ganancia: s.ganancia + p.ganancia }), { total: 0, cantidad: 0, ganancia: 0 }) : null
  const idsPersonas = r ? [...perfiles.map(p => p.id), ...Object.keys(r.porPersona).filter(id => !perfiles.some(p => p.id === id))] : []

  return (
    <div className="pagina">
      <h1>Reportes</h1>

      <div className="chips" role="group" aria-label="Período">
        {PERIODOS.map(p => (
          <button key={p.id} className={`chip ${periodo === p.id ? 'activo' : ''}`} onClick={() => setPeriodo(p.id)}>{p.nombre}</button>
        ))}
      </div>

      {!r && <div className="cargando">Cargando…</div>}
      {r && (
        <>
          {/* Cada uno por separado y los dos juntos */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2>Por persona</h2>
            <div className="tarjeta tabla-wrap">
              <table className="tabla">
                <thead><tr><th>Quién</th><th className="num">Ventas</th><th className="num">Vendido</th><th className="num">Ganancia aprox.</th></tr></thead>
                <tbody>
                  {idsPersonas.map(id => {
                    const p = r.porPersona[id] || { total: 0, cantidad: 0, ganancia: 0 }
                    return (
                      <tr key={id}>
                        <td>{nombreDe(id)}</td>
                        <td className="num">{p.cantidad}</td>
                        <td className="num">{pesos(p.total)}</td>
                        <td className="num">{pesos(p.ganancia)}</td>
                      </tr>
                    )
                  })}
                  <tr className="total">
                    <td>Los dos juntos</td>
                    <td className="num">{juntos.cantidad}</td>
                    <td className="num">{pesos(juntos.total)}</td>
                    <td className="num">{pesos(juntos.ganancia)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <FiltroPersona valor={persona} onCambio={setPersona} />

          <div className="kpis">
            <div className="tarjeta kpi destacado"><span className="etiqueta">Vendido</span><strong>{pesos(r.total)}</strong></div>
            <div className="tarjeta kpi"><span className="etiqueta">Ganancia aprox.</span><strong>{pesos(r.ganancia)}</strong></div>
            <div className="tarjeta kpi"><span className="etiqueta">Ventas</span><strong>{r.cantidad}</strong></div>
            <div className="tarjeta kpi"><span className="etiqueta">Ticket promedio</span><strong>{pesos(Math.round(r.promedio))}</strong></div>
          </div>

          {r.dias.length > 1 && (
            <section className="tarjeta tarjeta-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h2>Ventas por día</h2>
              <div className="barras" role="img" aria-label="Gráfico de ventas por día">
                {r.dias.map(([dia, t]) => (
                  <div className="barra" key={dia} title={`${dia.split('-').reverse().join('/')}: ${pesos(t)}`}>
                    <div style={{ height: `${(t / r.max) * 100}%` }} />
                    <span>{Number(dia.slice(8))}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2>Por forma de pago</h2>
            <div className="kpis">
              {METODOS.map(m => (
                <div className="tarjeta kpi" key={m.id}><span className="etiqueta">{m.nombre}</span><strong>{pesos(r.porMetodo[m.id])}</strong></div>
              ))}
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2>Productos más vendidos</h2>
            <div className="tarjeta tabla-wrap">
              <table className="tabla">
                <thead><tr><th>Producto</th><th className="num">Unidades</th><th className="num">Vendido</th><th className="num">Ganancia</th></tr></thead>
                <tbody>
                  {r.top.length === 0 && <tr><td colSpan="4" className="vacio">No hay ventas en este período</td></tr>}
                  {r.top.map(p => (
                    <tr key={p.nombre}>
                      <td>{p.nombre}</td>
                      <td className="num">{p.cantidad}</td>
                      <td className="num">{pesos(p.total)}</td>
                      <td className="num">{p.sinCosto ? '—' : pesos(p.ganancia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--apagado)' }}>
              La ganancia se calcula solo con los productos que tienen precio de costo cargado. “—” = sin costo cargado o venta de precio libre.
              Las ventas de antes de esta actualización no tienen el costo guardado, así que no suman ganancia.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
