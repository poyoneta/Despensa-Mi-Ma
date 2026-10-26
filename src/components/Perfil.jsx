import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { mensajeError, traerPerfiles } from '../lib/datos.js'

const PerfilContexto = createContext(null)

// Sabe quién está usando la app (Mateo o Mika) y los nombres de todos.
export function PerfilProvider({ usuario, children }) {
  const [perfiles, setPerfiles] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    try { setPerfiles(await traerPerfiles()) } catch (e) { setError(mensajeError(e)) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  if (error) {
    return (
      <div className="login">
        <div className="caja-login">
          <h2>No se pudo cargar</h2>
          <p className="error-txt">{error}</p>
          <button className="btn" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </div>
    )
  }
  if (!perfiles) return <div className="cargando">Cargando…</div>

  const yo = perfiles.find(p => p.id === usuario.id)
  if (!yo) return <ElegirNombre usuario={usuario} onListo={cargar} />

  const nombreDe = id => perfiles.find(p => p.id === id)?.nombre || 'Sin nombre'

  return (
    <PerfilContexto.Provider value={{ yo, perfiles, nombreDe, recargar: cargar }}>
      {children}
    </PerfilContexto.Provider>
  )
}

export const usePerfil = () => useContext(PerfilContexto)

// La primera vez que alguien entra, le pregunta el nombre
function ElegirNombre({ usuario, onListo }) {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')

  async function guardar(n) {
    const limpio = n.trim()
    if (!limpio) return
    const { error } = await supabase.from('perfiles').insert({ id: usuario.id, nombre: limpio })
    if (error) { setError(mensajeError(error)); return }
    onListo()
  }

  return (
    <div className="login">
      <form className="caja-login" onSubmit={e => { e.preventDefault(); guardar(nombre) }}>
        <h2>¿Quién sos?</h2>
        <p style={{ margin: 0, color: 'var(--apagado)' }}>Así cada venta queda guardada a tu nombre. Se pregunta una sola vez.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className="btn btn-grande" onClick={() => guardar('Mateo')}>Mateo</button>
          <button type="button" className="btn btn-grande" onClick={() => guardar('Mika')}>Mika</button>
        </div>
        <div className="campo">
          <label htmlFor="otro-nombre">O escribí otro nombre</label>
          <input id="otro-nombre" className="input" value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        {error && <div className="error-txt">{error}</div>}
        <button className="btn btn-primario" disabled={!nombre.trim()}>Guardar</button>
        <button type="button" className="btn btn-chico" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </form>
    </div>
  )
}
