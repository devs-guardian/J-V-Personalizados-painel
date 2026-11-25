import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Empty, Head, Pill } from '../../components/ui'
import { exec, useProfiles } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { dataCurta } from '../../lib/format'
import { useAuth } from '../../lib/auth'
import type { Papel } from '../../lib/types'

export function Usuarios() {
  const profs = useProfiles()
  const { session } = useAuth()
  const qc = useQueryClient()
  const [err, setErr] = useState('')
  async function set(id: string, role: Papel | null) {
    setErr('')
    try { await exec(supabase.from('profiles').update({ role }).eq('id', id)); await qc.invalidateQueries({ queryKey: ['profiles'] }) } catch (e) { setErr((e as Error).message) }
  }
  return (
    <>
      <Head title="Usuários" sub="Quem entra no sistema e o que cada um enxerga" />
      <Card className="pad" style={{ marginBottom: 16 }}>
        <b>Como adicionar alguém:</b> no painel do Supabase, vá em Authentication → Users → Add user (e-mail e senha). Depois que a pessoa existir, ela aparece aqui sem acesso: escolha o papel.
      </Card>
      {err && <div className="err">{err}</div>}
      {profs.isLoading ? <Empty>Carregando…</Empty> : (
        <Card className="clip"><div className="scroll"><table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Desde</th><th>Papel</th><th /></tr></thead>
          <tbody>{(profs.data ?? []).map((p) => {
            const eu = p.id === session?.user.id
            return (
              <tr key={p.id}><td className="b">{p.nome || '—'}{eu && <> <Pill kind="ac">você</Pill></>}</td><td>{p.email}</td><td className="mu">{dataCurta(p.criado_em)}</td>
                <td><select className="i" value={p.role ?? ''} disabled={eu} onChange={(e) => void set(p.id, (e.target.value || null) as Papel | null)}>
                  <option value="">Sem acesso</option><option value="gestao">Gestão (comercial)</option><option value="operacional">Operacional</option></select></td>
                <td className="mu sm">{!p.role && 'aguardando liberação'}</td></tr>)
          })}</tbody></table></div></Card>
      )}
    </>
  )
}
