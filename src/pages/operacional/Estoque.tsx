import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Empty, Field, Head, Modal, Pill } from '../../components/ui'
import { exec, useFilamentos } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { num, parseNum } from '../../lib/format'
import { useAuth } from '../../lib/auth'
import type { Filamento } from '../../lib/types'

export function Estoque() {
  const fils = useFilamentos()
  const qc = useQueryClient()
  const { session } = useAuth()
  const [edit, setEdit] = useState<Filamento | Omit<Filamento, 'id'> | null>(null)
  const [pedir, setPedir] = useState<Filamento | null>(null)
  const lista = fils.data ?? []
  const baixos = lista.filter((f) => f.estoque_g <= f.min_g).length
  return (
    <>
      <Head title="Estoque de filamento" sub={baixos ? `${baixos} cor(es) abaixo do mínimo` : 'Tudo acima do mínimo'}>
        <button className="btn pri" onClick={() => setEdit({ cor: '', material: 'PLA', estoque_g: 0, min_g: 500, ativo: true })}>+ Novo filamento</button>
      </Head>
      {fils.isLoading ? <Empty>Carregando…</Empty> : lista.length === 0 ? <Empty>Cadastre os filamentos que você tem.</Empty> : (
        <Card className="clip"><div className="scroll"><table>
          <thead><tr><th>Cor</th><th>Material</th><th className="right">Estoque</th><th className="right">Mínimo</th><th>Situação</th><th /></tr></thead>
          <tbody>{lista.map((f) => {
            const baixo = f.estoque_g <= f.min_g
            return <tr key={f.id}><td className="b">{f.cor}</td><td>{f.material}</td><td className="right b">{num(f.estoque_g)} g</td><td className="right mu">{num(f.min_g)} g</td>
              <td><Pill kind={baixo ? 'dg' : 'ok'}>{baixo ? 'Repor' : 'OK'}</Pill></td>
              <td className="right nowrap"><button className="btn s" onClick={() => setEdit(f)}>Ajustar</button> <button className="btn s" onClick={() => setPedir(f)}>Solicitar reposição</button></td></tr>
          })}</tbody></table></div></Card>
      )}
      {edit && <FilModal f={edit} onClose={() => setEdit(null)} onDone={() => qc.invalidateQueries({ queryKey: ['filamentos'] })} />}
      {pedir && (
        <Modal title={`Repor ${pedir.cor}`} saveLabel="Enviar solicitação" onClose={() => setPedir(null)} onSave={async () => {
          await exec(supabase.from('reposicoes').insert({ tipo: 'filamento', item: `${pedir.cor} ${pedir.material}`, qtd: 1, unidade: 'kg', valor: 0, motivo: `Estoque em ${num(pedir.estoque_g)} g`, fil_id: pedir.id, por: session?.user.id }))
          await qc.invalidateQueries({ queryKey: ['reposicoes'] })
        }}><p>Cria uma solicitação de 1 kg para a gestão aprovar. Para outra quantidade ou valor, use a tela Reposição.</p></Modal>
      )}
    </>
  )
}

function FilModal({ f, onClose, onDone }: { f: Filamento | Omit<Filamento, 'id'>; onClose: () => void; onDone: () => void }) {
  const id = 'id' in f ? f.id : null
  const [v, setV] = useState({ cor: f.cor, material: f.material, estoque: String(f.estoque_g), min: String(f.min_g) })
  return (
    <Modal title={id ? 'Ajustar filamento' : 'Novo filamento'} onClose={onClose} onSave={async () => {
      if (!v.cor.trim()) throw new Error('Informe a cor.')
      const row = { cor: v.cor.trim(), material: v.material.trim() || 'PLA', estoque_g: Math.max(0, parseNum(v.estoque)), min_g: Math.max(0, parseNum(v.min)) }
      await exec(id ? supabase.from('filamentos').update(row).eq('id', id) : supabase.from('filamentos').insert(row)); onDone()
    }}>
      <div className="g2"><Field label="Cor"><input className="i" value={v.cor} onChange={(e) => setV({ ...v, cor: e.target.value })} autoFocus /></Field>
        <Field label="Material"><input className="i" value={v.material} onChange={(e) => setV({ ...v, material: e.target.value })} /></Field></div>
      <div className="g2"><Field label="Estoque (g)"><input className="i" type="number" value={v.estoque} onChange={(e) => setV({ ...v, estoque: e.target.value })} /></Field>
        <Field label="Mínimo (g)"><input className="i" type="number" value={v.min} onChange={(e) => setV({ ...v, min: e.target.value })} /></Field></div>
    </Modal>
  )
}
