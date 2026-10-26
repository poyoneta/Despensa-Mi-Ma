import { supabase } from './supabase.js'

// Llama a la función "mercadopago" de Supabase (supabase/functions/mercadopago)
export async function mercadoPago(accion, datos = {}) {
  // si en 25 segundos no contesta, mostramos un error en vez de quedarnos esperando
  const limite = new Promise((_, rechazar) =>
    setTimeout(() => rechazar(new Error('La función de Mercado Pago no respondió. Revisá en Supabase → Edge Functions → mercadopago → Logs.')), 25000))
  const { data, error } = await Promise.race([
    supabase.functions.invoke('mercadopago', { body: { accion, ...datos } }),
    limite
  ])
  if (error) {
    let msg = error.message || 'Error con Mercado Pago'
    let delServidor = false
    try {
      const j = await error.context?.json()
      if (j?.error) { msg = j.error; delServidor = true }
    } catch { /* la respuesta no era JSON */ }
    // solo si la función de verdad no existe (y no es un error que mandó Mercado Pago)
    if (!delServidor && (error.context?.status === 404 || /Failed to send a request/i.test(msg))) {
      msg = 'La función de Mercado Pago no está publicada en Supabase (mirá el README, Actualización 3)'
    }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export const TIPOS_MP = {
  account_money: 'Dinero en cuenta',
  bank_transfer: 'Transferencia',
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
  prepaid_card: 'Tarjeta prepaga',
  ticket: 'Efectivo (Rapipago/Pago Fácil)'
}

export function describirCobro(c) {
  if (c.referencia?.startsWith('MIMA-')) return 'QR de la caja'
  if (c.operacion === 'money_transfer' || c.operacion === 'account_fund' || c.tipo === 'bank_transfer') return 'Transferencia'
  return TIPOS_MP[c.tipo] || c.tipo || 'Cobro'
}