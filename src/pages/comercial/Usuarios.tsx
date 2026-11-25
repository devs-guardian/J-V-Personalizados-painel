import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { Pager } from '@/components/pager'
import { OptionSelect } from '@/components/form-fields'
import { EmptyState, Loading, PageHeader, TableCard } from '@/components/page'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/lib/auth'
import { dataCurta } from '@/lib/format'
import { exec, useProfiles } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Papel } from '@/lib/types'

const PAPEIS = [
  { value: '', label: 'Sem acesso' },
  { value: 'gestao', label: 'Gestão (comercial)' },
  { value: 'operacional', label: 'Operacional' },
]

export function Usuarios() {
  const profs = useProfiles()
  const { session } = useAuth()
  const qc = useQueryClient()
  const [err, setErr] = useState('')
  const pag = usePagination(profs.data ?? [])
  async function set(id: string, role: Papel | null) {
    setErr('')
    try { await exec(supabase.from('profiles').update({ role }).eq('id', id)); await qc.invalidateQueries({ queryKey: ['profiles'] }) } catch (e) { setErr((e as Error).message) }
  }
  return (
    <>
      <PageHeader title="Usuários" sub="Quem entra no sistema e o que cada um enxerga" />
      <Alert className="mb-4">
        <AlertTitle>Como adicionar alguém</AlertTitle>
        <AlertDescription>No painel do Supabase, vá em Authentication → Users → Add user (e-mail e senha). Depois que a pessoa existir, ela aparece aqui sem acesso: escolha o papel.</AlertDescription>
      </Alert>
      {err && <Alert variant="destructive" className="mb-4"><AlertDescription>{err}</AlertDescription></Alert>}
      {profs.isLoading ? <Loading /> : pag.total === 0 ? (
        <EmptyState icon={Users} title="Nenhum usuário">Adicione a pessoa no painel do Supabase para ela aparecer aqui.</EmptyState>
      ) : (
        <TableCard>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Desde</TableHead><TableHead>Papel</TableHead><TableHead><span className="sr-only">Situação</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{pag.itens.map((p) => {
              const eu = p.id === session?.user.id
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.nome || '—'}{eu && <> <Badge variant="brand">você</Badge></>}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell className="text-muted-foreground">{dataCurta(p.criado_em)}</TableCell>
                  <TableCell>
                    <OptionSelect className="min-w-48" aria-label={`Papel de ${p.nome || p.email}`} value={p.role ?? ''} disabled={eu} options={PAPEIS}
                      onValueChange={(v) => void set(p.id, (v || null) as Papel | null)} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{!p.role && 'aguardando liberação'}</TableCell>
                </TableRow>
              )
            })}</TableBody>
          </Table>
          <Pager {...pag} className="border-t px-4 py-3" />
        </TableCard>
      )}
    </>
  )
}
