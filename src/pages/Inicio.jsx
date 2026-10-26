import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { traerProductos, traerTodo, mensajeError } from '../lib/datos.js'
import { DIAS, METODOS, bajoStock, estadoStock, fechaLarga, inicioDeHoy, pesos } from '../lib/formato.js'
import { usePerfil } from '../components/Perfil.jsx'
import { IconoEscanear } from '../components/Iconos.jsx'

export default function Inicio() {
  const { yo, perfiles } = usePerfil()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      try {
        const hoy = inicioDeHoy()
        const [ventas, items, productos, proveedores] = await Promise.all([
          traerTodo(() => supabase.from('ventas').select('total, metodo_pago, usuario_id')
            .gte('fecha', hoy).eq('anulada', false)),
          traerTodo(() => supabase.from('venta_items').select('nombre, cantidad, ventas!inner(fecha, anulada)')
            .gte('ventas.fecha', hoy).eq('ventas.anulada', false)),
          traerProductos(),
          supabase.from('proveedores').select('id, nombre, dia_visita')
        ])
        if (proveedores.error) throw proveedores.error

        // total, por forma de pago y por persona
        const porMetodo = Object.fromEntries(METODOS.map(m => [m.id, 0]))
        const porPersona = {}
        let total = 0
        for (const v of ventas) {
          const t = Number(v.total)
          total += t
          porMetodo[v.metodo_pago] = (porMetodo[v.metodo_pago] || 0) + t
          porPersona[v.usuario_id] = (porPersona[v.usuario_id] || 0) + t
        }

        // producto más vendido del día
        const cuenta = {}
        for (const it of items) cuenta[it.nombre] = (cuenta[it.nombre] || 0) + it.cantidad
        const masVendido = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0]

        // proveedor que pasa mañana (o hoy)
        const dHoy = new Date().getDay()
        const manana = proveedores.data.find(p => p.dia_visita === DIAS[(dHoy + 1) % 7])
        const deHoy = proveedores.data.find(p => p.dia_visita === DIAS[dHoy])

        setDatos({
          total,
          cantidadVentas: ventas.length,
          porMetodo,
          porPersona,
          masVendido,
          proximo: manana ? { nombre: manana.nombre, cuando: 'Pasa mañana' }
            : deHoy ? { nombre: deHoy.nombre, cuando: 'Pasa hoy' } : null,
          reponer: productos.filter(bajoStock).sort((a, b) => a.stock - b.stock).slice(0, 6),
          cantidadReponer: productos.filter(bajoStock).length
        })
      } catch (e) {
        setError(mensajeError(e))
      }
    }
    cargar()
  }, [])

  const metodosVisibles = datos ? METODOS.filter(m => !['fiado', 'mercadopago'].includes(m.id) || datos.porMetodo[m.id] > 0) : []

  return (
    <div className="pagina">
      <div className="encabezado">
        <div>
          <div className="sub">{fechaLarga()}</div>
          <h1 className="titulo-marca">Hola, {yo.nombre}</h1>
        </div>
      </div>

      {error && <div className="tarjeta tarjeta-pad error-txt">{error}</div>}
      {!datos && !error && <div className="cargando">Cargando…</div>}

      {datos && (
        <div className="inicio-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <section className="ventas-hoy" aria-label="Ventas de hoy">
              <span className="chico">Ventas de hoy · los dos juntos</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span className="monto">{pesos(datos.total)}</span>
                <span className="chico">{datos.cantidadVentas} {datos.cantidadVentas === 1 ? 'venta' : 'ventas'}</span>
              </div>
              <div className="metodos" style={{ gridTemplateColumns: `repeat(${Math.min(metodosVisibles.length, 3)}, minmax(0, 1fr))` }}>
                {metodosVisibles.map(m => (
                  <div key={m.id}><span>{m.corto}</span><span>{pesos(datos.porMetodo[m.id])}</span></div>
                ))}
              </div>
              {perfiles.length > 1 && (
                <div className="metodos" style={{ gridTemplateColumns: `repeat(${perfiles.length}, minmax(0, 1fr))` }}>
                  {perfiles.map(p => (
                    <div key={p.id}><span>Vendió {p.nombre}</span><span>{pesos(datos.porPersona[p.id])}</span></div>
                  ))}
                </div>
              )}
            </section>

            <Link to="/caja" className="btn btn-primario btn-grande"><IconoEscanear />Nueva venta</Link>

            <div className="mini">
              <div className="tarjeta">
                <span className="etiqueta">Más vendido hoy</span>
                <strong>{datos.masVendido ? datos.masVendido[0] : 'Todavía nada'}</strong>
              </div>
              <div className="tarjeta">
                <span className="etiqueta">{datos.proximo ? datos.proximo.cuando : 'Proveedores'}</span>
                <strong>{datos.proximo ? datos.proximo.nombre : 'Nadie pasa mañana'}</strong>
              </div>
            </div>
            <Link to="/ventas" className="btn">Ver ventas y cerrar caja</Link>
          </div>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="encabezado">
              <h2>Para reponer {datos.cantidadReponer > 0 && `(${datos.cantidadReponer})`}</h2>
              <Link to="/proveedores" style={{ fontWeight: 700, textDecoration: 'none' }}>Armar pedido</Link>
            </div>
            <div className="tarjeta lista">
              {datos.reponer.length === 0 && <div className="vacio">Todo en orden, no falta nada</div>}
              {datos.reponer.map(p => {
                const est = estadoStock(p)
                return (
                  <div className="fila" key={p.id}>
                    <div className="col">
                      <span className="nombre">{p.nombre}</span>
                      <span className="detalle">Mínimo {p.stock_minimo}{p.proveedores ? ` · ${p.proveedores.nombre}` : ''}</span>
                    </div>
                    {est && <span className={`pastilla ${est.clase}`}>{est.texto}</span>}
                  </div>
                )
              })}
            </div>
            {datos.cantidadReponer > datos.reponer.length && (
              <Link to="/stock?filtro=bajo" style={{ fontWeight: 700 }}>Ver todos los que faltan</Link>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
