import { horasDoPedido } from './capacity'
import type { Pedido } from './types'

/** Quando a produção deveria terminar: início + tempo estimado de impressão. Só vale para pedidos em produção. */
export function prazoDoPedido(p: Pedido): Date | null {
  if (p.status !== 'producao' || !p.iniciado_em) return null
  const horas = horasDoPedido(p)
  if (!(horas > 0)) return null // sem tempo estimado não há como cobrar prazo
  return new Date(new Date(p.iniciado_em).getTime() + horas * 3_600_000)
}

export function estaAtrasado(p: Pedido, agora: number): boolean {
  const prazo = prazoDoPedido(p)
  return prazo !== null && agora > prazo.getTime()
}
