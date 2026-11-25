import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Empty, Field, Head, Modal, Pill, toast } from '../../components/ui'
import { exec, useFilamentos, useReposicoes } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { brl, dataCurta, num, parseNum } from '../../lib/format'
import { useAuth } from '../../lib/auth'
import type { RepTipo } from '../../lib/types'

export function Reposicao() {
  const reps = useReposicoes()
  const fils = useFilamentos()
  const { session } = useAuth()
  const qc = useQueryClient()
  const [novo, setNovo] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: ['reposicoes'] })
  const lista = reps.data ?? []
  async function receber(id: string) {
    try { await exec(supabase.rpc('receber_reposicao', { p_id: id })); await refresh(); await qc.invalidateQueries({ queryKey: ['filamentos'] }); toast('Recebimento registrado') } catch (e) { toast((e as Error).message) }
  }
  async function cancelar(id: string) {
    try { await exec(supabase.from('reposicoes').delete().eq('id', id)); await refresh() } catch (e) { toast((e as Error).message) }
  }
  return (
    <>
      <Head title="Reposição" sub="Peça filamento, insumos ou uma nova impressora. A gestão aprova antes da compra.">
        <button className="btn pri" onClick={() => setNovo(true)}>+ Nova solicitação</button>
      </Head>
      {reps.isLoading ? <Empty>Carregando…</Empty> : lista.length === 0 ? <Empty>Nenhuma solicitação ainda.</Empty> : (
        <Card className="clip"><div className="scroll"><table>
          <thead><tr><th>Data</th><th>Item</th><th className="right">Valor</th><th>Situação</th><th>Nota da gestão</th><th /></tr></thead>
          <tbody>{lista.map((r) => (
            <tr key={r.id}><td className="mu nowrap">{dataCurta(r.criado_em)}</td><td className="b">{r.item}<div className="mu sm">{num(r.qtd)} {r.unidade}</div></td><td className="right">{brl(r.valor)}</td>
              <td><Pill kind={r.status === 'pendente' ? 'wa' : r.status === 'negado' ? 'dg' : r.recebido ? 'mu' : 'ok'}>{r.status === 'pendente' ? 'Aguardando' : r.status === 'negado' ? 'Negado' : r.recebido ? 'Recebido' : 'Aprovado'}</Pill></td>
              <td className="mu">{r.nota}</td>
              <td className="right nowrap">
                {r.status === 'aprovado' && !r.recebido && <button className="btn s pri" onClick={() => void receber(r.id)}>Marcar recebido</button>}
                {r.status === 'pendente' && r.por === session?.user.id && <button className="btn s danger" onClick={() => void cancelar(r.id)}>Cancelar</button>}
              </td></tr>))}</tbody></table></div></Card>
      )}
      {novo && <NovaRep fils={(fils.data ?? []).map((f) => ({ id: f.id, nome: `${f.cor} ${f.material}` }))} uid={session?.user.id} onClose={() => setNovo(false)} onDone={() => { void refresh(); toast('Solicitação enviada') }} />}
    </>
  )
}

function NovaRep({ fils, uid, onClose, onDone }: { fils: { id: string; nome: string }[]; uid?: string; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ tipo: 'filamento' as RepTipo, item: '', qtd: '1', unidade: 'kg', valor: '', motivo: '', fil: '' })
  return (
    <Modal title="Nova solicitação" saveLabel="Enviar" wide onClose={onClose} onSave={async () => {
      const item = v.tipo === 'filamento' && v.fil ? fils.find((f) => f.id === v.fil)!.nome : v.item.trim()
      if (!item) throw new Error('Informe o item.')
      if (!(parseNum(v.qtd) > 0)) throw new Error('Quantidade inválida.')
      await exec(supabase.from('reposicoes').insert({ tipo: v.tipo, item, qtd: parseNum(v.qtd), unidade: v.unidade, valor: parseNum(v.valor), motivo: v.motivo.trim(), fil_id: v.tipo === 'filamento' && v.fil ? v.fil : null, por: uid })); onDone()
    }}>
      <div className="g2">
        <Field label="Tipo"><select className="i" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as RepTipo, unidade: e.target.value === 'filamento' ? 'kg' : 'un' })}>
          <option value="filamento">Filamento</option><option value="insumo">Insumo (embalagem, cola…)</option><option value="expansao">Expansão (impressora, peça)</option></select></Field>
        {v.tipo === 'filamento' ? (
          <Field label="Filamento"><select className="i" value={v.fil} onChange={(e) => setV({ ...v, fil: e.target.value })}><option value="">Outro (digitar)</option>{fils.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></Field>
        ) : <Field label="Item"><input className="i" value={v.item} onChange={(e) => setV({ ...v, item: e.target.value })} autoFocus /></Field>}
      </div>
      {v.tipo === 'filamento' && !v.fil && <Field label="Item"><input className="i" value={v.item} onChange={(e) => setV({ ...v, item: e.target.value })} /></Field>}
      <div className="g3">
        <Field label="Quantidade"><input className="i" type="number" step="any" value={v.qtd} onChange={(e) => setV({ ...v, qtd: e.target.value })} /></Field>
        <Field label="Unidade"><input className="i" value={v.unidade} onChange={(e) => setV({ ...v, unidade: e.target.value })} /></Field>
        <Field label="Valor estimado (R$)"><input className="i" inputMode="decimal" value={v.valor} onChange={(e) => setV({ ...v, valor: e.target.value })} /></Field>
      </div>
      <Field label="Motivo"><input className="i" value={v.motivo} onChange={(e) => setV({ ...v, motivo: e.target.value })} /></Field>
    </Modal>
  )
}
