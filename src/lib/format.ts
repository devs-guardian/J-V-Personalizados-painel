export const brl = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const num = (n: number | null | undefined, d = 0) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: d })
export const pct = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? '—' : (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'
export const horas = (h: number) => {
  const m = Math.round(h * 60)
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}
export const minutosEmHoras = (min: number) => horas(min / 60)
export const dataCurta = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
/** "18:30" se for hoje; senão "26/11 18:30". */
export const quando = (d: Date) => {
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? hora : `${dataCurta(d)} ${hora}`
}
/**
 * Número digitado em português. Com vírgula, os pontos separam milhares; sem vírgula,
 * "1.000" é mil, mas "1.5" e "0.125" são decimais. Texto inválido ou vazio vira NaN.
 */
export function paraNumero(texto: string): number {
  let s = texto.trim()
  if (!s) return NaN
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  return Number(s)
}
/** Número gravado -> texto de um campo (com vírgula, para não ser lido como milhar). */
export const paraCampo = (n: number) => String(n).replace('.', ',')
export const parseNum = (s: string): number => {
  const n = paraNumero(String(s))
  return Number.isNaN(n) ? 0 : n
}
export const STATUS_LABEL: Record<string, string> = {
  novo: 'Novo', producao: 'Em produção', pronto: 'Pronto', enviado: 'Enviado', cancelado: 'Cancelado',
}
