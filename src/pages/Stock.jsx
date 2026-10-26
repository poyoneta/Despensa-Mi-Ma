import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { traerCategorias, traerProductos, traerProveedores, mensajeError } from '../lib/datos.js'
import { aNumero, bajoStock, estadoStock, normalizar, pesos } from '../lib/formato.js'
import { useAviso } from '../components/Toast.jsx'
import { usePerfil } from '../components/Perfil.jsx'
import Modal from '../components/Modal.jsx'
import Escaner from '../components/Escaner.jsx'
import { IconoArchivo, IconoBuscar, IconoEscanear, IconoMas, IconoRayo, IconoSubir } from '../components/Iconos.jsx'

export default function Stock() {
  const aviso = useAviso()
  const [params] = useSearchParams()
  const [productos, setProductos] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState(params.get('filtro') === 'bajo' ? 'bajo' : 'todos')
  const [editando, setEditando] = useState(null) // producto, 'nuevo' o null
  const [precios, setPrecios] = useState(false)
  const [importar, setImportar] = useState(false)

  async function cargar() {
    try {
      const [p, c, pr] = await Promise.all([traerProductos(), traerCategorias(), traerProveedores()])
      setProductos(p); setCategorias(c); setProveedores(pr)
    } catch (e) { aviso(mensajeError(e), 'error') }
  }
  useEffect(() => { cargar() }, [])

  const lista = useMemo(() => {
    if (!productos) return []
    const q = normalizar(busqueda.trim())
    return productos.filter(p => {
      if (filtro === 'bajo' && !bajoStock(p)) return false
      if (typeof filtro === 'number' && p.categoria_id !== filtro) return false
      if (!q) return true
      return normalizar(p.nombre).includes(q) || (p.codigo_barras || '').includes(q)
    })
  }, [productos, busqueda, filtro])

  const cantBajo = productos ? productos.filter(bajoStock).length : 0

  return (
    <div className="pagina">
      <div className="encabezado">
        <div>
          <h1>Stock</h1>
          {productos && <div className="sub">{productos.length} productos · {cantBajo} por reponer</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setImportar(true)}><IconoArchivo tam={18} />Importar Excel</button>
          <button className="btn" onClick={() => setPrecios(true)}><IconoSubir tam={18} />Subir precios</button>
          <button className="btn btn-primario solo-pc" onClick={() => setEditando('nuevo')}><IconoMas tam={18} />Nuevo producto</button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <label htmlFor="buscar-stock" className="etiqueta" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Buscar producto</label>
        <span style={{ position: 'absolute', left: 14, top: 13, color: 'var(--apagado)' }}><IconoBuscar /></span>
        <input id="buscar-stock" className="input" style={{ paddingLeft: 44 }} placeholder="Buscar por nombre o código"
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <div className="chips" role="group" aria-label="Filtrar">
        <button className={`chip ${filtro === 'todos' ? 'activo' : ''}`} onClick={() => setFiltro('todos')}>Todos</button>
        <button className={`chip aviso ${filtro === 'bajo' ? 'activo' : ''}`} onClick={() => setFiltro('bajo')}>Bajo stock ({cantBajo})</button>
        {categorias.map(c => (
          <button key={c.id} className={`chip ${filtro === c.id ? 'activo' : ''}`} onClick={() => setFiltro(c.id)}>{c.nombre}</button>
        ))}
      </div>

      <div className="tarjeta lista">
        <div className="fila-stock cabecera-tabla"><span>Producto</span><span>Precio</span><span className="stock">Stock</span></div>
        {!productos && <div className="cargando">Cargando…</div>}
        {productos && lista.length === 0 && (
          <div className="vacio">{productos.length === 0 ? 'Todavía no cargaste productos. Tocá “Producto” para empezar.' : 'No hay productos con ese filtro'}</div>
        )}
        {lista.map(p => {
          const est = estadoStock(p)
          return (
            <button className="fila fila-stock" key={p.id} onClick={() => setEditando(p)}>
              <span className="col">
                <span className="nombre" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.nombre}{p.acceso_rapido && <span title="Acceso rápido en la caja" style={{ color: 'var(--primario)', display: 'inline-flex' }}><IconoRayo tam={15} /></span>}
                </span>
                <span className="detalle">{[p.categorias?.nombre, p.codigo_barras].filter(Boolean).join(' · ') || 'Sin categoría'}</span>
              </span>
              <span className="precio">{pesos(p.precio_venta)}</span>
              <span className="stock">
                {est ? <span className={`pastilla ${est.clase}`}>{est.texto}</span> : <strong>{p.stock}</strong>}
              </span>
            </button>
          )
        })}
      </div>

      <button className="fab solo-cel" onClick={() => setEditando('nuevo')}><IconoMas tam={20} />Producto</button>

      {editando && (
        <ProductoForm
          producto={editando === 'nuevo' ? null : editando}
          categorias={categorias} proveedores={proveedores}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargar() }}
        />
      )}
      {importar && (
        <ImportarProductos productos={productos || []} categorias={categorias} proveedores={proveedores}
          onCerrar={() => setImportar(false)} onListo={() => { setImportar(false); cargar() }} />
      )}
      {precios && (
        <SubirPrecios categorias={categorias} proveedores={proveedores}
          onCerrar={() => setPrecios(false)} onListo={() => { setPrecios(false); cargar() }} />
      )}
    </div>
  )
}

