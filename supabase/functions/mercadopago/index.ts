// =====================================================================
// Despensa Mi-Ma · Función "mercadopago" (Supabase Edge Function)
//
// Es la ÚNICA parte que conoce el Access Token de Mercado Pago.
// La web nunca ve el token: le pide cosas a esta función y esta función
// habla con Mercado Pago.
//
// Secretos que necesita (Supabase > Edge Functions > Secrets):
//   MP_ACCESS_TOKEN   Access Token de producción de la cuenta que cobra
//   MP_POS_ID         (opcional) id de la caja, por defecto MIMACAJA1
//
// Acciones (se llaman con { accion: '...', ...datos }):
//   estado_config  → ¿está el token? ¿existe la caja?
//   configurar     → crea la sucursal y la caja en Mercado Pago
//   crear_qr       → crea un cobro con QR por un monto
//   estado_qr      → ¿ya pagaron ese QR?
//   cancelar_qr    → cancela un QR que no se pagó
//   sincronizar    → trae los cobros recibidos de los últimos días
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const MP = 'https://api.mercadopago.com'
const STORE_ID_EXTERNO = 'MIMA'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function respuesta(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

type Opciones = { method?: string; body?: unknown; idem?: boolean }

async function mp(path: string, { method = 'GET', body, idem = false }: Opciones = {}) {
  const token = Deno.env.get('MP_ACCESS_TOKEN')
  if (!token) throw new Error('Falta cargar MP_ACCESS_TOKEN en los secretos de Supabase')
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  if (idem) headers['X-Idempotency-Key'] = crypto.randomUUID()
  let r: Response
  try {
    r = await fetch(MP + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000) })
  } catch (_) {
    throw new Error(`Mercado Pago no respondió a tiempo (${path.split('?')[0]})`)
  }
  const texto = await r.text()
  let data: any
  try { data = texto ? JSON.parse(texto) : {} } catch { data = { raw: texto } }
  if (!r.ok) {
    const detalle = data?.message || data?.error || data?.errors?.[0]?.message || texto
    throw new Error(`Mercado Pago respondió ${r.status}: ${String(detalle).slice(0, 300)}`)
  }
  return data
}

