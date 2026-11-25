import type { Pedido } from './types'

export const ABERTOS = ['novo', 'producao'] as const

export function horasDoPedido(p: Pedido): number {
  return p.pedido_itens.reduce((s, i) => s + (i.qtd * i.tempo_min) / 60, 0)
}
export function gramasDoPedido(p: Pedido): number {
  return p.pedido_itens.reduce((s, i) => s + i.qtd * i.gramas, 0)
}

/** Horas de impressão de pedidos ainda por produzir. */
export function backlogHoras(pedidos: Pedido[]): number {
  return pedidos.filter((p) => (ABERTOS as readonly string[]).includes(p.status)).reduce((s, p) => s + horasDoPedido(p), 0)
}

export interface DiaSim { feito: number; resta: number }
export interface Sim { dias: DiaSim[]; diasExtras: number; pico: number }

/** Fila simples: cada dia produz até a capacidade; o resto passa para o dia seguinte. */
export function simular(backlog0: number, chegadas: number[], capDia: number): Sim {
  let q = backlog0
  const dias: DiaSim[] = []
  for (const h of chegadas) {
    q += h
    const feito = Math.min(capDia, q)
    q -= feito
    dias.push({ feito, resta: q })
  }
  let extras = 0
  while (q > 0.01 && extras < 365) {
    q -= Math.min(capDia, q)
    extras++
  }
  return { dias, diasExtras: extras, pico: Math.max(0, ...dias.map((d) => d.resta)) }
}

/** Média diária de horas de pedidos criados nos últimos `n` dias (para a previsão). */
export function mediaChegadaDiaria(pedidos: Pedido[], n = 7): number {
  const corte = Date.now() - n * 86400000
  const h = pedidos.filter((p) => p.status !== 'cancelado' && new Date(p.criado_em).getTime() >= corte).reduce((s, p) => s + horasDoPedido(p), 0)
  return h / n
}

/** Em que dia (0 = hoje) cada pedido aberto termina, por ordem de chegada. */
export function previsaoPorPedido(pedidos: Pedido[], capDia: number) {
  const abertos = pedidos
    .filter((p) => (ABERTOS as readonly string[]).includes(p.status))
    .sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime())
  let acc = 0
  return abertos.map((p) => {
    acc += horasDoPedido(p)
    return { pedido: p, dia: Math.max(0, Math.ceil(acc / capDia) - 1) }
  })
}
