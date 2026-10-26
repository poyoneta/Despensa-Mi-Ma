import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { mensajeError } from '../lib/datos.js'
import { mercadoPago, describirCobro } from '../lib/mercadopago.js'
import { fechaCorta, hoyTexto, hora, inicioDeHoy, nombreCliente, nombreMetodo, pesos, rangoDia } from '../lib/formato.js'
import { useAviso } from '../components/Toast.jsx'
import { ElegirCliente } from '../components/Clientes.jsx'
import Modal from '../components/Modal.jsx'

export default function MercadoPago() {
  const aviso = useAviso()
  const [config, setConfig] = useState(null)   // { token, cuenta, caja } o { error }
  const [cobros, setCobros] = useState(null)
  const [dias, setDias] = useState(3)
  const [sincronizando, setSincronizando] = useState(false)
  const [registrar, setRegistrar] = useState(null)
  const [vincular, setVincular] = useState(null)

  async function cargarConfig() {
    try { setConfig(await mercadoPago('estado_config')) } catch (e) { setConfig({ error: e.message }) }
  }

  async function cargarCobros() {
    const { data, error } = await supabase.from('cobros_mp')
      .select('*, ventas(id, total, metodo_pago, anulada, clientes(nombre, apellido, apodo))')
      .order('fecha', { ascending: false }).limit(300)
    if (error) { aviso(mensajeError(error), 'error'); setCobros([]); return }
    setCobros(data)
  }

  async function sincronizar(silencioso = false) {
    setSincronizando(true)
    try {
      const r = await mercadoPago('sincronizar', { dias })
      if (!silencioso) aviso(`Listo: ${r.cantidad} cobros revisados${r.vinculados ? `, ${r.vinculados} unidos a ventas del QR` : ''}${r.clientes ? `, ${r.clientes} con cliente nuevo` : ''}`, 'ok')
      await cargarCobros()
    } catch (e) {
      if (!silencioso) aviso(e.message, 'error')
    } finally {
      setSincronizando(false)
    }
  }

  useEffect(() => { cargarConfig(); cargarCobros() }, [])
  // al entrar, si está todo configurado, trae lo nuevo solo
  useEffect(() => { if (config?.caja) sincronizar(true) }, [config?.caja?.id])

  const hoy = inicioDeHoy()
  const deHoy = (cobros || []).filter(c => new Date(c.fecha) >= new Date(hoy))
  const recibidoHoy = deHoy.reduce((s, c) => s + Number(c.monto), 0)
  const sinRegistrar = (cobros || []).filter(c => !c.venta_id)

  return (
    <div className="pagina">
      <div className="encabezado">
        <h1>Mercado Pago</h1>
        {config?.caja && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="input" style={{ width: 'auto' }} aria-label="Días a traer" value={dias} onChange={e => setDias(Number(e.target.value))}>
              <option value={1}>Último día</option>
              <option value={3}>Últimos 3 días</option>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>
            <button className="btn btn-primario" disabled={sincronizando} onClick={() => sincronizar()}>
              {sincronizando ? 'Trayendo…' : 'Actualizar'}
            </button>
          </div>
        )}
      </div>

      <Configuracion config={config} onCambio={cargarConfig} />

      {config?.caja && (
        <>
          <div className="kpis">
            <div className="tarjeta kpi destacado"><span className="etiqueta">Entró hoy a Mercado Pago</span><strong>{pesos(recibidoHoy)}</strong></div>
            <div className="tarjeta kpi"><span className="etiqueta">Cobros de hoy</span><strong>{deHoy.length}</strong></div>
            <div className="tarjeta kpi"><span className="etiqueta">Sin registrar como venta</span><strong>{sinRegistrar.length}</strong></div>
          </div>

          <div className="tarjeta lista">
            {!cobros && <div className="cargando">Cargando…</div>}
            {cobros && cobros.length === 0 && <div className="vacio">Todavía no hay cobros. Tocá “Actualizar” para traerlos.</div>}
            {cobros?.map(c => (
              <div className="fila" key={c.id} style={{ flexWrap: 'wrap' }}>
                <div className="col" style={{ flex: '1 1 220px' }}>
                  <span className="nombre">{pesos(c.monto)} · {describirCobro(c)}</span>
                  <span className="detalle">
                    {fechaCorta(c.fecha)}
                    {c.pagador_nombre && ` · ${c.pagador_nombre}`}
                    {c.pagador_doc && ` · DNI/CUIT ${c.pagador_doc}`}
                    {!c.pagador_nombre && c.pagador_email && ` · ${c.pagador_email}`}
                  </span>
                  {c.ventas && (
                    <span className="detalle">
                      Venta: {nombreMetodo(c.ventas.metodo_pago)} {pesos(c.ventas.total)}
                      {c.ventas.clientes && ` · ${nombreCliente(c.ventas.clientes)}`}
                      {c.ventas.anulada && ' · ANULADA'}
                    </span>
                  )}
                </div>
                {c.venta_id
                  ? <span className="pastilla pastilla-ok">Registrada</span>
                  : (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-chico" onClick={() => setVincular(c)}>Ya la cargué</button>
                      <button className="btn btn-chico btn-primario" onClick={() => setRegistrar(c)}>Registrar venta</button>
                    </span>
                  )}
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--apagado)' }}>
            Los cobros con el QR de la caja se registran solos. Las transferencias por alias o CVU aparecen acá para que las registres
            (o las unas a una venta que ya cargaste). Mercado Pago no siempre informa el nombre de quien transfirió.
          </p>
        </>
      )}

      {registrar && <RegistrarCobro cobro={registrar} onCerrar={() => setRegistrar(null)} onListo={() => { setRegistrar(null); cargarCobros() }} />}
      {vincular && <VincularCobro cobro={vincular} onCerrar={() => setVincular(null)} onListo={() => { setVincular(null); cargarCobros() }} />}
    </div>
  )
}

function Configuracion({ config, onCambio }) {
  const aviso = useAviso()
  const [f, setF] = useState({ nombre: 'Despensa Mi-Ma', calle: '', numero: '', ciudad: '', provincia: 'Córdoba', latitud: '', longitud: '' })
  const [enviando, setEnviando] = useState(false)
  const [listas, setListas] = useState({ provincias: [], ciudades: [], cargando: false })
  const cambiar = c => e => setF(v => ({ ...v, [c]: e.target.value }))
  const necesitaCaja = Boolean(config?.token && !config?.caja)

  // trae las provincias y ciudades con los nombres que acepta Mercado Pago
  useEffect(() => {
    if (!necesitaCaja || !f.provincia) return
    let vivo = true
    setListas(l => ({ ...l, cargando: true }))
    mercadoPago('ciudades', { provincia: f.provincia })
      .then(r => {
        if (!vivo) return
        setListas({ provincias: r.provincias || [], ciudades: r.ciudades || [], cargando: false })
        if (r.provincia && r.provincia !== f.provincia) setF(v => ({ ...v, provincia: r.provincia }))
      })
      .catch(() => vivo && setListas(l => ({ ...l, cargando: false })))
    return () => { vivo = false }
  }, [necesitaCaja, f.provincia])

  const ciudadValida = listas.ciudades.length === 0 || listas.ciudades.includes(f.ciudad)

  function ubicacion() {
    if (!navigator.geolocation) { aviso('Este navegador no da la ubicación', 'error'); return }
    navigator.geolocation.getCurrentPosition(
      pos => setF(v => ({ ...v, latitud: pos.coords.latitude.toFixed(6), longitud: pos.coords.longitude.toFixed(6) })),
      () => aviso('No se pudo obtener la ubicación', 'error')
    )
  }

  async function configurar(e) {
    e.preventDefault()
    if (!ciudadValida) { aviso('Elegí la ciudad de la lista (Mercado Pago solo acepta esos nombres)', 'error'); return }
    setEnviando(true)
    try {
      await mercadoPago('configurar', f)
      aviso('Caja de Mercado Pago lista', 'ok')
      onCambio()
    } catch (err) {
      aviso(err.message, 'error')
    } finally {
      setEnviando(false)
    }
  }

  if (!config) return <div className="cargando">Revisando la conexión con Mercado Pago…</div>

  if (config.error || !config.token) {
    return (
      <div className="tarjeta tarjeta-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2>Falta conectar Mercado Pago</h2>
        {config.error && <div className="error-txt">{config.error}</div>}
        <p style={{ margin: 0 }}>
          Seguí los pasos de la <strong>Actualización 3</strong> del README: publicar la función <code>mercadopago</code> en Supabase
          y cargar el secreto <code>MP_ACCESS_TOKEN</code> con el Access Token de la cuenta que cobra.
        </p>
      </div>
    )
  }

  if (!config.caja) {
    return (
      <form className="tarjeta tarjeta-pad form-grid" onSubmit={configurar}>
        <div className="ancho" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2>Último paso: crear la caja en Mercado Pago</h2>
          <span style={{ color: 'var(--apagado)', fontSize: 14 }}>
            Conectado a la cuenta de <strong>{config.cuenta?.nombre}</strong> ({config.cuenta?.email}). Mercado Pago pide la dirección del local.
          </span>
        </div>
        <div className="campo ancho"><label htmlFor="mp-nombre">Nombre del local</label><input id="mp-nombre" className="input" required value={f.nombre} onChange={cambiar('nombre')} /></div>
        <div className="campo"><label htmlFor="mp-calle">Calle</label><input id="mp-calle" className="input" required value={f.calle} onChange={cambiar('calle')} /></div>
        <div className="campo"><label htmlFor="mp-num">Número</label><input id="mp-num" className="input" required inputMode="numeric" value={f.numero} onChange={cambiar('numero')} /></div>
        <div className="campo">
          <label htmlFor="mp-prov">Provincia</label>
          {listas.provincias.length > 0 ? (
            <select id="mp-prov" className="input" required value={f.provincia} onChange={e => setF(v => ({ ...v, provincia: e.target.value, ciudad: '' }))}>
              {!listas.provincias.includes(f.provincia) && <option value={f.provincia}>{f.provincia}</option>}
              {listas.provincias.map(pr => <option key={pr} value={pr}>{pr}</option>)}
            </select>
          ) : (
            <input id="mp-prov" className="input" required value={f.provincia} onChange={cambiar('provincia')} />
          )}
        </div>
        <div className="campo">
          <label htmlFor="mp-ciudad">Ciudad {listas.cargando ? '(cargando lista…)' : listas.ciudades.length ? '(escribí y elegí de la lista)' : ''}</label>
          <input id="mp-ciudad" className="input" required list="mp-ciudades" autoComplete="off" value={f.ciudad} onChange={cambiar('ciudad')}
            style={!ciudadValida && f.ciudad ? { borderColor: 'var(--error)' } : undefined} />
          <datalist id="mp-ciudades">
            {listas.ciudades.map(c => <option key={c} value={c} />)}
          </datalist>
          {!ciudadValida && f.ciudad && (
            <span style={{ fontSize: 13, color: 'var(--error)', fontWeight: 600 }}>
              No está en la lista de Mercado Pago. Si tu pueblo no aparece, elegí la ciudad más cercana o la cabecera del departamento.
            </span>
          )}
        </div>
        <div className="campo"><label htmlFor="mp-lat">Latitud</label><input id="mp-lat" className="input" required inputMode="decimal" value={f.latitud} onChange={cambiar('latitud')} /></div>
        <div className="campo"><label htmlFor="mp-lng">Longitud</label><input id="mp-lng" className="input" required inputMode="decimal" value={f.longitud} onChange={cambiar('longitud')} /></div>
        <div className="acciones ancho" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn" onClick={ubicacion}>Usar mi ubicación (estando en el local)</button>
          <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Creando…' : 'Crear caja'}</button>
        </div>
      </form>
    )
  }

  return (
    <div className="tarjeta tarjeta-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span>
        <span className="pastilla pastilla-ok">Conectado</span>{' '}
        Cobrando en la cuenta de <strong>{config.cuenta?.nombre}</strong> · {config.caja.nombre}
      </span>
      {config.caja.qr && <a className="btn btn-chico" href={config.caja.qr} target="_blank" rel="noreferrer">QR fijo para imprimir</a>}
    </div>
  )
}

function RegistrarCobro({ cobro, onCerrar, onListo }) {
  const aviso = useAviso()
  const esTransferencia = describirCobro(cobro) === 'Transferencia'
  const [concepto, setConcepto] = useState(esTransferencia ? 'Venta por transferencia' : 'Venta Mercado Pago')
  const [cliente, setCliente] = useState(null)
  const [elegir, setElegir] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      const { data: ventaId, error } = await supabase.rpc('registrar_venta', {
        p_metodo: esTransferencia ? 'transferencia' : 'mercadopago',
        p_cliente_id: cliente ? cliente.id : null,
        p_mp_ref: null,
        p_items: [{ producto_id: null, nombre: concepto.trim() || 'Cobro Mercado Pago', precio: Number(cobro.monto), cantidad: 1 }]
      })
      if (error) throw error
      const { error: e2 } = await supabase.from('cobros_mp').update({ venta_id: ventaId }).eq('id', cobro.id)
      if (e2) throw e2
      aviso('Venta registrada', 'ok')
      onListo()
    } catch (err) {
      aviso(mensajeError(err), 'error')
    } finally {
      setGuardando(false)
    }
  }

  if (elegir) {
    return (
      <ElegirCliente
        inicial={{ nombre: cobro.pagador_nombre || '', dni: cobro.pagador_doc || '' }}
        onCerrar={() => setElegir(false)}
        onElegir={c => { setCliente(c); setElegir(false) }}
      />
    )
  }

  return (
    <Modal titulo={`Registrar ${pesos(cobro.monto)}`} onCerrar={onCerrar}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={guardar}>
        <p style={{ margin: 0, color: 'var(--apagado)', fontSize: 14 }}>
          Se guarda como venta de precio libre (no descuenta stock). Si querés descontar stock, cargá la venta en la caja y después usá “Ya la cargué”.
        </p>
        <div className="campo">
          <label htmlFor="rc-concepto">Qué compró</label>
          <input id="rc-concepto" className="input" value={concepto} onChange={e => setConcepto(e.target.value)} />
        </div>
        <div className="tarjeta tarjeta-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span>{cliente ? <>Cliente: <strong>{nombreCliente(cliente)}</strong></> : <span style={{ color: 'var(--apagado)' }}>Cliente (opcional){cobro.pagador_nombre ? ` · MP dice: ${cobro.pagador_nombre}` : ''}</span>}</span>
          <button type="button" className="btn btn-chico" onClick={() => setElegir(true)}>{cliente ? 'Cambiar' : 'Elegir'}</button>
        </div>
        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar'}</button>
        </div>
      </form>
    </Modal>
  )
}

