export type Papel = 'gestao' | 'operacional'
export type PedidoStatus = 'novo' | 'producao' | 'pronto' | 'enviado' | 'cancelado'
export type RepTipo = 'filamento' | 'insumo' | 'expansao'
export type RepStatus = 'pendente' | 'aprovado' | 'negado'

export interface Profile { id: string; nome: string | null; email: string | null; role: Papel | null; criado_em: string }
export interface Config { id: number; filamento_kg: number; maquina_h: number; hora_sua: number }
export interface Capacidade { id: number; impressoras: number; horas_dia: number }
export interface Plataforma {
  id: string; nome: string; ordem: number; lim: number; c_low: number; f_low: number; c_high: number; f_high: number
  outras: number; imposto: number; pag: number; anuncio: number; frete: number; margem: number
}
export interface Produto {
  id: string; nome: string; gramas: number; purga: number; tempo_min: number; pecas_mesa: number; falhas: number
  seu_tempo_peca: number; embalagem: number; tempo_pedido: number; pecas_pedido: number; ativo: boolean
  precos: Record<string, number>
  /** { id do filamento: gramas }, na mesma base de `gramas` (supabase/005). */
  cores?: Record<string, number>
}
export interface PedidoItem {
  id: string; pedido_id: string; produto_id: string | null; nome: string; qtd: number; gramas: number; tempo_min: number
  /** { id do filamento: gramas por unidade }, preenchido pelo banco (supabase/005). */
  cores?: Record<string, number>
}
export interface Pedido {
  id: string; num: number; cliente: string; plataforma: string; status: PedidoStatus; obs: string; rastreio: string
  criado_em: string; pronto_em: string | null; enviado_em: string | null
  /** Preenchido pelo banco (supabase/004). */
  iniciado_em?: string | null
  pedido_itens: PedidoItem[]
  pedido_financeiro: { total: number; lucro: number } | null
}
export interface Filamento { id: string; cor: string; material: string; estoque_g: number; min_g: number; ativo: boolean }
export interface Reposicao {
  id: string; tipo: RepTipo; item: string; qtd: number; unidade: string; valor: number; motivo: string; fil_id: string | null
  por: string | null; criado_em: string; status: RepStatus; nota: string; decidido_por: string | null; decidido_em: string | null
  recebido: boolean; recebido_em: string | null
}