// Monto como texto: sin decimales si es entero
function monto(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

async function buscarCaja(pos: string) {
  const r = await mp(`/pos?external_id=${encodeURIComponent(pos)}`)
  return r?.results?.[0] ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // Solo usuarios que iniciaron sesión en la app
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return respuesta({ error: 'Tenés que iniciar sesión' }, 401)

    const { accion, ...p } = await req.json()
    const POS = Deno.env.get('MP_POS_ID') || 'MIMACAJA1'

    switch (accion) {
      // Provincias y ciudades con los nombres EXACTOS que acepta Mercado Pago (los de Mercado Libre)
      case 'ciudades': {
        const ML = 'https://api.mercadolibre.com/classified_locations'
        const norm = (t: string) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
        const traer = async (url: string) => {
          const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
          if (!r.ok) throw new Error(`No se pudo traer la lista de ciudades (${r.status})`)
          return r.json()
        }
        const pais = await traer(`${ML}/countries/AR`)
        const provincias = (pais.states ?? []).map((s: any) => s.name).sort()
        const buscada = norm(p.provincia)
        const estado = (pais.states ?? []).find((s: any) => norm(s.name) === buscada)
          ?? (pais.states ?? []).find((s: any) => norm(s.name).includes(buscada) || buscada.includes(norm(s.name)))
        if (!estado) return respuesta({ provincias, provincia: null, ciudades: [] })
        const detalle = await traer(`${ML}/states/${estado.id}`)
        const ciudades = (detalle.cities ?? []).map((c: any) => c.name).sort((a: string, b: string) => a.localeCompare(b, 'es'))
        return respuesta({ provincias, provincia: estado.name, ciudades })
      }

      case 'ping':
        return respuesta({ ok: true, token: Boolean(Deno.env.get('MP_ACCESS_TOKEN')) })

      case 'estado_config': {
        if (!Deno.env.get('MP_ACCESS_TOKEN')) return respuesta({ token: false })
        const yo = await mp('/users/me')
        let caja = null
        try { caja = await buscarCaja(POS) } catch (_) { caja = null } // si falla la búsqueda, ofrecemos crearla
        return respuesta({
          token: true,
          cuenta: { id: yo.id, nombre: [yo.first_name, yo.last_name].filter(Boolean).join(' ') || yo.nickname, email: yo.email },
          caja: caja ? { id: caja.id, nombre: caja.name, qr: caja.qr?.image ?? null, external_id: caja.external_id } : null
        })
      }

      case 'configurar': {
        const yo = await mp('/users/me')
        // sucursal (si la búsqueda falla o no encuentra nada, se crea)
        let sucursal: any = null
        try {
          const buscadas = await mp(`/users/${yo.id}/stores/search?external_id=${STORE_ID_EXTERNO}`)
          sucursal = buscadas?.results?.[0] ?? null
        } catch (_) { sucursal = null }
        if (!sucursal) {
          sucursal = await mp(`/users/${yo.id}/stores`, {
            method: 'POST',
            body: {
              name: p.nombre || 'Despensa Mi-Ma',
              external_id: STORE_ID_EXTERNO,
              location: {
                street_name: p.calle,
                street_number: String(p.numero ?? ''),
                city_name: p.ciudad,
                state_name: p.provincia,
                latitude: Number(p.latitud),
                longitude: Number(p.longitud),
                reference: p.referencia || ''
              }
            }
          })
        }
        // caja: primero la versión nueva de la API (/v2/pos), si no la anterior (/pos)
        let caja: any = null
        try { caja = await buscarCaja(POS) } catch (_) { caja = null }
        if (!caja) {
          try {
            caja = await mp('/v2/pos', {
              method: 'POST',
              idem: true,
              body: {
                name: 'Caja 1',
                store_id: String(sucursal.id),
                external_id: POS,
                config: { qr: { operating_mode: 'pdv' } }
              }
            })
          } catch (e1) {
            try {
              caja = await mp('/pos', {
                method: 'POST',
                body: {
                  name: 'Caja 1',
                  fixed_amount: true,
                  store_id: Number(sucursal.id),
                  external_store_id: STORE_ID_EXTERNO,
                  external_id: POS
                }
              })
            } catch (e2) {
              throw new Error(`No se pudo crear la caja. ${(e1 as Error).message} | ${(e2 as Error).message}`)
            }
          }
        }
        return respuesta({ ok: true, caja: { id: caja.id, nombre: caja.name, qr: caja.qr?.image ?? null } })
      }

      case 'crear_qr': {
        const total = Math.round(Number(p.monto) * 100) / 100
        if (!(total > 0)) throw new Error('El monto tiene que ser mayor a 0')
        const orden = await mp('/v1/orders', {
          method: 'POST',
          idem: true,
          body: {
            type: 'qr',
            total_amount: monto(total),
            description: (p.descripcion || 'Compra en Despensa Mi-Ma').slice(0, 150),
            external_reference: p.referencia,
            expiration_time: 'PT10M',
            config: { qr: { external_pos_id: POS, mode: 'dynamic' } },
            transactions: { payments: [{ amount: monto(total) }] }
          }
        })
        return respuesta({
          id: orden.id,
          estado: orden.status,
          qr_data: orden.type_response?.qr_data ?? orden.qr_data ?? null
        })
      }

      case 'estado_qr': {
        const o = await mp(`/v1/orders/${encodeURIComponent(p.id)}`)
        return respuesta({ estado: o.status, detalle: o.status_detail })
      }

      case 'cancelar_qr': {
        try {
          await mp(`/v1/orders/${encodeURIComponent(p.id)}/cancel`, { method: 'POST', idem: true })
        } catch (_) { /* si ya venció o se pagó, no pasa nada */ }
        return respuesta({ ok: true })
      }

      case 'sincronizar': {
        const dias = Math.min(Math.max(Number(p.dias) || 3, 1), 30)
        const yo = await mp('/users/me')
        const filas: Record<string, unknown>[] = []
        // de a 100, hasta 500 cobros
        for (let offset = 0; offset < 500; offset += 100) {
          const r = await mp(`/v1/payments/search?sort=date_created&criteria=desc&range=date_created&begin_date=NOW-${dias}DAYS&end_date=NOW&limit=100&offset=${offset}`)
          const res = r?.results ?? []
          for (const pago of res) {
            if (pago.status !== 'approved') continue
            if (pago.collector_id && String(pago.collector_id) !== String(yo.id)) continue // solo lo que entró
            filas.push({
              id: String(pago.id),
              fecha: pago.date_approved || pago.date_created,
              monto: pago.transaction_amount,
              neto: pago.transaction_details?.net_received_amount ?? null,
              tipo: pago.payment_type_id ?? null,
              metodo: pago.payment_method_id ?? null,
              operacion: pago.operation_type ?? null,
              estado: pago.status,
              referencia: pago.external_reference || null,
              pagador_nombre: [pago.payer?.first_name, pago.payer?.last_name].filter(Boolean).join(' ') || null,
              pagador_email: pago.payer?.email || null,
              pagador_doc: pago.payer?.identification?.number || null,
              descripcion: pago.description || null,
              sincronizado_en: new Date().toISOString()
            })
          }
          if (res.length < 100) break
        }
        if (filas.length) {
          // no toca venta_id: si ya estaba vinculado, sigue vinculado
          const { error } = await sb.from('cobros_mp').upsert(filas, { onConflict: 'id' })
          if (error) throw new Error(error.message)
        }
        const { data: vinculados } = await sb.rpc('vincular_cobros_qr')
        return respuesta({ cantidad: filas.length, vinculados: vinculados ?? 0 })
      }

      default:
        return respuesta({ error: `Acción desconocida: ${accion}` }, 400)
    }
  } catch (e) {
    return respuesta({ error: (e as Error).message }, 400)
  }
})