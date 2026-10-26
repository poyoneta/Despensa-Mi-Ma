import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { configurado, supabase } from './lib/supabase.js'
import { ToastProvider } from './components/Toast.jsx'
import { PerfilProvider } from './components/Perfil.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Inicio from './pages/Inicio.jsx'
import Caja from './pages/Caja.jsx'
import Ventas from './pages/Ventas.jsx'
import Stock from './pages/Stock.jsx'
import Proveedores from './pages/Proveedores.jsx'
import Pedido from './pages/Pedido.jsx'
import Fiado from './pages/Fiado.jsx'
import Reportes from './pages/Reportes.jsx'
import MercadoPago from './pages/MercadoPago.jsx'

export default function App() {
  const [sesion, setSesion] = useState(undefined) // undefined = todavía cargando

  useEffect(() => {
    if (!configurado) return
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!configurado) {
    return (
      <div className="login">
        <div className="caja-login">
          <h2>Falta configurar Supabase</h2>
          <p>Creá el archivo <code>.env</code> (copiando <code>.env.example</code>) con la URL y la key de tu proyecto, y volvé a ejecutar <code>npm run dev</code>.</p>
        </div>
      </div>
    )
  }

  if (sesion === undefined) return <div className="cargando">Cargando…</div>
  if (!sesion) return <Login />

  return (
    <ToastProvider>
      <PerfilProvider key={sesion.user.id} usuario={sesion.user}>
        <Layout>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/caja" element={<Caja />} />
            <Route path="/ventas" element={<Ventas />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/pedido/:id" element={<Pedido />} />
            <Route path="/fiado" element={<Fiado />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/mercadopago" element={<MercadoPago />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </PerfilProvider>
    </ToastProvider>
  )
}