function VincularCobro({ cobro, onCerrar, onListo }) {
  const aviso = useAviso()
  const [ventas, setVentas] = useState(null)

  useEffect(() => {
    async function cargar() {
      const [desde, hasta] = rangoDia(hoyTexto(new Date(cobro.fecha)))
      const [v, u] = await Promise.all([
        supabase.from('ventas').select('id, fecha, total, metodo_pago, clientes(nombre, apellido, apodo)')
          .eq('anulada', false).in('metodo_pago', ['transferencia', 'mercadopago', 'debito'])
          .gte('fecha', desde).lt('fecha', hasta).order('fecha', { ascending: false }),
        supabase.from('cobros_mp').select('venta_id').not('venta_id', 'is', null)
      ])
      if (v.error || u.error) { aviso(mensajeError(v.error || u.error), 'error'); setVentas([]); return }
      const usadas = new Set(u.data.map(x => x.venta_id))
      const libres = v.data.filter(x => !usadas.has(x.id))
      // primero las del mismo monto
      libres.sort((a, b) => (Number(b.total) === Number(cobro.monto)) - (Number(a.total) === Number(cobro.monto)))
      setVentas(libres)
    }
    cargar()
  }, [cobro.id])

  async function unir(v) {
    const { error } = await supabase.from('cobros_mp').update({ venta_id: v.id }).eq('id', cobro.id)
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso('Cobro unido a la venta', 'ok')
    onListo()
  }

  return (
    <Modal titulo={`¿Qué venta es este cobro de ${pesos(cobro.monto)}?`} onCerrar={onCerrar}>
      <p style={{ margin: 0, color: 'var(--apagado)', fontSize: 14 }}>Ventas de ese día cobradas por transferencia, QR o débito que todavía no tienen cobro asociado.</p>
      <div className="tarjeta lista" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {!ventas && <div className="cargando">Cargando…</div>}
        {ventas && ventas.length === 0 && <div className="vacio">No hay ventas para unir ese día</div>}
        {ventas?.map(v => (
          <button className="fila" key={v.id} onClick={() => unir(v)}>
            <span className="col">
              <span className="nombre">{hora(v.fecha)} · {nombreMetodo(v.metodo_pago)}{v.clientes ? ` · ${nombreCliente(v.clientes)}` : ''}</span>
              {Number(v.total) === Number(cobro.monto) && <span className="detalle" style={{ color: 'var(--ok)', fontWeight: 700 }}>Mismo monto</span>}
            </span>
            <span className="precio">{pesos(v.total)}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
