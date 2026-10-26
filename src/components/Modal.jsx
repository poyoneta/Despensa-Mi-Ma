import { useEffect } from 'react'
import { IconoCerrar } from './Iconos.jsx'

export default function Modal({ titulo, onCerrar, children }) {
  useEffect(() => {
    const tecla = e => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
    }
  }, [onCerrar])

  return (
    <div className="modal-fondo" onMouseDown={e => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cabecera">
          <h2>{titulo}</h2>
          <button className="btn btn-cuadrado" onClick={onCerrar} aria-label="Cerrar"><IconoCerrar /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
