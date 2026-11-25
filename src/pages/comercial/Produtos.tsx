import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Empty, Field, Head, Modal, Pill } from '../../components/ui'
import { exec, useConfig, usePlataformas, useProdutos } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { custo, lucroUnitario, precoAdotado } from '../../lib/pricing'
import { brl, minutosEmHoras, num, parseNum, pct } from '../../lib/format'
import type { Produto } from '../../lib/types'

const VAZIO: Omit<Produto, 'id'> = {
  nome: '', gramas: 0, purga: 0, tempo_min: 0, pecas_mesa: 1, falhas: 0.1, seu_tempo_peca: 0, embalagem: 1.8, tempo_pedido: 10, pecas_pedido: 1, ativo: true, precos: {},
}

export function Produtos() {
  const produtos = useProdutos()
  const plats = usePlataformas()
  const config = useConfig()
  const [edit, setEdit] = useState<Produto | Omit<Produto, 'id'> | null>(null)
  const qc = useQueryClient()
  const PL = plats.data ?? []
  const cfg = config.data
  const lista = produtos.data ?? []

  return (
    <>
      <Head title="Produtos e preços" sub="Preço sugerido por canal e lucro por unidade, calculados pelas suas regras">
        <button className="btn pri" onClick={() => setEdit(VAZIO)}>+ Novo produto</button>
      </Head>
      <div className="row" style={{ marginBottom: 16 }}>
        {PL.map((p) => <Pill key={p.id} kind={p.margem >= 0.3 ? 'ac' : 'in'}>{p.nome}: margem {pct(p.margem)}</Pill>)}
      </div>
      {!cfg || produtos.isLoading ? <Empty>Carregando…</Empty> : lista.length === 0 ? <Empty>Nenhum produto cadastrado.</Empty> : (
        <Card className="clip"><div className="scroll"><table>
          <thead><tr><th>Produto</th><th className="right">Peso</th><th className="right">Tempo</th><th className="right">Custo</th>{PL.map((p) => <th key={p.id} className="right">{p.nome}</th>)}<th /></tr></thead>
          <tbody>{lista.map((p) => {
            const cu = custo(p, cfg)
            return (
              <tr key={p.id} style={{ opacity: p.ativo ? 1 : 0.5 }}>
                <td className="b">{p.nome}{!p.ativo && <> <Pill kind="mu">inativo</Pill></>}</td>
                <td className="right nowrap">{num(p.gramas)} g</td><td className="right nowrap">{minutosEmHoras(p.tempo_min)}</td><td className="right nowrap">{brl(cu)}</td>
                {PL.map((pl) => {
                  const pr = precoAdotado(p, pl, cfg)
                  return <td key={pl.id} className="right nowrap">{pr == null ? <span className="dg">inviável</span> : <><div className="b">{brl(pr)}{p.precos?.[pl.id] != null ? '*' : ''}</div><div className="ok b sm">+{brl(lucroUnitario(pr, cu, pl))}</div></>}</td>
                })}
                <td className="right"><button className="btn s" onClick={() => setEdit(p)}>Editar</button></td>
              </tr>)
          })}</tbody></table></div></Card>
      )}
      <p className="mu sm">* preço fixado manualmente. Sem asterisco: preço sugerido.</p>
      {edit && <ProdutoModal produto={edit} plats={PL} onClose={() => setEdit(null)} onDone={() => qc.invalidateQueries({ queryKey: ['produtos'] })} />}
    </>
  )
}

function ProdutoModal({ produto, plats, onClose, onDone }: { produto: Produto | Omit<Produto, 'id'>; plats: { id: string; nome: string }[]; onClose: () => void; onDone: () => void }) {
  const id = 'id' in produto ? produto.id : null
  const [f, setF] = useState({
    nome: produto.nome, gramas: String(produto.gramas), purga: String(produto.purga), tempo_min: String(produto.tempo_min), pecas_mesa: String(produto.pecas_mesa),
    falhas: String(Math.round(produto.falhas * 1000) / 10), seu_tempo_peca: String(produto.seu_tempo_peca), embalagem: String(produto.embalagem),
    tempo_pedido: String(produto.tempo_pedido), pecas_pedido: String(produto.pecas_pedido), ativo: produto.ativo,
  })
  const [precos, setPrecos] = useState<Record<string, string>>(Object.fromEntries(Object.entries(produto.precos ?? {}).map(([k, v]) => [k, String(v)])))
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const N = (k: keyof typeof f, label: string) => <Field label={label}><input className="i" type="number" step="any" value={f[k] as string} onChange={set(k)} /></Field>

  return (
    <Modal title={id ? 'Editar produto' : 'Novo produto'} wide onClose={onClose}
      onSave={async () => {
        if (!f.nome.trim()) throw new Error('Informe o nome.')
        const fixos: Record<string, number> = {}
        Object.entries(precos).forEach(([k, v]) => { if (v.trim() !== '') fixos[k] = parseNum(v) })
        const row = {
          nome: f.nome.trim(), gramas: parseNum(f.gramas), purga: parseNum(f.purga), tempo_min: parseNum(f.tempo_min), pecas_mesa: Math.max(1, parseNum(f.pecas_mesa)),
          falhas: parseNum(f.falhas) / 100, seu_tempo_peca: parseNum(f.seu_tempo_peca), embalagem: parseNum(f.embalagem), tempo_pedido: parseNum(f.tempo_pedido),
          pecas_pedido: Math.max(1, parseNum(f.pecas_pedido)), ativo: f.ativo, precos: fixos,
        }
        await exec(id ? supabase.from('produtos').update(row).eq('id', id) : supabase.from('produtos').insert(row))
        onDone()
      }}>
      <Field label="Nome"><input className="i" value={f.nome} onChange={set('nome')} autoFocus /></Field>
      <div className="g3">{N('gramas', 'Gramas (total do pedido)')}{N('purga', 'Purga (g)')}{N('tempo_min', 'Tempo de impressão (min)')}</div>
      <div className="g3">{N('pecas_mesa', 'Peças por mesa')}{N('falhas', 'Falhas (%)')}{N('embalagem', 'Embalagem (R$)')}</div>
      <div className="g3">{N('seu_tempo_peca', 'Seu tempo por peça (min)')}{N('tempo_pedido', 'Tempo por pedido (min)')}{N('pecas_pedido', 'Peças no pedido')}</div>
      <div className="mu sm b" style={{ margin: '4px 0 8px' }}>Preço fixo por canal (vazio = usar o sugerido)</div>
      <div className="g2">{plats.map((p) => (
        <Field key={p.id} label={p.nome}><input className="i" type="number" step="0.01" value={precos[p.id] ?? ''} onChange={(e) => setPrecos({ ...precos, [p.id]: e.target.value })} /></Field>
      ))}</div>
      <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Produto ativo (aparece nos pedidos)</label>
    </Modal>
  )
}
