import type { Filamento, Pedido, Reposicao } from './types'

export const GRAMAS_POR_ROLO = 1000

type PorFilamento = Record<string, number>

/** Pedidos que ainda vão gastar filamento. */
const emAberto = (p: Pedido) => p.status === 'novo' || p.status === 'producao'

function somar(destino: PorFilamento, id: string, gramas: number) {
  destino[id] = (destino[id] ?? 0) + gramas
}

export function consumoDoPedido(p: Pedido): PorFilamento {
  const total: PorFilamento = {}
  p.pedido_itens.forEach((i) => Object.entries(i.cores ?? {}).forEach(([id, g]) => somar(total, id, i.qtd * g)))
  return total
}

export function reservadoPorFilamento(pedidos: Pedido[]): PorFilamento {
  const total: PorFilamento = {}
  pedidos.filter(emAberto).forEach((p) => Object.entries(consumoDoPedido(p)).forEach(([id, g]) => somar(total, id, g)))
  return total
}

/** Reposições pedidas (aguardando ou aprovadas) que ainda não chegaram, em gramas. */
export function aCaminhoPorFilamento(reps: Reposicao[]): PorFilamento {
  const total: PorFilamento = {}
  reps.forEach((r) => {
    if (r.fil_id && !r.recebido && r.status !== 'negado' && r.unidade.toLowerCase().startsWith('kg')) somar(total, r.fil_id, r.qtd * 1000)
  })
  return total
}

export function produtosSemCores(pedidos: Pedido[]): string[] {
  const nomes = pedidos.filter(emAberto).flatMap((p) => p.pedido_itens.filter((i) => !Object.keys(i.cores ?? {}).length).map((i) => i.nome))
  return [...new Set(nomes)]
}

/** Consumo de pedidos em aberto em filamentos que não estão mais na lista (desativados ou apagados). */
export function reservadoForaDaLista(pedidos: Pedido[], idsDaLista: string[]) {
  const ids = new Set(idsDaLista)
  let gramas = 0
  const produtos = new Set<string>()
  pedidos.filter(emAberto).forEach((p) => p.pedido_itens.forEach((i) => Object.entries(i.cores ?? {}).forEach(([id, g]) => {
    if (ids.has(id)) return
    gramas += i.qtd * g
    produtos.add(i.nome)
  })))
  return { gramas: arredondar(gramas), produtos: [...produtos] }
}

export type Situacao = 'falta' | 'repor' | 'ok'

// evita que 0,1 + 0,2 vire "falta um tiquinho"
const arredondar = (n: number) => Math.round(n * 1000) / 1000

export function situacaoEstoque(f: Filamento, reservado: number, aCaminho: number) {
  const sobra = arredondar(f.estoque_g - reservado)
  const disponivel = arredondar(sobra + aCaminho)
  const comprar = Math.max(0, arredondar(f.min_g - disponivel))
  const situacao: Situacao = disponivel < 0 ? 'falta' : disponivel <= f.min_g ? 'repor' : 'ok'
  return { sobra, comprar, rolos: Math.ceil(comprar / GRAMAS_POR_ROLO), situacao }
}
