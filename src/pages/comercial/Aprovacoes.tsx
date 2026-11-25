import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Empty, Field, Head, Modal, Pill } from '../../components/ui'
import { exec, useProfiles, useReposicoes } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { brl, dataCurta, num } from '../../lib/format'
import { useAuth } from '../../lib/auth'
import type { Reposicao } from '../../lib/types'

const TIPO = { filamento: 'Filamento', insumo: 'Insumo', expansao: 'Expansão' }

export function Aprovacoes() {
  const reps = useReposicoes()
  const profs = useProfiles()
  const { session } = useAuth()
  const qc = useQueryClient()
  const [sel, setSel] = useState<{ r: Reposicao; aprovar: boolean } | null>(null)
  const [nota, setNota] = useState('')
  const nome = (id: string | null) => (profs.data ?? []).find((p) => p.id === id)?.nome || (profs.data ?? []).find((p) => p.id === id)?.email || '—'
  const lista = reps.data ?? []
  const pend = lista.filter((r) => r.status === 'pendente')
  const hist = lista.filter((r) => r.status !== 'pendente')

  return (
    <>
      <Head title="Aprovações" sub={`${pend.length} solicitação(ões) aguardando decisão`} />
      {pend.length === 0 ? <Empty>Nada pendente. 🎉</Empty> : (
        <div className="grid" style={{ marginBottom: 20 }}>
          {pend.map((r) => (
            <Card key={r.id} className="pad">
              <div className="row"><Pill kind={r.tipo === 'expansao' ? 'ac' : 'wa'}>{TIPO[r.tipo]}</Pill><b>{r.item}</b><span className="sp" /><b style={{ fontSize: 20 }}>{brl(r.valor)}</b></div>
              <div className="mu sm" style={{ margin: '6px 0' }}>{num(r.qtd)} {r.unidade} · pedido por {nome(r.por)} em {dataCurta(r.criado_em)}</div>
              {r.motivo && <div style={{ marginBottom: 10 }}>{r.motivo}</div>}
              <div className="row">
                <button className="btn pri" onClick={() => { setNota(''); setSel({ r, aprovar: true }) }}>Aprovar</button>
                <button className="btn danger" onClick={() => { setNota(''); setSel({ r, aprovar: false }) }}>Negar</button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <h3 style={{ margin: '8px 0' }}>Histórico</h3>
      {hist.length === 0 ? <Empty>Sem decisões ainda.</Empty> : (
        <Card className="clip"><div className="scroll"><table>
          <thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th className="right">Valor</th><th>Decisão</th><th>Nota</th></tr></thead>
          <tbody>{hist.map((r) => (
            <tr key={r.id}><td className="mu nowrap">{dataCurta(r.decidido_em ?? r.criado_em)}</td><td className="b">{r.item}<div className="mu sm">{num(r.qtd)} {r.unidade}</div></td><td>{TIPO[r.tipo]}</td>
              <td className="right">{brl(r.valor)}</td>
              <td><Pill kind={r.status === 'aprovado' ? 'ok' : 'dg'}>{r.status === 'aprovado' ? (r.recebido ? 'Aprovado · recebido' : 'Aprovado') : 'Negado'}</Pill></td>
              <td className="mu">{r.nota}</td></tr>))}</tbody></table></div></Card>
      )}
      {sel && (
        <Modal title={`${sel.aprovar ? 'Aprovar' : 'Negar'}: ${sel.r.item}`} saveLabel={sel.aprovar ? 'Aprovar compra' : 'Negar'} onClose={() => setSel(null)}
          onSave={async () => {
            await exec(supabase.from('reposicoes').update({ status: sel.aprovar ? 'aprovado' : 'negado', nota: nota.trim(), decidido_por: session?.user.id, decidido_em: new Date().toISOString() }).eq('id', sel.r.id))
            await qc.invalidateQueries({ queryKey: ['reposicoes'] })
          }}>
          <p>{num(sel.r.qtd)} {sel.r.unidade} por {brl(sel.r.valor)}</p>
          <Field label="Observação para a equipe (opcional)"><input className="i" value={nota} onChange={(e) => setNota(e.target.value)} autoFocus /></Field>
        </Modal>
      )}
    </>
  )
}
