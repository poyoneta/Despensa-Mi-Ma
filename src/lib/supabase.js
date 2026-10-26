import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

// Si falta el .env, la app muestra un aviso en vez de romperse.
export const configurado = Boolean(url && key)

export const supabase = configurado ? createClient(url, key) : null
