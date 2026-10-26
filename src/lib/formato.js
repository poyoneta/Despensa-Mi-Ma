export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export const METODOS = [
  { id: 'efectivo', nombre: 'Efectivo', corto: 'Efectivo' },
  { id: 'transferencia', nombre: 'Transferencia', corto: 'Transfer.' },
  { id: 'debito', nombre: 'Débito', corto: 'Débito' },
  { id: 'fiado', nombre: 'Fiado', corto: 'Fiado' },
  { id: 'mercadopago', nombre: 'QR Mercado Pago', corto: 'QR MP' }
]

// "Rosa Pérez (Doña Rosa)"
export function nombreCliente(c) {
  if (!c) return ''
  const base = [c.nombre, c.apellido].filter(Boolean).join(' ')
  return c.apodo ? `${base} (${c.apodo})` : base
}

export function textoBusquedaCliente(c) {
  return normalizar([c.nombre, c.apellido, c.apodo, c.dni, c.telefono].filter(Boolean).join(' '))
}
export const nombreMetodo = id => METODOS.find(m => m.id === id)?.nombre || id

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

// 'YYYY-MM-DD' de hoy en hora local (para inputs type=date)
export function hoyTexto(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

// Desde y hasta (ISO) de un día 'YYYY-MM-DD' en hora local
export function rangoDia(texto) {
  const [a, m, d] = texto.split('-').map(Number)
  const desde = new Date(a, m - 1, d, 0, 0, 0, 0)
  const hasta = new Date(a, m - 1, d + 1, 0, 0, 0, 0)
  return [desde.toISOString(), hasta.toISOString()]
}

export function fechaLarga(d = new Date()) {
  const txt = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

export function fechaCorta(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function hora(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
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

// Convierte "1.234,50", "$ 1500", 1500 → número
export function aNumero(v) {
  if (typeof v === 'number') return v
  let s = String(v ?? '').replace(/[$\s]/g, '')
  if (!s) return NaN
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  return Number(s)
}
