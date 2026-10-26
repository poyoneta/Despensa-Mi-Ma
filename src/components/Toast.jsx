import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContexto = createContext(() => {})

// Mensajito que aparece abajo unos segundos: aviso('Guardado', 'ok')
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef()

  const aviso = useCallback((texto, tipo = '') => {
    clearTimeout(timer.current)
    setToast({ texto, tipo })
    timer.current = setTimeout(() => setToast(null), tipo === 'error' ? 4500 : 2800)
  }, [])

  return (
    <ToastContexto.Provider value={aviso}>
      {children}
      {toast && <div className={`toast ${toast.tipo}`} role="status">{toast.texto}</div>}
    </ToastContexto.Provider>
  )
}

export const useAviso = () => useContext(ToastContexto)
