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

export function mensajeError(e) {
  const m = e?.message || String(e)
  if (m.includes('productos_codigo_barras_key')) return 'Ya hay otro producto con ese código de barras'
  if (m.includes('Failed to fetch')) return 'No hay conexión a internet'
  return m
}
