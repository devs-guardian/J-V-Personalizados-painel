import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, Empty, Head, Pill, toast } from '../../components/ui'
import { useCapacidade, usePedidos, usePlataformas, useReposicoes, exec } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { backlogHoras, mediaChegadaDiaria, previsaoPorPedido, simular } from '../../lib/capacity'
import { brl, dataCurta, horas, num, pct } from '../../lib/format'
import { Link } from 'react-router-dom'

const CORES = ['#FF7A2F', '#7FB0FF', '#F5B84B', '#4ADE9B', '#C79BFF']
const TT = { background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: 10, color: 'var(--tx)' }

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
      PL.forEach((pl) => { o[pl.nome] = i + 1 <= agora.getDate() ? 0 : null })
      return o
    })
    mes.forEach((p) => {
      const d = new Date(p.criado_em).getDate() - 1
      const v = modo === 'pedidos' ? 1 : p.pedido_itens.reduce((s, i) => s + i.qtd, 0)
      if (base[d] && base[d][p.plataforma] != null) base[d][p.plataforma] = (base[d][p.plataforma] as number) + v
    })
    return base
  }, [mes.length, PL.length, modo, diasNoMes]) // eslint-disable-line react-hooks/exhaustive-deps
  const totais = PL.map((pl) => ({ nome: pl.nome, total: serie.reduce((s, d) => s + ((d[pl.nome] as number) || 0), 0) }))
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
        return { dia: dataCurta(dt), feito: +d.feito.toFixed(1), resta: +d.resta.toFixed(1) }
      })
    : []
  const cenarios = c ? [1, 2, 3, 4].map((n) => ({ n, sim: simular(backlog, chegadas, n * c.horas_dia) })) : []
  const ok = (s: { pico: number }, n: number) => s.pico <= (c?.horas_dia ?? 20) * n * 0.5 // no máximo meio dia de atraso
  const sugerido = cenarios.find((x) => ok(x.sim, x.n))?.n ?? cenarios.length
  const prev = c ? previsaoPorPedido(P, capDia).slice(0, 8) : []

  async function setImpressoras(n: number) {
    if (n < 1 || n > 20) return
    try { await exec(supabase.from('capacidade').update({ impressoras: n }).eq('id', 1)); await qc.invalidateQueries({ queryKey: ['capacidade'] }) }
    catch (e) { toast((e as Error).message) }
  }

  return (
    <>
      <Head title="Resumo" sub={agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}>
        <Link to="/comercial/pedidos" className="btn pri">+ Novo pedido</Link>
      </Head>

      <div className="grid kpis">
        <Card className="pad kpi"><div className="l">Faturamento do mês</div><div className="v">{brl(fat)}</div></Card>
        <Card className="pad kpi"><div className="l">Lucro do mês</div><div className="v ok">{brl(luc)}</div></Card>
        <Card className="pad kpi"><div className="l">Margem real</div><div className="v">{fat ? pct(luc / fat) : '—'}</div></Card>
        <Card className="pad kpi"><div className="l">Pedidos em aberto</div><div className="v">{abertos}</div></Card>
      </div>

      <Card className="pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div><b style={{ fontSize: 16 }}>{modo === 'pedidos' ? 'Pedidos' : 'Unidades vendidas'} por dia, por canal</b>
            <div className="mu sm">Uma linha por canal de venda · dias do mês no eixo X</div></div>
          <span className="sp" />
          {lider && lider.total > 0 && <Pill kind="ok">{lider.nome} lidera</Pill>}
          <div className="chips" style={{ margin: 0 }}>
            <button className={`chip ${modo === 'pedidos' ? 'on' : ''}`} onClick={() => setModo('pedidos')}>Pedidos</button>
            <button className={`chip ${modo === 'unidades' ? 'on' : ''}`} onClick={() => setModo('unidades')}>Unidades</button>
          </div>
        </div>
        <div style={{ height: 300, marginTop: 12 }}>
          <ResponsiveContainer>
            <LineChart data={serie} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--bd)" vertical={false} />
              <XAxis dataKey="dia" stroke="var(--mu)" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} stroke="var(--mu)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={TT} labelFormatter={(d) => `Dia ${d}`} />
              <Legend />
              {PL.map((pl, i) => (
                <Line key={pl.id} type="monotone" dataKey={pl.nome} stroke={CORES[i % CORES.length]} strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="row sm mu" style={{ marginTop: 6 }}>
          {totais.map((t, i) => <span key={t.nome}><i style={{ display: 'inline-block', width: 14, height: 3, background: CORES[i % CORES.length], borderRadius: 2, marginRight: 6, verticalAlign: 'middle' }} />{t.nome}: <b style={{ color: 'var(--tx)' }}>{t.total}</b></span>)}
        </div>
      </Card>

      <div className="flex">
        <Card className="pad" style={{ flex: '2 1 460px', minWidth: 0 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div><b style={{ fontSize: 16 }}>Capacidade de produção por dia</b>
              <div className="mu sm">O que dá para finalizar em cada dia e o que passa para os próximos</div></div>
            <span className="sp" />
            {c && (
              <div className="row" style={{ gap: 6, background: 'var(--sf2)', border: '1px solid var(--bd)', borderRadius: 10, padding: '6px 8px' }}>
                <span className="mu sm" style={{ paddingLeft: 6 }}>Impressoras</span>
                <button className="btn s" onClick={() => void setImpressoras(c.impressoras - 1)} aria-label="Menos uma impressora">−</button>
                <b style={{ minWidth: 16, textAlign: 'center' }}>{c.impressoras}</b>
                <button className="btn s pri" onClick={() => void setImpressoras(c.impressoras + 1)} aria-label="Mais uma impressora">+</button>
              </div>
            )}
          </div>
          {!c || !sim ? <Empty>Carregando…</Empty> : (
            <>
              <div className="row sm" style={{ margin: '10px 0 0' }}>
                <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={prever} onChange={(e) => setPrever(e.target.checked)} /> Incluir previsão de novos pedidos (média dos últimos 7 dias: {horas(mediaChegadaDiaria(P))}/dia)</label>
              </div>
              <div style={{ height: 290, marginTop: 8 }}>
                <ResponsiveContainer>
                  <ComposedChart data={dias} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--bd)" vertical={false} />
                    <XAxis dataKey="dia" stroke="var(--mu)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--mu)" tick={{ fontSize: 12 }} unit="h" />
                    <Tooltip contentStyle={TT} formatter={(v: number, n) => [`${num(v, 1)} h`, n]} />
                    <Legend />
                    <Bar dataKey="feito" name="Finalizado no dia" stackId="a" fill="#4ADE9B" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="resta" name="Fica para os próximos dias" stackId="a" fill="#FF8A7A" radius={[4, 4, 0, 0]} />
                    <Line dataKey={() => capDia} name={`Capacidade (${c.impressoras} × ${c.horas_dia}h)`} stroke="var(--tx)" strokeDasharray="5 4" dot={false} strokeWidth={1.5} type="linear" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <Pill kind="ok">Hoje: finaliza {horas(sim.dias[0]?.feito ?? 0)} de produção</Pill>
                {(sim.dias[0]?.resta ?? 0) > 0.05 ? <Pill kind="dg">{horas(sim.dias[0].resta)} ficam para amanhã</Pill> : <Pill kind="ok">Nada acumulado para amanhã</Pill>}
              </div>
            </>
          )}
        </Card>

        <Card className="pad" style={{ flex: '1 1 300px', minWidth: 0 }}>
          <b style={{ fontSize: 16 }}>Precisa de outra impressora?</b>
          {!c || !sim ? null : (
            <>
              <div className={`note ${sugerido > c.impressoras ? 'dg' : 'ok'}`} style={{ margin: '12px 0 4px' }}>
                {sugerido > c.impressoras
                  ? `Sim. Com ${c.impressoras} impressora${c.impressoras > 1 ? 's' : ''} a fila chega a ${horas(sim.pico)} (≈${(sim.pico / capDia).toFixed(1)} dia de atraso). Com ${sugerido}, a demanda cabe.`
                  : `Não por enquanto. Com ${c.impressoras} impressora${c.impressoras > 1 ? 's' : ''} a demanda atual cabe.`}
              </div>
              {cenarios.map(({ n, sim: s }) => (
                <div key={n} style={{ padding: '12px 0', borderTop: '1px solid var(--bd)' }}>
                  <div className="row"><b>{n} impressora{n > 1 ? 's' : ''}</b><span className="sp" />{ok(s, n) ? <Pill kind="ok">Dá conta</Pill> : <Pill kind="dg">Acumula</Pill>}</div>
                  <div className="mu sm" style={{ marginTop: 4, lineHeight: 1.5 }}>
                    Capacidade {(c.horas_dia * n)}h/dia · maior fila {horas(s.pico)}<br />
                    {s.pico <= 0.01 ? 'Não acumula nenhum dia' : s.diasExtras > 0 ? `Fila zera ≈${s.diasExtras} dia(s) depois do horizonte de ${N} dias` : 'Fila zera dentro de 14 dias'}
                  </div>
                </div>
              ))}
              <div className="mu sm" style={{ paddingTop: 6 }}>Considera {c.horas_dia}h úteis por impressora/dia (ajuste em Custos e taxas), os pedidos em aberto e a previsão marcada.</div>
            </>
          )}
        </Card>
      </div>

      <div className="flex">
        <Card className="clip" style={{ flex: '2 1 460px', minWidth: 0 }}>
          <div style={{ padding: '18px 20px 8px' }}><b style={{ fontSize: 16 }}>Previsão de entrega da fila</b></div>
          {prev.length === 0 ? <div className="pad mu">Nenhum pedido aguardando produção.</div> : (
            <div className="scroll"><table>
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Canal</th><th>Termina</th></tr></thead>
              <tbody>{prev.map(({ pedido, dia }) => {
                const d = new Date(); d.setDate(d.getDate() + dia)
                return <tr key={pedido.id}><td className="b">#{pedido.num}</td><td>{pedido.cliente}</td><td className="mu">{pedido.plataforma}</td>
                  <td>{dia === 0 ? <Pill kind="ok">Hoje</Pill> : dia === 1 ? <Pill kind="wa">Amanhã</Pill> : <Pill kind="dg">{dataCurta(d)} (+{dia}d)</Pill>}</td></tr>
              })}</tbody></table></div>
          )}
        </Card>
        <Card className="pad" style={{ flex: '1 1 300px' }}>
          <div className="row"><b style={{ fontSize: 16 }}>Aprovações</b><span className="sp" />{pend ? <Pill kind="wa">{pend} pendente{pend > 1 ? 's' : ''}</Pill> : <Pill kind="ok">Em dia</Pill>}</div>
          <p className="mu" style={{ margin: '10px 0 14px' }}>Compras e expansões pedidas pela operação aguardam a sua decisão.</p>
          <Link to="/comercial/aprovacoes" className="btn">Abrir aprovações</Link>
        </Card>
      </div>
    </>
  )
}
