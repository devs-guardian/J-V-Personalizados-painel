import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Empty, Field, Head, Modal, StatusPill, toast } from '../../components/ui'
import { exec, useConfig, usePedidos, usePlataformas, useProdutos } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { custo, lucroUnitario, precoAdotado } from '../../lib/pricing'
import { brl, dataCurta, parseNum, pct } from '../../lib/format'
import type { Pedido, PedidoStatus } from '../../lib/types'

const FILTROS: [string, string][] = [['abertos', 'Em aberto'], ['novo', 'Novos'], ['producao', 'Em produção'], ['pronto', 'Prontos'], ['enviado', 'Enviados'], ['cancelado', 'Cancelados'], ['todos', 'Todos']]

export function Pedidos() {
  const pedidos = usePedidos()
  const [filtro, setFiltro] = useState('abertos')
  const [novo, setNovo] = useState(false)
  const [edit, setEdit] = useState<Pedido | null>(null)
  const [del, setDel] = useState<Pedido | null>(null)
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['pedidos'] })

  const lista = (pedidos.data ?? []).filter((p) => filtro === 'todos' || (filtro === 'abertos' ? ['novo', 'producao', 'pronto'].includes(p.status) : p.status === filtro))

  return (
    <>
      <Head title="Pedidos" sub={`${(pedidos.data ?? []).filter((p) => ['novo', 'producao', 'pronto'].includes(p.status)).length} em aberto`}>
        <button className="btn pri" onClick={() => setNovo(true)}>+ Novo pedido</button>
      </Head>
      <div className="chips">
        {FILTROS.map(([k, t]) => <button key={k} className={`chip ${filtro === k ? 'on' : ''}`} onClick={() => setFiltro(k)}>{t}</button>)}
      </div>
      {pedidos.isLoading ? <Empty>Carregando…</Empty> : lista.length === 0 ? <Empty>Nenhum pedido neste filtro.</Empty> : (
        <Card className="clip"><div className="scroll"><table>
          <thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Itens</th><th>Canal</th><th>Status</th><th className="right">Total</th><th className="right">Lucro</th><th /></tr></thead>
          <tbody>{lista.map((p) => (
            <tr key={p.id}>
              <td className="b">#{p.num}</td><td className="mu nowrap">{dataCurta(p.criado_em)}</td><td>{p.cliente || <span className="mu">—</span>}{p.obs && <div className="mu sm">{p.obs}</div>}</td>
              <td>{p.pedido_itens.map((i) => <div key={i.id}>{i.qtd}× {i.nome}</div>)}</td>
              <td className="mu">{p.plataforma}</td>
              <td><StatusPill status={p.status} />{p.rastreio && <div className="mu sm">{p.rastreio}</div>}</td>
              <td className="right b">{brl(p.pedido_financeiro?.total)}</td>
              <td className="right b ok">{brl(p.pedido_financeiro?.lucro)}</td>
              <td className="right nowrap"><button className="btn s" onClick={() => setEdit(p)}>Status</button> <button className="btn s danger" onClick={() => setDel(p)}>Excluir</button></td>
            </tr>))}</tbody></table></div></Card>
      )}
      {novo && <NovoPedido onClose={() => setNovo(false)} onDone={() => { void refresh(); toast('Pedido criado') }} />}
      {edit && (
        <StatusModal pedido={edit} onClose={() => setEdit(null)} onDone={() => void refresh()} />
      )}
      {del && (
        <Modal title={`Excluir pedido #${del.num}?`} saveLabel="Excluir" onClose={() => setDel(null)}
          onSave={async () => { await exec(supabase.from('pedidos').delete().eq('id', del.id)); await refresh() }}>
          <p>Isso apaga o pedido do histórico e dos totais. Para manter o registro, use “Status → Cancelado”.</p>
        </Modal>
      )}
    </>
  )
}

function StatusModal({ pedido, onClose, onDone }: { pedido: Pedido; onClose: () => void; onDone: () => void }) {
  const [st, setSt] = useState<PedidoStatus>(pedido.status)
  const [ras, setRas] = useState(pedido.rastreio)
  return (
    <Modal title={`Pedido #${pedido.num}`} onClose={onClose}
      onSave={async () => {
        const patch: Record<string, unknown> = { status: st, rastreio: ras.trim() }
        if (st === 'pronto' && !pedido.pronto_em) patch.pronto_em = new Date().toISOString()
        if (st === 'enviado' && !pedido.enviado_em) patch.enviado_em = new Date().toISOString()
        await exec(supabase.from('pedidos').update(patch).eq('id', pedido.id)); onDone()
      }}>
      <Field label="Status">
        <select className="i" value={st} onChange={(e) => setSt(e.target.value as PedidoStatus)}>
          {(['novo', 'producao', 'pronto', 'enviado', 'cancelado'] as const).map((s) => <option key={s} value={s}>{({ novo: 'Novo', producao: 'Em produção', pronto: 'Pronto', enviado: 'Enviado', cancelado: 'Cancelado' })[s]}</option>)}
        </select>
      </Field>
      <Field label="Código de rastreio"><input className="i" value={ras} onChange={(e) => setRas(e.target.value)} /></Field>
    </Modal>
  )
}

