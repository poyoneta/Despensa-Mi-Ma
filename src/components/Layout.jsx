import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { IconoInicio, IconoCaja, IconoStock, IconoCamion, IconoSalir } from './Iconos.jsx'

const SECCIONES = [
  { a: '/', nombre: 'Inicio', Icono: IconoInicio },
  { a: '/caja', nombre: 'Caja', Icono: IconoCaja },
  { a: '/stock', nombre: 'Stock', Icono: IconoStock },
  { a: '/proveedores', nombre: 'Proveedores', Icono: IconoCamion }
]

function salir() {
  if (confirm('¿Cerrar sesión?')) supabase.auth.signOut()
}

// En la compu: menú naranja a la izquierda. En el celular: barra arriba + menú abajo.
export default function Layout({ children }) {
  return (
    <div className="app">
      <aside className="lateral">
        <img src="/logo-blanco.png" alt="Despensa Mi-Ma" />
        <nav aria-label="Secciones">
          {SECCIONES.map(({ a, nombre, Icono }) => (
            <NavLink key={a} to={a} end={a === '/'}><Icono />{nombre}</NavLink>
          ))}
        </nav>
        <button className="salir" onClick={salir}>Cerrar sesión</button>
      </aside>

      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header className="barra-top">
          <img src="/logo-blanco.png" alt="Despensa Mi-Ma" />
          <button className="btn-icono-claro" onClick={salir} aria-label="Cerrar sesión"><IconoSalir /></button>
        </header>
        <main className="contenido">{children}</main>
      </div>

      <nav className="nav-abajo" aria-label="Secciones">
        {SECCIONES.map(({ a, nombre, Icono }) => (
          <NavLink key={a} to={a} end={a === '/'}><Icono tam={24} />{nombre}</NavLink>
        ))}
      </nav>
    </div>
  )
}
