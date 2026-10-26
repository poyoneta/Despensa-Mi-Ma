import { supabase } from './supabase.js'

// Llama a la función "mercadopago" de Supabase (supabase/functions/mercadopago)
export async function mercadoPago(accion, datos = {}) {
  const { data, error } = await supabase.functions.invoke('mercadopago', { body: { accion, ...datos } })
  if (error) {
    let msg = error.message || 'Error con Mercado Pago'
    try {
      const j = await error.context?.json()
      if (j?.error) msg = j.error
    } catch { /* la respuesta no era JSON */ }
    if (/Failed to send a request|not found|404/i.test(msg)) {
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
