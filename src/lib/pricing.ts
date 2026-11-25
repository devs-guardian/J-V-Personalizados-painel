import type { Config, Plataforma, Produto } from './types'

/** Custo do pedido de 1 unidade do produto (mesma conta da planilha). */
export function custo(p: Produto, c: Config): number {
  const base =
    (((p.gramas + p.purga) * c.filamento_kg) / 1000 + (p.tempo_min / p.pecas_mesa / 60) * c.maquina_h) * (1 + p.falhas) +
    (p.seu_tempo_peca / 60) * c.hora_sua
  return base * p.pecas_pedido + p.embalagem + (p.tempo_pedido / 60) * c.hora_sua
}

/** Menor preço que garante a margem desejada da plataforma (faixas de taxa). */
export function precoMinimo(cu: number, pl: Plataforma): number | null {
  const dl = 1 - pl.c_low - pl.outras - pl.imposto - pl.pag - pl.margem
  const dh = 1 - pl.c_high - pl.outras - pl.imposto - pl.pag - pl.margem
  if (dl <= 0 || dh <= 0) return null
  const pb = (cu + pl.f_low + pl.anuncio + pl.frete) / dl
  const pa = (cu + pl.f_high + pl.anuncio + pl.frete) / dh
  return pb < pl.lim ? pb : pa >= pl.lim ? pa : pl.lim
}

/** Sugestão: arredonda para terminar em ,90. */
export function precoSugerido(cu: number, pl: Plataforma): number | null {
  const m = precoMinimo(cu, pl)
  return m == null ? null : Math.round((Math.ceil(m + 0.1) - 0.1) * 100) / 100
}

/** Preço fixado manualmente ou, se não houver, o sugerido. */
export function precoAdotado(p: Produto, pl: Plataforma, c: Config): number | null {
  const fixo = p.precos?.[pl.id]
  if (fixo != null && !Number.isNaN(Number(fixo))) return Number(fixo)
  return precoSugerido(custo(p, c), pl)
}

/** Lucro por unidade já pagando custo, taxas, imposto, embalagem, anúncio e seu tempo. */
export function lucroUnitario(preco: number, cu: number, pl: Plataforma): number {
  const alto = preco >= pl.lim
  const fator = 1 - (alto ? pl.c_high : pl.c_low) - pl.outras - pl.imposto - pl.pag
  const fixo = (alto ? pl.f_high : pl.f_low) + pl.anuncio + pl.frete
  return preco * fator - fixo - cu
}
