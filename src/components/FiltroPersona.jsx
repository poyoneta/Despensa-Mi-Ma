import { usePerfil } from './Perfil.jsx'

// Botones "Todos juntos / Mateo / Mika". valor = null (todos) o el id del usuario
export default function FiltroPersona({ valor, onCambio }) {
  const { perfiles } = usePerfil()
  if (perfiles.length < 2) return null
  return (
    <div className="chips" role="group" aria-label="Ver ventas de">
      <button className={`chip ${valor === null ? 'activo' : ''}`} onClick={() => onCambio(null)}>Todos juntos</button>
      {perfiles.map(p => (
        <button key={p.id} className={`chip ${valor === p.id ? 'activo' : ''}`} onClick={() => onCambio(p.id)}>{p.nombre}</button>
      ))}
    </div>
  )
}