function ProductoForm({ producto, categorias, proveedores, onCerrar, onGuardado }) {
  const aviso = useAviso()
  const [f, setF] = useState(() => ({
    nombre: producto?.nombre || '',
    codigo_barras: producto?.codigo_barras || '',
    categoria_id: producto?.categoria_id || '',
    proveedor_id: producto?.proveedor_id || '',
    precio_costo: producto?.precio_costo ?? '',
    precio_venta: producto?.precio_venta ?? '',
    stock: producto?.stock ?? 0,
    stock_minimo: producto?.stock_minimo ?? 5,
    acceso_rapido: producto?.acceso_rapido ?? false,
    sumar: ''
  }))
  const { nombreDe } = usePerfil()
  const [camara, setCamara] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const cambiar = campo => e => setF(v => ({ ...v, [campo]: e.target.value }))

  const margen = Number(f.precio_costo) > 0 && Number(f.precio_venta) > 0
    ? Math.round((Number(f.precio_venta) / Number(f.precio_costo) - 1) * 100) : null

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const datos = {
      nombre: f.nombre.trim(),
      codigo_barras: f.codigo_barras.trim() || null,
      categoria_id: f.categoria_id ? Number(f.categoria_id) : null,
      proveedor_id: f.proveedor_id ? Number(f.proveedor_id) : null,
      precio_costo: Number(f.precio_costo) || 0,
      precio_venta: Number(f.precio_venta) || 0,
      stock: (Number(f.stock) || 0) + (Number(f.sumar) || 0),
      stock_minimo: Number(f.stock_minimo) || 0,
      acceso_rapido: f.acceso_rapido
    }
    const { data, error } = producto
      ? await supabase.from('productos').update(datos).eq('id', producto.id).select().single()
      : await supabase.from('productos').insert(datos).select().single()

    if (!error && Number(f.sumar)) {
      await supabase.from('movimientos_stock').insert({ producto_id: data.id, tipo: 'ingreso', cantidad: Number(f.sumar), nota: 'Carga manual' })
    }
    setGuardando(false)
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso(producto ? 'Producto actualizado' : 'Producto creado', 'ok')
    onGuardado()
  }

  async function darDeBaja() {
    if (!confirm(`¿Dar de baja "${producto.nombre}"? Deja de aparecer en la caja y en el stock.`)) return
    const { error } = await supabase.from('productos').update({ activo: false }).eq('id', producto.id)
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso('Producto dado de baja')
    onGuardado()
  }

  return (
    <Modal titulo={producto ? 'Editar producto' : 'Nuevo producto'} onCerrar={onCerrar}>
      <form className="form-grid" onSubmit={guardar}>
        <div className="campo ancho">
          <label htmlFor="p-nombre">Nombre</label>
          <input id="p-nombre" className="input" required autoFocus value={f.nombre} onChange={cambiar('nombre')} placeholder="Ej: Gaseosa cola 500 ml" />
        </div>

        <div className="campo ancho">
          <label htmlFor="p-codigo">Código de barras</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="p-codigo" className="input" inputMode="numeric" value={f.codigo_barras} onChange={cambiar('codigo_barras')} placeholder="Opcional" />
            <button type="button" className="btn" onClick={() => setCamara(c => !c)} aria-label="Escanear código"><IconoEscanear /></button>
          </div>
          {camara && <Escaner onDetectado={cod => { setF(v => ({ ...v, codigo_barras: cod })); setCamara(false) }} />}
        </div>

        <div className="campo">
          <label htmlFor="p-cat">Categoría</label>
          <select id="p-cat" className="input" value={f.categoria_id} onChange={cambiar('categoria_id')}>
            <option value="">Sin categoría</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="p-prov">Proveedor</label>
          <select id="p-prov" className="input" value={f.proveedor_id} onChange={cambiar('proveedor_id')}>
            <option value="">Sin proveedor</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="p-costo">Precio de costo</label>
          <input id="p-costo" className="input" type="number" min="0" step="0.01" inputMode="decimal" value={f.precio_costo} onChange={cambiar('precio_costo')} />
        </div>
        <div className="campo">
          <label htmlFor="p-venta">Precio de venta</label>
          <input id="p-venta" className="input" type="number" min="0" step="0.01" inputMode="decimal" required value={f.precio_venta} onChange={cambiar('precio_venta')} />
        </div>
        {margen !== null && <div className="ancho detalle" style={{ color: 'var(--apagado)', fontWeight: 600, fontSize: 13 }}>Ganancia: {margen}% sobre el costo</div>}

        <div className="campo">
          <label htmlFor="p-stock">Stock actual</label>
          <input id="p-stock" className="input" type="number" inputMode="numeric" value={f.stock} onChange={cambiar('stock')} />
        </div>
        <div className="campo">
          <label htmlFor="p-min">Avisar cuando queden</label>
          <input id="p-min" className="input" type="number" min="0" inputMode="numeric" value={f.stock_minimo} onChange={cambiar('stock_minimo')} />
        </div>
        {producto && (
          <div className="campo ancho">
            <label htmlFor="p-sumar">Llegó mercadería: sumar unidades</label>
            <input id="p-sumar" className="input" type="number" min="0" inputMode="numeric" placeholder="0" value={f.sumar} onChange={cambiar('sumar')} />
          </div>
        )}

        <label className="ancho" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, minHeight: 44 }}>
          <input type="checkbox" style={{ width: 22, height: 22, accentColor: 'var(--primario)' }}
            checked={f.acceso_rapido} onChange={e => setF(v => ({ ...v, acceso_rapido: e.target.checked }))} />
          Acceso rápido en la caja (botón para venderlo con un toque)
        </label>
        {producto?.creado_por && (
          <div className="ancho" style={{ fontSize: 13, color: 'var(--apagado)' }}>Lo cargó {nombreDe(producto.creado_por)}</div>
        )}

        <div className="acciones ancho" style={{ justifyContent: 'space-between' }}>
          {producto ? <button type="button" className="btn btn-peligro" onClick={darDeBaja}>Dar de baja</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
            <button className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function SubirPrecios({ categorias, proveedores, onCerrar, onListo }) {
  const aviso = useAviso()
  const [porcentaje, setPorcentaje] = useState('')
  const [categoria, setCategoria] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function aplicar(e) {
    e.preventDefault()
    const pct = Number(porcentaje)
    if (!pct) return
    const a = categoria ? categorias.find(c => c.id === Number(categoria))?.nombre
      : proveedor ? proveedores.find(p => p.id === Number(proveedor))?.nombre : 'todos los productos'
    if (!confirm(`¿${pct > 0 ? 'Subir' : 'Bajar'} ${Math.abs(pct)}% los precios de ${a}?`)) return
    setEnviando(true)
    const { data, error } = await supabase.rpc('actualizar_precios', {
      p_porcentaje: pct,
      p_categoria_id: categoria ? Number(categoria) : null,
      p_proveedor_id: proveedor ? Number(proveedor) : null
    })
    setEnviando(false)
    if (error) { aviso(mensajeError(error), 'error'); return }
    aviso(`Listo: se actualizaron ${data} precios`, 'ok')
    onListo()
  }

  return (
    <Modal titulo="Subir precios" onCerrar={onCerrar}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={aplicar}>
        <div className="campo">
          <label htmlFor="sp-pct">Porcentaje (usá negativo para bajar)</label>
          <input id="sp-pct" className="input" type="number" step="0.5" inputMode="decimal" required autoFocus
            placeholder="Ej: 8" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="sp-cat">Solo de la categoría</label>
          <select id="sp-cat" className="input" value={categoria} onChange={e => { setCategoria(e.target.value); setProveedor('') }}>
            <option value="">Todas</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="sp-prov">O solo del proveedor</label>
          <select id="sp-prov" className="input" value={proveedor} onChange={e => { setProveedor(e.target.value); setCategoria('') }}>
            <option value="">Todos</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <p className="detalle" style={{ margin: 0, color: 'var(--apagado)', fontSize: 13 }}>Los precios se redondean a la decena más cercana.</p>
        <div className="acciones">
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Aplicando…' : 'Aplicar'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Importar productos desde Excel o CSV ----------
const COLUMNAS = {
  nombre: ['nombre', 'producto', 'descripcion', 'articulo', 'detalle'],
  codigo_barras: ['codigo', 'codigo de barras', 'codigo_barras', 'cod barras', 'cod. barras', 'ean', 'barras'],
  categoria: ['categoria', 'rubro', 'tipo'],
  proveedor: ['proveedor', 'distribuidora', 'distribuidor'],
  precio_costo: ['costo', 'precio costo', 'precio de costo', 'precio_costo', 'compra', 'precio compra'],
  precio_venta: ['precio', 'precio venta', 'precio de venta', 'precio_venta', 'venta', 'pvp'],
  stock: ['stock', 'cantidad', 'existencia', 'unidades'],
  stock_minimo: ['minimo', 'stock minimo', 'stock_minimo', 'avisar', 'avisar cuando queden']
}

function campoDe(encabezado) {
  const n = normalizar(encabezado).trim().replace(/\s+/g, ' ')
  for (const [campo, alias] of Object.entries(COLUMNAS)) if (alias.includes(n)) return campo
  return null
}

function textoCelda(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return String(Math.round(v) === v ? v : v)
  return String(v).trim()
}

function ImportarProductos({ productos, categorias, proveedores, onCerrar, onListo }) {
  const aviso = useAviso()
  const [plan, setPlan] = useState(null)   // { nuevos, cambios, ignoradas, columnas, catsNuevas, provsNuevos }
  const [leyendo, setLeyendo] = useState(false)
  const [importando, setImportando] = useState(false)

  async function bajarPlantilla() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet([
      { nombre: 'Gaseosa cola 500 ml', codigo_barras: '7790000000011', categoria: 'Bebidas', proveedor: 'Distribuidora A', precio_costo: 1200, precio_venta: 1800, stock: 24, stock_minimo: 12 },
      { nombre: 'Lavandina 1 L', codigo_barras: '', categoria: 'Limpieza', proveedor: '', precio_costo: 600, precio_venta: 900, stock: 10, stock_minimo: 4 }
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Productos')
    XLSX.writeFile(wb, 'plantilla-productos-mi-ma.xlsx')
  }

  async function leer(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setLeyendo(true)
    try {
      const XLSX = await import('xlsx')
      const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' })
      const hoja = libro.Sheets[libro.SheetNames[0]]
      const filas = XLSX.utils.sheet_to_json(hoja, { defval: '', raw: true })
      if (filas.length === 0) throw new Error('El archivo está vacío')

      // qué columna del Excel es cada dato
      const mapa = {}
      for (const enc of Object.keys(filas[0])) {
        const c = campoDe(enc)
        if (c && !mapa[c]) mapa[c] = enc
      }
      if (!mapa.nombre) throw new Error('No encontré la columna "nombre". Usá la plantilla.')

      const porCodigo = new Map(productos.filter(p => p.codigo_barras).map(p => [p.codigo_barras, p]))
      const porNombre = new Map(productos.map(p => [normalizar(p.nombre), p]))
      const catExiste = new Set(categorias.map(c => normalizar(c.nombre)))
      const provExiste = new Set(proveedores.map(p => normalizar(p.nombre)))
      const catsNuevas = new Map(), provsNuevos = new Map()
      const nuevos = [], cambios = []
      let ignoradas = 0

      for (const fila of filas) {
        const r = {}
        for (const [campo, enc] of Object.entries(mapa)) r[campo] = fila[enc]
        const nombre = textoCelda(r.nombre)
        if (!nombre) { ignoradas++; continue }
        const codigo = textoCelda(r.codigo_barras)
        const datos = { nombre }
        if (mapa.codigo_barras && codigo) datos.codigo_barras = codigo
        for (const num of ['precio_costo', 'precio_venta', 'stock', 'stock_minimo']) {
          if (!mapa[num] || textoCelda(r[num]) === '') continue
          const n = aNumero(r[num])
          if (!Number.isNaN(n)) datos[num] = num.startsWith('stock') ? Math.round(n) : n
        }
        const cat = textoCelda(r.categoria), prov = textoCelda(r.proveedor)
        if (cat) { datos._categoria = cat; if (!catExiste.has(normalizar(cat))) catsNuevas.set(normalizar(cat), cat) }
        if (prov) { datos._proveedor = prov; if (!provExiste.has(normalizar(prov))) provsNuevos.set(normalizar(prov), prov) }

        const existente = (codigo && porCodigo.get(codigo)) || porNombre.get(normalizar(nombre))
        if (existente) cambios.push({ id: existente.id, ...datos })
        else nuevos.push(datos)
      }
      setPlan({ nuevos, cambios, ignoradas, columnas: Object.keys(mapa), catsNuevas: [...catsNuevas.values()], provsNuevos: [...provsNuevos.values()] })
    } catch (err) {
      aviso(err.message || 'No pude leer el archivo', 'error')
      setPlan(null)
    } finally {
      setLeyendo(false)
      e.target.value = ''
    }
  }

  async function importar() {
    setImportando(true)
    try {
      // 1) categorías y proveedores que no existían
      let cats = [...categorias], provs = [...proveedores]
      if (plan.catsNuevas.length) {
        const { data, error } = await supabase.from('categorias').insert(plan.catsNuevas.map(nombre => ({ nombre }))).select()
        if (error) throw error
        cats = cats.concat(data)
      }
      if (plan.provsNuevos.length) {
        const { data, error } = await supabase.from('proveedores').insert(plan.provsNuevos.map(nombre => ({ nombre }))).select()
        if (error) throw error
        provs = provs.concat(data)
      }
      const idCat = n => cats.find(c => normalizar(c.nombre) === normalizar(n))?.id ?? null
      const idProv = n => provs.find(p => normalizar(p.nombre) === normalizar(n))?.id ?? null
      const armar = ({ _categoria, _proveedor, id, ...resto }) => ({
        ...resto,
        ...(_categoria !== undefined && { categoria_id: idCat(_categoria) }),
        ...(_proveedor !== undefined && { proveedor_id: idProv(_proveedor) })
      })

      // 2) productos nuevos, de a 200
      for (let i = 0; i < plan.nuevos.length; i += 200) {
        // defaultToNull: false → si una fila no trae un dato, usa el valor por defecto (ej. stock 0)
        const { error } = await supabase.from('productos').insert(plan.nuevos.slice(i, i + 200).map(armar), { defaultToNull: false })
        if (error) throw error
      }
      // 3) productos que ya existían: solo se cambian las columnas que trae el Excel
      for (let i = 0; i < plan.cambios.length; i += 10) {
        const tanda = plan.cambios.slice(i, i + 10)
        const res = await Promise.all(tanda.map(c => supabase.from('productos').update(armar(c)).eq('id', c.id)))
        const conError = res.find(r => r.error)
        if (conError) throw conError.error
      }
      aviso(`Listo: ${plan.nuevos.length} nuevos y ${plan.cambios.length} actualizados`, 'ok')
      onListo()
    } catch (e) {
      aviso(mensajeError(e), 'error')
    } finally {
      setImportando(false)
    }
  }

  return (
    <Modal titulo="Importar productos" onCerrar={onCerrar}>
      <p style={{ margin: 0, color: 'var(--apagado)', fontSize: 14 }}>
        Subí un Excel (.xlsx) o CSV con una fila por producto. Si un producto ya existe (mismo código de barras o mismo nombre), se actualiza; si no, se crea.
      </p>
      <button className="btn" onClick={bajarPlantilla}>Bajar plantilla de ejemplo</button>
      <label className="btn btn-primario" style={{ cursor: 'pointer' }}>
        {leyendo ? 'Leyendo…' : 'Elegir archivo'}
        <input type="file" accept=".xlsx,.xls,.csv" onChange={leer} style={{ display: 'none' }} />
      </label>

      {plan && (
        <div className="tarjeta lista">
          <div className="fila"><span>Productos nuevos</span><strong>{plan.nuevos.length}</strong></div>
          <div className="fila"><span>Ya existían (se actualizan)</span><strong>{plan.cambios.length}</strong></div>
          {plan.ignoradas > 0 && <div className="fila"><span>Filas sin nombre (se saltean)</span><strong>{plan.ignoradas}</strong></div>}
          {plan.catsNuevas.length > 0 && <div className="fila"><span>Categorías nuevas</span><span className="detalle">{plan.catsNuevas.join(', ')}</span></div>}
          {plan.provsNuevos.length > 0 && <div className="fila"><span>Proveedores nuevos</span><span className="detalle">{plan.provsNuevos.join(', ')}</span></div>}
          <div className="fila"><span className="detalle">Columnas que reconocí: {plan.columnas.join(', ')}</span></div>
        </div>
      )}

      <div className="acciones">
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-primario" disabled={!plan || importando || (plan.nuevos.length + plan.cambios.length === 0)} onClick={importar}>
          {importando ? 'Importando…' : 'Importar'}
        </button>
      </div>
    </Modal>
  )
}
