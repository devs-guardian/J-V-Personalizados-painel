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
export const parseNum = (s: string): number => {
  const n = parseFloat(String(s).replace(',', '.'))
  return Number.isNaN(n) ? 0 : n
}
export const STATUS_LABEL: Record<string, string> = {
  novo: 'Novo', producao: 'Em produção', pronto: 'Pronto', enviado: 'Enviado', cancelado: 'Cancelado',
}
