import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Los usuarios se crean desde Supabase > Authentication > Users > Add user
export default function Login() {
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
    setCargando(false)
    if (!error) return
    const m = error.message || ''
    if (m.includes('Invalid login credentials')) setError('Email o contraseña incorrectos')
    else if (m.includes('Email not confirmed')) setError('El usuario no está confirmado. En Supabase marcalo como confirmado (Auto Confirm).')
    else if (m.toLowerCase().includes('api key')) setError('La key de Supabase del .env no es válida')
    else setError(m)
  }

  return (
    <div className="login">
      <form className="caja-login" onSubmit={entrar}>
        <div style={{ background: 'var(--naranja)', borderRadius: 18, padding: '22px 0 0', margin: '-8px -4px 4px' }}>
          <img src="/logo-blanco.png" alt="Despensa Mi-Ma" />
        </div>
        <div className="campo">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="username" required
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="clave">Contraseña</label>
          <input id="clave" className="input" type="password" autoComplete="current-password" required
            value={clave} onChange={e => setClave(e.target.value)} />
        </div>
        {error && <div className="error-txt">{error}</div>}
        <button className="btn btn-primario btn-grande" disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
