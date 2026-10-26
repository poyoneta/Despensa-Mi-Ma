export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export const METODOS = [
  { id: 'efectivo', nombre: 'Efectivo' },
  { id: 'transferencia', nombre: 'Transferencia' },
  { id: 'debito', nombre: 'Débito' }
]

// $ 1.234,50
export function pesos(n) {
  return '$ ' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

// Fecha de hoy a las 00:00 (hora local) en formato ISO, para filtrar ventas del día
export function inicioDeHoy() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function fechaLarga(d = new Date()) {
  const txt = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

export function fechaCorta(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Para buscar sin importar mayúsculas ni tildes
export function normalizar(txt) {
  return (txt || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function bajoStock(p) {
  return p.stock <= p.stock_minimo
}

// Devuelve la pastilla de estado de stock, o null si está bien
export function estadoStock(p) {
  if (p.stock <= 0) return { texto: 'Sin stock', clase: 'pastilla-error' }
  if (p.stock <= p.stock_minimo) return { texto: `Quedan ${p.stock}`, clase: 'pastilla-aviso' }
  return null
}

// Cuánto conviene pedir: llegar al doble del mínimo
export function cantidadSugerida(p) {
  return Math.max(p.stock_minimo * 2 - Math.max(p.stock, 0), 1)
}

export function soloNumeros(txt) {
  return (txt || '').replace(/\D/g, '')
}

export function iniciales(nombre) {
  return (nombre || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
}