interface Linha { produto_id: string; qtd: string; preco: string }

function NovoPedido({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const produtos = useProdutos()
  const plats = usePlataformas()
  const config = useConfig()
  const [cliente, setCliente] = useState('')
  const [obs, setObs] = useState('')
  const PL = plats.data ?? []
  const prods = (produtos.data ?? []).filter((p) => p.ativo)
  const [platId, setPlatId] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const pl = PL.find((x) => x.id === platId) ?? PL[PL.length - 1]
  const cfg = config.data

  const precoDe = (produtoId: string, plId = pl?.id) => {
    const p = prods.find((x) => x.id === produtoId); const plt = PL.find((x) => x.id === plId)
    if (!p || !plt || !cfg) return ''
    const v = precoAdotado(p, plt, cfg)
    return v == null ? '' : String(v).replace('.', ',')
  }
  const addLinha = () => { if (prods[0]) setLinhas((l) => [...l, { produto_id: prods[0].id, qtd: '1', preco: precoDe(prods[0].id) }]) }
  if (linhas.length === 0 && prods.length && pl && cfg) queueMicrotask(addLinha)

  const mudaPlat = (id: string) => { setPlatId(id); setLinhas((ls) => ls.map((l) => ({ ...l, preco: precoDe(l.produto_id, id) }))) }
  let total = 0, lucro = 0
  linhas.forEach((l) => {
    const p = prods.find((x) => x.id === l.produto_id)
    const q = parseNum(l.qtd), pr = parseNum(l.preco)
    total += q * pr
    if (p && pl && cfg) lucro += q * lucroUnitario(pr, custo(p, cfg), pl)
  })

  return (
    <Modal title="Novo pedido" saveLabel="Criar pedido" wide onClose={onClose}
      onSave={async () => {
        if (!pl || !cfg) throw new Error('Dados ainda carregando.')
        const itens = linhas.map((l) => {
          const p = prods.find((x) => x.id === l.produto_id)!
          const qtd = Math.round(parseNum(l.qtd)); const preco = parseNum(l.preco)
          if (qtd < 1) throw new Error('A quantidade deve ser ao menos 1.')
          if (!(preco > 0)) throw new Error('Informe o preço de cada item.')
          return { produto_id: p.id, nome: p.nome, qtd, preco, lucro: lucroUnitario(preco, custo(p, cfg), pl), gramas: (p.gramas + p.purga) * (1 + p.falhas), tempo_min: p.tempo_min / p.pecas_mesa }
        })
        if (!itens.length) throw new Error('Adicione ao menos um item.')
        await exec(supabase.rpc('criar_pedido', { p_cliente: cliente.trim(), p_plataforma: pl.nome, p_obs: obs.trim(), p_itens: itens }))
        onDone()
      }}>
      <div className="g2">
        <Field label="Cliente"><input className="i" value={cliente} onChange={(e) => setCliente(e.target.value)} autoFocus /></Field>
        <Field label="Canal">
          <select className="i" value={pl?.id ?? ''} onChange={(e) => mudaPlat(e.target.value)}>{PL.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        </Field>
      </div>
      <div className="mu sm b" style={{ marginBottom: 6 }}>Itens (o preço vem do cálculo e pode ser ajustado)</div>
      {linhas.map((l, i) => (
        <div className="item-row" key={i}>
          <select className="i" value={l.produto_id} onChange={(e) => setLinhas(linhas.map((x, j) => j === i ? { ...x, produto_id: e.target.value, preco: precoDe(e.target.value) } : x))}>
            {prods.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <input className="i" type="number" min={1} value={l.qtd} onChange={(e) => setLinhas(linhas.map((x, j) => j === i ? { ...x, qtd: e.target.value } : x))} aria-label="Quantidade" />
          <input className="i" inputMode="decimal" value={l.preco} onChange={(e) => setLinhas(linhas.map((x, j) => j === i ? { ...x, preco: e.target.value } : x))} aria-label="Preço unitário" />
          <button type="button" className="btn s danger" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))} aria-label="Remover item">×</button>
        </div>
      ))}
      <button type="button" className="btn s" onClick={addLinha}>+ Adicionar item</button>
      <div style={{ height: 12 }} />
      <Field label="Observações (nome do pet, personalização, prazo…)"><input className="i" value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
      <div className="row" style={{ borderTop: '1px dashed var(--bd)', paddingTop: 12 }}>
        <span className="mu">Total</span><span className="sp" /><b style={{ fontSize: 24, fontFamily: "'Space Grotesk'" }}>{brl(total)}</b>
      </div>
      <div className="row ok b sm"><span>Lucro estimado</span><span className="sp" /><span>{brl(lucro)} · {pct(total ? lucro / total : 0)}</span></div>
    </Modal>
  )
}
