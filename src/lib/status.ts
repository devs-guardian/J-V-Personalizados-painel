import type { PedidoStatus, RepTipo } from './types'

export const PEDIDO_STATUS: Record<PedidoStatus, { label: string; variant: 'warning' | 'info' | 'success' | 'brand' | 'danger' }> = {
  novo: { label: 'Novo', variant: 'warning' },
  producao: { label: 'Em produção', variant: 'info' },
  pronto: { label: 'Pronto', variant: 'success' },
  enviado: { label: 'Enviado', variant: 'brand' },
  cancelado: { label: 'Cancelado', variant: 'danger' },
}

/** Não é gravado no banco: é calculado a partir do prazo da produção. */
export const ATRASADO = { label: 'Atrasado', variant: 'danger' } as const

export const REP_TIPO: Record<RepTipo, string> = { filamento: 'Filamento', insumo: 'Insumo', expansao: 'Expansão' }
