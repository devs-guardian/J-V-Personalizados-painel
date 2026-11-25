import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { ClipboardList, Plus } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Pager } from '@/components/pager'
import { FormDialog } from '@/components/form-dialog'
import { NumberField, SelectField, TextField } from '@/components/form-fields'
import { EmptyState, Loading, PageHeader, TableCard } from '@/components/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/lib/auth'
import { brl, dataCurta, num } from '@/lib/format'
import { exec, useFilamentos, useReposicoes } from '@/lib/queries'
import { REP_TIPO } from '@/lib/status'
import { supabase } from '@/lib/supabase'
import type { RepTipo } from '@/lib/types'
import { numero, texto } from '@/lib/zod'

export function Reposicao() {
  const reps = useReposicoes()
  const fils = useFilamentos()
  const { session } = useAuth()
  const qc = useQueryClient()
  const [novo, setNovo] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: ['reposicoes'] })
  const lista = reps.data ?? []
  const pag = usePagination(lista)
  async function receber(id: string) {
    try { await exec(supabase.rpc('receber_reposicao', { p_id: id })); await refresh(); await qc.invalidateQueries({ queryKey: ['filamentos'] }); toast.success('Recebimento registrado') } catch (e) { toast.error((e as Error).message) }
  }
  async function cancelar(id: string) {
    try { await exec(supabase.from('reposicoes').delete().eq('id', id)); await refresh() } catch (e) { toast.error((e as Error).message) }
  }
  return (
    <>
      <PageHeader title="Reposição" sub="Peça filamento, insumos ou uma nova impressora. A gestão aprova antes da compra.">
        <Button onClick={() => setNovo(true)}><Plus />Nova solicitação</Button>
      </PageHeader>
      {reps.isLoading ? <Loading /> : lista.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhuma solicitação ainda"
          action={<Button onClick={() => setNovo(true)}><Plus />Nova solicitação</Button>}>
          Peça filamento, insumos ou equipamento para a gestão aprovar.
        </EmptyState>
      ) : (
        <TableCard>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Situação</TableHead><TableHead>Nota da gestão</TableHead>
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{pag.itens.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{dataCurta(r.criado_em)}</TableCell>
                <TableCell className="min-w-44 font-semibold whitespace-normal">{r.item}<div className="text-xs font-normal text-muted-foreground">{num(r.qtd)} {r.unidade}</div></TableCell>
                <TableCell className="text-right">{brl(r.valor)}</TableCell>
                <TableCell>
                  <Badge variant={r.status === 'pendente' ? 'warning' : r.status === 'negado' ? 'danger' : r.recebido ? 'muted' : 'success'}>
                    {r.status === 'pendente' ? 'Aguardando' : r.status === 'negado' ? 'Negado' : r.recebido ? 'Recebido' : 'Aprovado'}
                  </Badge>
                </TableCell>
                <TableCell className="min-w-40 whitespace-normal text-muted-foreground">{r.nota}</TableCell>
                <TableCell className="text-right">
                  {r.status === 'aprovado' && !r.recebido && <Button size="sm" onClick={() => void receber(r.id)}>Marcar recebido</Button>}
                  {r.status === 'pendente' && r.por === session?.user.id && <Button variant="destructive" size="sm" onClick={() => void cancelar(r.id)}>Cancelar</Button>}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          <Pager {...pag} className="border-t px-4 py-3" />
        </TableCard>
      )}
      {novo && <NovaRep fils={(fils.data ?? []).map((f) => ({ id: f.id, nome: `${f.cor} ${f.material}` }))} uid={session?.user.id} onClose={() => setNovo(false)} onDone={() => { void refresh(); toast.success('Solicitação enviada') }} />}
    </>
  )
}

const schema = z.object({
  tipo: z.enum(['filamento', 'insumo', 'expansao']),
  filamento: z.string(),
  item: texto,
  qtd: numero({ maiorQue: 0 }),
  unidade: texto,
  // vazio vale zero (valor ainda desconhecido); texto inválido é recusado
  valor: z.string().trim().transform((s) => s || '0').pipe(numero({ min: 0 })),
  motivo: texto,
}).superRefine((v, ctx) => {
  if (!(v.tipo === 'filamento' && v.filamento) && !v.item) ctx.addIssue({ code: 'custom', path: ['item'], message: 'Informe o item.' })
})

const TIPOS: Record<RepTipo, string> = {
  filamento: REP_TIPO.filamento, insumo: 'Insumo (embalagem, cola…)', expansao: 'Expansão (impressora, peça)',
}

function NovaRep({ fils, uid, onClose, onDone }: { fils: { id: string; nome: string }[]; uid?: string; onClose: () => void; onDone: () => void }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { tipo: 'filamento' as RepTipo, filamento: '', item: '', qtd: '1', unidade: 'kg', valor: '', motivo: '' } })
  const [tipo, filamento] = useWatch({ control: form.control, name: ['tipo', 'filamento'] })
  const ehFilamento = tipo === 'filamento'
  return (
    <FormDialog form={form} title="Nova solicitação" saveLabel="Enviar" wide onClose={onClose} onSubmit={async (v) => {
      const doEstoque = v.tipo === 'filamento' ? fils.find((f) => f.id === v.filamento) : undefined
      await exec(supabase.from('reposicoes').insert({
        tipo: v.tipo, item: doEstoque?.nome ?? v.item, qtd: v.qtd, unidade: v.unidade, valor: v.valor, motivo: v.motivo, fil_id: doEstoque?.id ?? null, por: uid,
      }))
      onDone()
    }}>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <SelectField control={form.control} name="tipo" label="Tipo" onValueChange={(t) => form.setValue('unidade', t === 'filamento' ? 'kg' : 'un')}
          options={(Object.keys(TIPOS) as RepTipo[]).map((t) => ({ value: t, label: TIPOS[t] }))} />
        {ehFilamento
          ? <SelectField control={form.control} name="filamento" label="Filamento" options={[{ value: '', label: 'Outro (digitar)' }, ...fils.map((f) => ({ value: f.id, label: f.nome }))]} />
          : <TextField control={form.control} name="item" label="Item" />}
      </div>
      {ehFilamento && !filamento && <TextField control={form.control} name="item" label="Item" />}
      <div className="grid items-start gap-4 sm:grid-cols-3">
        <NumberField control={form.control} name="qtd" label="Quantidade" />
        <TextField control={form.control} name="unidade" label="Unidade" />
        <NumberField control={form.control} name="valor" label="Valor estimado (R$)" />
      </div>
      <TextField control={form.control} name="motivo" label="Motivo" />
    </FormDialog>
  )
}
