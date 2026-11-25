import { useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, ChartLine, Minus, Plus, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { Pager } from '@/components/pager'
import { EmptyState, KpiCard, Loading, PageHeader, TableCard } from '@/components/page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePagination } from '@/hooks/use-pagination'
import { backlogHoras, mediaChegadaDiaria, previsaoPorPedido, simular } from '@/lib/capacity'
import { brl, dataCurta, horas, num, pct } from '@/lib/format'
import { exec, useCapacidade, usePedidos, usePlataformas, useReposicoes } from '@/lib/queries'
import { supabase } from '@/lib/supabase'

const CORES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

/** Linha do tooltip de capacidade: cor, nome e valor em horas. */
function linhaHoras(config: ChartConfig) {
  return (valor: unknown, nome: unknown, item: { color?: string }): ReactNode => (
    <div className="flex w-full items-center gap-2">
      <span className="size-2.5 rounded-[2px]" style={{ background: item.color }} />
      <span className="text-muted-foreground">{config[String(nome)]?.label ?? String(nome)}</span>
      <span className="ml-auto font-mono font-medium tabular-nums">{num(Number(valor), 1)} h</span>
    </div>
  )
}

export function Resumo() {
  const pedidos = usePedidos()
  const plats = usePlataformas()
  const cap = useCapacidade()
  const reps = useReposicoes()
  const qc = useQueryClient()
  const [modo, setModo] = useState<'pedidos' | 'unidades'>('pedidos')
  const [prever, setPrever] = useState(true)

  const P = pedidos.data ?? []
  const PL = plats.data ?? []
  const agora = new Date()
  const mes = P.filter((p) => {
    const d = new Date(p.criado_em)
    return p.status !== 'cancelado' && d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear()
  })
  const fat = mes.reduce((s, p) => s + (p.pedido_financeiro?.total ?? 0), 0)
  const luc = mes.reduce((s, p) => s + (p.pedido_financeiro?.lucro ?? 0), 0)
  const abertos = P.filter((p) => ['novo', 'producao', 'pronto'].includes(p.status)).length
  const pend = (reps.data ?? []).filter((r) => r.status === 'pendente').length

  // ---- pedidos por dia, uma linha por canal ----
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
  const serie = useMemo(() => {
    const base = Array.from({ length: diasNoMes }, (_, i) => {
      const o: Record<string, number | null> = { dia: i + 1 }
      PL.forEach((pl) => { o[pl.id] = i + 1 <= agora.getDate() ? 0 : null })
      return o
    })
    mes.forEach((p) => {
      const d = new Date(p.criado_em).getDate() - 1
      const id = PL.find((pl) => pl.nome === p.plataforma)?.id
      const v = modo === 'pedidos' ? 1 : p.pedido_itens.reduce((s, i) => s + i.qtd, 0)
      if (id && base[d] && base[d][id] != null) base[d][id] = (base[d][id] as number) + v
    })
    return base
  }, [pedidos.data, plats.data, modo, diasNoMes]) // eslint-disable-line react-hooks/exhaustive-deps
  const canais: ChartConfig = Object.fromEntries(PL.map((pl, i) => [pl.id, { label: pl.nome, color: CORES[i % CORES.length] }]))
  const totais = PL.map((pl) => ({ id: pl.id, nome: pl.nome, total: serie.reduce((s, d) => s + (d[pl.id] || 0), 0) }))
  const lider = [...totais].sort((a, b) => b.total - a.total)[0]

  // ---- capacidade ----
  const c = cap.data
  const capDia = c ? c.impressoras * c.horas_dia : 0
  const backlog = backlogHoras(P)
  const media = prever ? mediaChegadaDiaria(P) : 0
  const N = 14
  const chegadas = Array.from({ length: N }, () => media)
  const sim = c ? simular(backlog, chegadas, capDia) : null
  const dias = sim
    ? sim.dias.map((d, i) => {
        const dt = new Date(); dt.setDate(dt.getDate() + i)
        return { dia: dataCurta(dt), feito: +d.feito.toFixed(1), resta: +d.resta.toFixed(1), capacidade: capDia }
      })
    : []
  const capacidadeConfig: ChartConfig = {
    feito: { label: 'Finalizado no dia', color: 'var(--chart-4)' },
    resta: { label: 'Fica para os próximos dias', color: 'var(--destructive)' },
    capacidade: { label: c ? `Capacidade (${c.impressoras} × ${c.horas_dia}h)` : 'Capacidade', color: 'var(--foreground)' },
  }
  const cenarios = c ? [1, 2, 3, 4].map((n) => ({ n, sim: simular(backlog, chegadas, n * c.horas_dia) })) : []
  const ok = (s: { pico: number }, n: number) => s.pico <= (c?.horas_dia ?? 20) * n * 0.5 // no máximo meio dia de atraso
  const sugerido = cenarios.find((x) => ok(x.sim, x.n))?.n ?? cenarios.length
  const prev = c ? previsaoPorPedido(P, capDia) : []
  const pagPrev = usePagination(prev)

  async function setImpressoras(n: number) {
    if (n < 1 || n > 20) return
    try { await exec(supabase.from('capacidade').update({ impressoras: n }).eq('id', 1)); await qc.invalidateQueries({ queryKey: ['capacidade'] }) }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <>
      <PageHeader title="Resumo" sub={agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}>
        <Button asChild><Link to="/comercial/pedidos"><Plus />Novo pedido</Link></Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <KpiCard label="Faturamento do mês" value={brl(fat)} />
        <KpiCard label="Lucro do mês" value={brl(luc)} className="text-success" />
        <KpiCard label="Margem real" value={fat ? pct(luc / fat) : '—'} />
        <KpiCard label="Pedidos em aberto" value={abertos} />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="font-bold">{modo === 'pedidos' ? 'Pedidos' : 'Unidades vendidas'} por dia, por canal</CardTitle>
          <CardDescription>Uma linha por canal de venda · dias do mês no eixo X</CardDescription>
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            {lider && lider.total > 0 && <Badge variant="success">{lider.nome} lidera</Badge>}
            <ToggleGroup type="single" variant="outline" size="sm" value={modo} onValueChange={(v) => v && setModo(v as 'pedidos' | 'unidades')} aria-label="O que mostrar no gráfico">
              <ToggleGroupItem value="pedidos" className="data-[state=on]:bg-foreground data-[state=on]:text-background">Pedidos</ToggleGroupItem>
              <ToggleGroupItem value="unidades" className="data-[state=on]:bg-foreground data-[state=on]:text-background">Unidades</ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent>
          {pedidos.isLoading || plats.isLoading ? <Loading /> : !totais.some((t) => t.total > 0) ? (
            <EmptyState icon={ChartLine} title="Sem vendas neste mês" className="h-75">O gráfico aparece assim que houver o primeiro pedido do mês.</EmptyState>
          ) : (
            <>
              <ChartContainer config={canais} className="aspect-auto h-75 w-full">
                <LineChart accessibilityLayer data={serie} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="dia" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, itens) => `Dia ${itens?.[0]?.payload?.dia}`} />} />
                  <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
                  {PL.map((pl) => (
                    <Line key={pl.id} type="monotone" dataKey={pl.id} stroke={`var(--color-${pl.id})`} strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                  ))}
                </LineChart>
              </ChartContainer>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {totais.map((t) => <span key={t.id}>{t.nome}: <b className="text-foreground">{t.total}</b></span>)}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-start gap-4">
        <Card className="min-w-0 flex-[2_1_460px]">
          <CardHeader>
            <CardTitle className="font-bold">Capacidade de produção por dia</CardTitle>
            <CardDescription>O que dá para finalizar em cada dia e o que passa para os próximos</CardDescription>
            {c && (
              <CardAction className="flex items-center gap-1.5 rounded-lg border bg-muted px-2 py-1.5">
                <span className="pl-1.5 text-xs text-muted-foreground">Impressoras</span>
                <Button variant="outline" size="icon-sm" onClick={() => void setImpressoras(c.impressoras - 1)} aria-label="Menos uma impressora"><Minus /></Button>
                <b className="min-w-4 text-center">{c.impressoras}</b>
                <Button size="icon-sm" onClick={() => void setImpressoras(c.impressoras + 1)} aria-label="Mais uma impressora"><Plus /></Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {!c || !sim || pedidos.isLoading ? <Loading /> : (
              <>
                <Field orientation="horizontal">
                  <Checkbox id="prever" checked={prever} onCheckedChange={(v) => setPrever(v === true)} />
                  <FieldLabel htmlFor="prever" className="text-xs font-normal">Incluir previsão de novos pedidos (média dos últimos 7 dias: {horas(mediaChegadaDiaria(P))}/dia)</FieldLabel>
                </Field>
                {!dias.some((d) => d.feito > 0 || d.resta > 0) ? (
                  <EmptyState icon={Printer} title="Nada para produzir" className="mt-3 h-72">Não há horas na fila nem previsão de novos pedidos para os próximos {N} dias.</EmptyState>
                ) : (
                  <ChartContainer config={capacidadeConfig} className="mt-3 aspect-auto h-72 w-full">
                    <ComposedChart accessibilityLayer data={dias} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="dia" tickLine={false} axisLine={false} />
                      <YAxis unit="h" tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent formatter={linhaHoras(capacidadeConfig)} />} />
                      <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
                      <Bar dataKey="feito" stackId="a" fill="var(--color-feito)" radius={[0, 0, 4, 4]} />
                      <Bar dataKey="resta" stackId="a" fill="var(--color-resta)" radius={[4, 4, 0, 0]} />
                      <Line dataKey="capacidade" stroke="var(--color-capacidade)" strokeDasharray="5 4" dot={false} strokeWidth={1.5} type="linear" />
                    </ComposedChart>
                  </ChartContainer>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="success">Hoje: finaliza {horas(sim.dias[0]?.feito ?? 0)} de produção</Badge>
                  {(sim.dias[0]?.resta ?? 0) > 0.05 ? <Badge variant="danger">{horas(sim.dias[0].resta)} ficam para amanhã</Badge> : <Badge variant="success">Nada acumulado para amanhã</Badge>}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 flex-[1_1_300px]">
          <CardHeader><CardTitle className="font-bold">Precisa de outra impressora?</CardTitle></CardHeader>
          {c && sim && (
            <CardContent className="flex flex-col gap-3">
              <Alert className={sugerido > c.impressoras ? 'bg-destructive-soft text-destructive' : 'bg-success-soft text-success'}>
                <AlertDescription className="font-semibold text-current">
                  {sugerido > c.impressoras
                    ? `Sim. Com ${c.impressoras} impressora${c.impressoras > 1 ? 's' : ''} a fila chega a ${horas(sim.pico)} (≈${(sim.pico / capDia).toFixed(1)} dia de atraso). Com ${sugerido}, a demanda cabe.`
                    : `Não por enquanto. Com ${c.impressoras} impressora${c.impressoras > 1 ? 's' : ''} a demanda atual cabe.`}
                </AlertDescription>
              </Alert>
              {cenarios.map(({ n, sim: s }) => (
                <div key={n} className="flex flex-col gap-1">
                  <Separator className="mb-2" />
                  <div className="flex items-center justify-between"><b>{n} impressora{n > 1 ? 's' : ''}</b>{ok(s, n) ? <Badge variant="success">Dá conta</Badge> : <Badge variant="danger">Acumula</Badge>}</div>
                  <div className="text-xs text-muted-foreground">
                    Capacidade {(c.horas_dia * n)}h/dia · maior fila {horas(s.pico)}<br />
                    {s.pico <= 0.01 ? 'Não acumula nenhum dia' : s.diasExtras > 0 ? `Fila zera ≈${s.diasExtras} dia(s) depois do horizonte de ${N} dias` : 'Fila zera dentro de 14 dias'}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Considera {c.horas_dia}h úteis por impressora/dia (ajuste em Custos e taxas), os pedidos em aberto e a previsão marcada.</p>
            </CardContent>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <TableCard className="min-w-0 flex-[2_1_460px]">
          <h2 className="px-5 pt-4 pb-3 text-base font-bold">Previsão de entrega da fila</h2>
          {pedidos.isLoading || cap.isLoading ? <Loading /> : prev.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Fila livre" className="rounded-none border-0">Nenhum pedido aguardando produção.</EmptyState>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Canal</TableHead><TableHead>Termina</TableHead></TableRow></TableHeader>
              <TableBody>{pagPrev.itens.map(({ pedido, dia }) => {
                const d = new Date(); d.setDate(d.getDate() + dia)
                return (
                  <TableRow key={pedido.id}>
                    <TableCell className="font-semibold">#{pedido.num}</TableCell>
                    <TableCell>{pedido.cliente}</TableCell>
                    <TableCell className="text-muted-foreground">{pedido.plataforma}</TableCell>
                    <TableCell>{dia === 0 ? <Badge variant="success">Hoje</Badge> : dia === 1 ? <Badge variant="warning">Amanhã</Badge> : <Badge variant="danger">{dataCurta(d)} (+{dia}d)</Badge>}</TableCell>
                  </TableRow>
                )
              })}</TableBody>
            </Table>
          )}
          <Pager {...pagPrev} className="border-t px-4 py-3" />
        </TableCard>
        <Card className="flex-[1_1_300px]">
          <CardHeader>
            <CardTitle className="font-bold">Aprovações</CardTitle>
            <CardAction>{pend ? <Badge variant="warning">{pend} pendente{pend > 1 ? 's' : ''}</Badge> : <Badge variant="success">Em dia</Badge>}</CardAction>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3.5">
            <p className="text-muted-foreground">Compras e expansões pedidas pela operação aguardam a sua decisão.</p>
            <Button variant="outline" asChild><Link to="/comercial/aprovacoes">Abrir aprovações</Link></Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
