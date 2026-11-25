import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { CircleCheck, History } from 'lucide-react'
import { Pager } from '@/components/pager'
import { FormDialog } from '@/components/form-dialog'
import { TextField } from '@/components/form-fields'
import { EmptyState, Loading, PageHeader, TableCard } from '@/components/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePagination } from '@/hooks/use-pagination'
import { brl, dataCurta, num } from '@/lib/format'
import { useAuth } from '@/lib/auth'
import { exec, useProfiles, useReposicoes } from '@/lib/queries'
import { REP_TIPO } from '@/lib/status'
import { supabase } from '@/lib/supabase'
import type { Reposicao } from '@/lib/types'
import { texto } from '@/lib/zod'

type Decisao = { r: Reposicao; aprovar: boolean }

export function Aprovacoes() {
  const reps = useReposicoes()
  const profs = useProfiles()
  const [sel, setSel] = useState<Decisao | null>(null)
  const nome = (id: string | null) => (profs.data ?? []).find((p) => p.id === id)?.nome || (profs.data ?? []).find((p) => p.id === id)?.email || '—'
  const lista = reps.data ?? []
  const pend = lista.filter((r) => r.status === 'pendente')
  const hist = lista.filter((r) => r.status !== 'pendente')
  const pagPend = usePagination(pend)
  const pagHist = usePagination(hist)

  return (
    <>
      <PageHeader title="Aprovações" sub={`${pend.length} solicitação(ões) aguardando decisão`} />
      {reps.isLoading ? <div className="mb-5"><Loading /></div> : pend.length === 0 ? (
        <EmptyState icon={CircleCheck} title="Nada pendente" className="mb-5">Não há solicitações aguardando a sua decisão.</EmptyState>
      ) : (
        <div className="mb-5 grid gap-4">
          {pagPend.itens.map((r) => (
            <Card key={r.id}>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge variant={r.tipo === 'expansao' ? 'brand' : 'warning'}>{REP_TIPO[r.tipo]}</Badge><b>{r.item}</b><b className="ml-auto text-xl">{brl(r.valor)}</b>
                </div>
                <div className="my-1.5 text-xs text-muted-foreground">{num(r.qtd)} {r.unidade} · pedido por {nome(r.por)} em {dataCurta(r.criado_em)}</div>
                {r.motivo && <div className="mb-2.5">{r.motivo}</div>}
                <div className="flex gap-2">
                  <Button onClick={() => setSel({ r, aprovar: true })}>Aprovar</Button>
                  <Button variant="destructive" onClick={() => setSel({ r, aprovar: false })}>Negar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Pager {...pagPend} />
        </div>
      )}
      <h3 className="my-2 text-lg font-bold">Histórico</h3>
      {reps.isLoading ? <Loading /> : hist.length === 0 ? (
        <EmptyState icon={History} title="Sem decisões ainda">O que você aprovar ou negar aparece aqui.</EmptyState>
      ) : (
        <TableCard>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Item</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Decisão</TableHead><TableHead>Nota</TableHead>
            </TableRow></TableHeader>
            <TableBody>{pagHist.itens.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{dataCurta(r.decidido_em ?? r.criado_em)}</TableCell>
                <TableCell className="min-w-44 font-semibold whitespace-normal">{r.item}<div className="text-xs font-normal text-muted-foreground">{num(r.qtd)} {r.unidade}</div></TableCell>
                <TableCell>{REP_TIPO[r.tipo]}</TableCell>
                <TableCell className="text-right">{brl(r.valor)}</TableCell>
                <TableCell><Badge variant={r.status === 'aprovado' ? 'success' : 'danger'}>{r.status === 'aprovado' ? (r.recebido ? 'Aprovado · recebido' : 'Aprovado') : 'Negado'}</Badge></TableCell>
                <TableCell className="min-w-40 whitespace-normal text-muted-foreground">{r.nota}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          <Pager {...pagHist} className="border-t px-4 py-3" />
        </TableCard>
      )}
      {sel && <DecisaoModal {...sel} onClose={() => setSel(null)} />}
    </>
  )
}

const schema = z.object({ nota: texto })

function DecisaoModal({ r, aprovar, onClose }: Decisao & { onClose: () => void }) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { nota: '' } })
  return (
    <FormDialog form={form} title={`${aprovar ? 'Aprovar' : 'Negar'}: ${r.item}`} description={`${num(r.qtd)} ${r.unidade} por ${brl(r.valor)}`}
      saveLabel={aprovar ? 'Aprovar compra' : 'Negar'} onClose={onClose}
      onSubmit={async ({ nota }) => {
        await exec(supabase.from('reposicoes').update({ status: aprovar ? 'aprovado' : 'negado', nota, decidido_por: session?.user.id, decidido_em: new Date().toISOString() }).eq('id', r.id))
        await qc.invalidateQueries({ queryKey: ['reposicoes'] })
      }}>
      <TextField control={form.control} name="nota" label="Observação para a equipe (opcional)" autoFocus />
    </FormDialog>
  )
}
