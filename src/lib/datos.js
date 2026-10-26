import { supabase } from './supabase.js'

// Lanza el error de Supabase para poder atraparlo con try/catch
function revisar({ data, error }) {
  if (error) throw error
  return data
}

export async function traerProductos() {
  return revisar(
    await supabase
      .from('productos')
      .select('*, categorias(nombre), proveedores(nombre)')
      .eq('activo', true)
      .order('nombre')
  )
}

export async function traerCategorias() {
  return revisar(await supabase.from('categorias').select('*').order('nombre'))
}

export async function traerProveedores() {
  return revisar(await supabase.from('proveedores').select('*').order('nombre'))
}

export async function traerPerfiles() {
  return revisar(await supabase.from('perfiles').select('*').order('nombre'))
}

export async function traerClientes() {
  return revisar(await supabase.from('clientes_saldo').select('*').eq('activo', true).order('nombre'))
}

// Supabase devuelve como máximo 1000 filas por consulta: esto trae todas, de a 1000.
// armar = () => supabase.from(...).select(...)...  (sin .range)
export async function traerTodo(armar) {
  const tam = 1000
  let desde = 0
  const todo = []
  while (true) {
    const filas = revisar(await armar().range(desde, desde + tam - 1))
    todo.push(...filas)
    if (filas.length < tam) return todo
    desde += tam
  }
}

export function mensajeError(e) {
  const m = e?.message || String(e)
  if (m.includes('productos_codigo_barras_key')) return 'Ya hay otro producto con ese código de barras'
  if (m.includes('Failed to fetch')) return 'No hay conexión a internet'
  if (m.includes('relation') && m.includes('does not exist')) return 'Falta correr la actualización de la base (supabase/actualizacion-02.sql)'
  if (m.includes('Could not find the function') || m.includes('schema cache')) return 'Falta correr la actualización de la base (supabase/actualizacion-02.sql)'
  return m
}
