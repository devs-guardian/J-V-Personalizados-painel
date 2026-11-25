import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Empty, Field, Head, Modal, toast } from '../../components/ui'
import { exec, usePedidos } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { dataCurta } from '../../lib/format'
import type { Pedido } from '../../lib/types'

export function Envios() {
  const pedidos = usePedidos()
  const qc = useQueryClient()
  const [sel, setSel] = useState<Pedido | null>(null)
  const [ras, setRas] = useState('')
  const prontos = (pedidos.data ?? []).filter((p) => p.status === 'pronto')
  const enviados = (pedidos.data ?? []).filter((p) => p.status === 'enviado').slice(0, 15)
  return (
    <>
      <Head title="Envios" sub={`${prontos.length} pedido(s) prontos para despachar`} />
      {prontos.length === 0 ? <Empty>Nada para enviar agora.</Empty> : (
        <div className="grid" style={{ marginBottom: 20 }}>{prontos.map((p) => (
          <Card key={p.id} className="pad">
            <div className="row"><b style={{ fontSize: 18 }}>#{p.num}</b><span className="b">{p.cliente || 'Sem nome'}</span><span className="mu">{p.plataforma}</span><span className="sp" /><button className="btn pri" onClick={() => { setRas(''); setSel(p) }}>Marcar como enviado</button></div>
            <div style={{ marginTop: 8 }}>{p.pedido_itens.map((i) => <div key={i.id}>{i.qtd}× {i.nome}</div>)}</div>
            {p.obs && <div className="mu" style={{ marginTop: 6 }}>Obs.: {p.obs}</div>}
          </Card>))}</div>
      )}
      <h3 style={{ margin: '8px 0' }}>Últimos enviados</h3>
      {enviados.length === 0 ? <Empty>Nenhum envio registrado.</Empty> : (
        <Card className="clip"><div className="scroll"><table><thead><tr><th>#</th><th>Cliente</th><th>Canal</th><th>Enviado em</th><th>Rastreio</th></tr></thead>
          <tbody>{enviados.map((p) => <tr key={p.id}><td className="b">#{p.num}</td><td>{p.cliente}</td><td className="mu">{p.plataforma}</td><td className="mu">{dataCurta(p.enviado_em ?? p.criado_em)}</td><td>{p.rastreio || '—'}</td></tr>)}</tbody></table></div></Card>
      )}
      {sel && (
        <Modal title={`Enviar pedido #${sel.num}`} saveLabel="Confirmar envio" onClose={() => setSel(null)}
          onSave={async () => {
            await exec(supabase.from('pedidos').update({ status: 'enviado', rastreio: ras.trim(), enviado_em: new Date().toISOString() }).eq('id', sel.id))
            await qc.invalidateQueries({ queryKey: ['pedidos'] }); toast('Envio registrado')
          }}>
          <Field label="Código de rastreio (opcional)"><input className="i" value={ras} onChange={(e) => setRas(e.target.value)} autoFocus /></Field>
        </Modal>
      )}
    </>
  )
}
