import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Empty, Field, Head, Modal, StatusPill, toast } from '../../components/ui'
import { exec, useFilamentos, usePedidos } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { gramasDoPedido, horasDoPedido } from '../../lib/capacity'
import { dataCurta, horas, num, parseNum } from '../../lib/format'
import type { Pedido } from '../../lib/types'

export function Fila() {
  const pedidos = usePedidos()
  const qc = useQueryClient()
  const [fim, setFim] = useState<Pedido | null>(null)
  const fila = (pedidos.data ?? []).filter((p) => p.status === 'novo' || p.status === 'producao').sort((a, b) => a.criado_em.localeCompare(b.criado_em))
  const refresh = () => qc.invalidateQueries({ queryKey: ['pedidos'] })
  async function iniciar(p: Pedido) {
    try { await exec(supabase.from('pedidos').update({ status: 'producao' }).eq('id', p.id)); await refresh() } catch (e) { toast((e as Error).message) }
  }
  const totalH = fila.reduce((s, p) => s + horasDoPedido(p), 0)
  return (
    <>
      <Head title="Fila de produção" sub={`${fila.length} pedido(s) · ${horas(totalH)} de impressão na fila (mais antigos primeiro)`} />
      {pedidos.isLoading ? <Empty>Carregando…</Empty> : fila.length === 0 ? <Empty>Fila vazia. Bom trabalho!</Empty> : (
        <div className="grid">{fila.map((p) => (
          <Card key={p.id} className="pad">
            <div className="row"><b style={{ fontSize: 18 }}>#{p.num}</b><StatusPill status={p.status} /><span className="mu">{p.plataforma} · {dataCurta(p.criado_em)}</span><span className="sp" /><span className="mu">{horas(horasDoPedido(p))} · {num(gramasDoPedido(p))} g</span></div>
            <div style={{ margin: '8px 0' }}>{p.pedido_itens.map((i) => <div key={i.id}><b>{i.qtd}×</b> {i.nome}</div>)}</div>
            {p.obs && <div className="mu" style={{ marginBottom: 8 }}>Obs.: {p.obs}</div>}
            <div className="row">
              {p.status === 'novo' && <button className="btn" onClick={() => void iniciar(p)}>Iniciar produção</button>}
              <button className="btn pri" onClick={() => setFim(p)}>Concluir</button>
            </div>
          </Card>))}</div>
      )}
      {fim && <Concluir pedido={fim} onClose={() => setFim(null)} onDone={() => { void refresh(); void qc.invalidateQueries({ queryKey: ['filamentos'] }); toast('Pedido pronto para envio') }} />}
    </>
  )
}

function Concluir({ pedido, onClose, onDone }: { pedido: Pedido; onClose: () => void; onDone: () => void }) {
  const fils = useFilamentos()
  const [fil, setFil] = useState('')
  const [g, setG] = useState(String(Math.round(gramasDoPedido(pedido))))
  return (
    <Modal title={`Concluir pedido #${pedido.num}`} saveLabel="Marcar como pronto" onClose={onClose}
      onSave={async () => { await exec(supabase.rpc('concluir_pedido', { p_id: pedido.id, p_fil: fil || null, p_gramas: fil ? parseNum(g) : 0 })); onDone() }}>
      <p className="mu">Informe o filamento usado para baixar o estoque (opcional).</p>
      <Field label="Filamento">
        <select className="i" value={fil} onChange={(e) => setFil(e.target.value)}>
          <option value="">Não baixar estoque</option>
          {(fils.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.cor} · {f.material} ({num(f.estoque_g)} g)</option>)}
        </select>
      </Field>
      {fil && <Field label="Gramas usadas"><input className="i" type="number" value={g} onChange={(e) => setG(e.target.value)} /></Field>}
    </Modal>
  )
}
