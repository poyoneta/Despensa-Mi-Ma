import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { usePerfil } from './Perfil.jsx'
import Modal from './Modal.jsx'
import {
  IconoInicio, IconoCaja, IconoStock, IconoCamion, IconoSalir,
  IconoRecibo, IconoLibreta, IconoGrafico, IconoMenu, IconoQR
} from './Iconos.jsx'

const SECCIONES = [
  { a: '/', nombre: 'Inicio', Icono: IconoInicio },
  { a: '/caja', nombre: 'Caja', Icono: IconoCaja },
  { a: '/ventas', nombre: 'Ventas', Icono: IconoRecibo },
  { a: '/stock', nombre: 'Stock', Icono: IconoStock },
  { a: '/proveedores', nombre: 'Proveedores', Icono: IconoCamion },
  { a: '/fiado', nombre: 'Clientes', Icono: IconoLibreta },
  { a: '/mercadopago', nombre: 'Mercado Pago', Icono: IconoQR },
  { a: '/reportes', nombre: 'Reportes', Icono: IconoGrafico }
]
const EN_BARRA = SECCIONES.slice(0, 4)        // las que se ven abajo en el celular
const EN_MAS = SECCIONES.slice(4)             // las que van en "Más"

function salir() {
  if (confirm('¿Cerrar sesión?')) supabase.auth.signOut()
}

// En la compu: menú naranja a la izquierda. En el celular: barra arriba + menú abajo.
export default function Layout({ children }) {
  const { yo } = usePerfil()
  const { pathname } = useLocation()
  const [mas, setMas] = useState(false)
  const enMas = EN_MAS.some(s => pathname.startsWith(s.a)) || pathname.startsWith('/pedido')

  return (
    <div className="app">
      <aside className="lateral">
        <img src="/logo-blanco.png" alt="Despensa Mi-Ma" />
        <div className="saludo">Hola, {yo.nombre}</div>
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
          <span className="saludo-cel">Hola, {yo.nombre}</span>
        </header>
        <main className="contenido">{children}</main>
      </div>

      <nav className="nav-abajo" aria-label="Secciones">
        {EN_BARRA.map(({ a, nombre, Icono }) => (
          <NavLink key={a} to={a} end={a === '/'}><Icono tam={24} />{nombre}</NavLink>
        ))}
        <button className={enMas ? 'active' : ''} onClick={() => setMas(true)}><IconoMenu tam={24} />Más</button>
      </nav>

      {mas && (
        <Modal titulo="Más secciones" onCerrar={() => setMas(false)}>
          <div className="lista tarjeta">
            {EN_MAS.map(({ a, nombre, Icono }) => (
              <NavLink key={a} to={a} className="fila" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => setMas(false)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="nombre"><Icono />{nombre}</span>
              </NavLink>
            ))}
            <button className="fila btn-peligro" onClick={salir}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="nombre"><IconoSalir />Cerrar sesión ({yo.nombre})</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
