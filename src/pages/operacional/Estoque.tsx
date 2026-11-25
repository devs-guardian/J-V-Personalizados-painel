import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Boxes, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Pager } from '@/components/pager'
import { FormDialog } from '@/components/form-dialog'
import { NumberField, TextField } from '@/components/form-fields'
import { EmptyState, Loading, PageHeader, TableCard } from '@/components/page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/lib/auth'
import { num, paraCampo } from '@/lib/format'
import { aCaminhoPorFilamento, produtosSemCores, reservadoForaDaLista, reservadoPorFilamento, situacaoEstoque, type Situacao } from '@/lib/consumo'
import { exec, useFilamentos, usePedidos, useReposicoes, useTemCores } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Filamento } from '@/lib/types'
import { cn } from '@/lib/utils'
import { numero, obrigatorio, texto } from '@/lib/zod'

const SITUACAO: Record<Situacao, { texto: string; variant: 'danger' | 'warning' | 'success' }> = {
  falta: { texto: 'Falta', variant: 'danger' },
  repor: { texto: 'Repor', variant: 'warning' },
  ok: { texto: 'OK', variant: 'success' },
}

type Rascunho = Filamento | Omit<Filamento, 'id'>

const NOVO: Omit<Filamento, 'id'> = { cor: '', material: 'PLA', estoque_g: 0, min_g: 500, ativo: true }

export function Estoque() {
  const fils = useFilamentos()
  const qc = useQueryClient()
  const [edit, setEdit] = useState<Rascunho | null>(null)
  const [pedir, setPedir] = useState<Filamento | null>(null)
  const lista = fils.data ?? []
  const pag = usePagination(lista)
  // controle por cor (supabase/005): quanto os pedidos em aberto vão gastar
  const temCores = useTemCores()
  const pedidos = usePedidos()
  const reps = useReposicoes()
  const reservado = reservadoPorFilamento(pedidos.data ?? [])
  const aCaminho = aCaminhoPorFilamento(reps.data ?? [])
  const situacao = (f: Filamento) => situacaoEstoque(f, reservado[f.id] ?? 0, aCaminho[f.id] ?? 0)
  const semCores = temCores ? produtosSemCores(pedidos.data ?? []) : []
  const removidos = temCores && fils.data ? reservadoForaDaLista(pedidos.data ?? [], fils.data.map((f) => f.id)) : null
  const baixos = lista.filter((f) => (temCores ? situacao(f).situacao !== 'ok' : f.estoque_g <= f.min_g)).length
  const carregando = fils.isLoading || (temCores && (pedidos.isLoading || reps.isLoading))
  const gramas = (g: number) => (g ? `${num(g)} g` : '—')
  return (
    <>
      <PageHeader title="Estoque de filamento" sub={baixos ? `${baixos} cor(es) ${temCores ? 'para repor' : 'abaixo do mínimo'}` : 'Tudo acima do mínimo'}>
        <Button onClick={() => setEdit(NOVO)}><Plus />Novo filamento</Button>
      </PageHeader>
      {semCores.length > 0 && (
        <Alert className="mb-4 bg-warning-soft text-warning">
          <AlertDescription className="text-current">Pedidos em aberto sem cores cadastradas: {semCores.join(', ')}. Eles não entram no reservado.</AlertDescription>
        </Alert>
      )}
      {!carregando && removidos && removidos.gramas > 0 && (
        <Alert className="mb-4 bg-warning-soft text-warning">
          <AlertDescription className="text-current">{`Pedidos em aberto usam filamento removido (${num(removidos.gramas)} g). Revise as cores de: ${removidos.produtos.join(', ')}.`}</AlertDescription>
        </Alert>
      )}
      {carregando ? <Loading /> : lista.length === 0 ? (
        <EmptyState icon={Boxes} title="Nenhum filamento cadastrado"
          action={<Button onClick={() => setEdit(NOVO)}><Plus />Novo filamento</Button>}>
          Cadastre os filamentos que você tem para controlar o estoque.
        </EmptyState>
      ) : (
        <TableCard>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Cor</TableHead><TableHead>Material</TableHead><TableHead className="text-right">Estoque</TableHead>
              {temCores && <><TableHead className="text-right">Reservado</TableHead><TableHead className="text-right">A caminho</TableHead><TableHead className="text-right">Sobra</TableHead></>}
              <TableHead className="text-right">Mínimo</TableHead>
              {temCores && <TableHead className="text-right">Comprar</TableHead>}
              <TableHead>Situação</TableHead>
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{pag.itens.map((f) => {
              const baixo = f.estoque_g <= f.min_g
              const s = situacao(f)
              const selo = temCores ? SITUACAO[s.situacao] : SITUACAO[baixo ? 'falta' : 'ok']
              return (
                <TableRow key={f.id}>
                  <TableCell className="font-semibold">{f.cor}</TableCell><TableCell>{f.material}</TableCell>
                  <TableCell className="text-right font-semibold">{num(f.estoque_g)} g</TableCell>
                  {temCores && (
                    <>
                      <TableCell className="text-right">{num(reservado[f.id] ?? 0)} g</TableCell>
                      <TableCell className="text-right text-muted-foreground">{gramas(aCaminho[f.id] ?? 0)}</TableCell>
                      <TableCell className={cn('text-right font-semibold', s.sobra < 0 && 'text-destructive')}>{num(s.sobra)} g</TableCell>
                    </>
                  )}
                  <TableCell className="text-right text-muted-foreground">{num(f.min_g)} g</TableCell>
                  {temCores && (
                    <TableCell className="text-right font-semibold">{s.comprar ? `${num(Math.ceil(s.comprar))} g (${s.rolos} ${s.rolos > 1 ? 'rolos' : 'rolo'})` : '—'}</TableCell>
                  )}
                  <TableCell><Badge variant={selo.variant}>{temCores ? selo.texto : baixo ? 'Repor' : 'OK'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setEdit(f)}>Ajustar</Button>
                      <Button variant="outline" size="sm" onClick={() => setPedir(f)}>Solicitar reposição</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}</TableBody>
          </Table>
          <Pager {...pag} className="border-t px-4 py-3" />
        </TableCard>
      )}
      {edit && <FilModal f={edit} onClose={() => setEdit(null)} onDone={() => qc.invalidateQueries({ queryKey: ['filamentos'] })} />}
      {pedir && <ReposicaoModal f={pedir} rolos={temCores ? situacao(pedir).rolos : 1} onClose={() => setPedir(null)} />}
    </>
  )
}

const reposicaoSchema = z.object({ qtd: numero({ maiorQue: 0 }) })

function ReposicaoModal({ f, rolos, onClose }: { f: Filamento; rolos: number; onClose: () => void }) {
  const qc = useQueryClient()
  const { session } = useAuth()
  const form = useForm({ resolver: zodResolver(reposicaoSchema), defaultValues: { qtd: paraCampo(Math.max(1, rolos)) } })
  return (
    <FormDialog form={form} title={`Repor ${f.cor}`} description="Cria uma solicitação para a gestão aprovar. Para informar o valor, use a tela Reposição."
      saveLabel="Enviar solicitação" onClose={onClose}
      onSubmit={async ({ qtd }) => {
        await exec(supabase.from('reposicoes').insert({ tipo: 'filamento', item: `${f.cor} ${f.material}`, qtd, unidade: 'kg', valor: 0, motivo: `Estoque em ${num(f.estoque_g)} g`, fil_id: f.id, por: session?.user.id }))
        await qc.invalidateQueries({ queryKey: ['reposicoes'] })
      }}>
      <NumberField control={form.control} name="qtd" label="Quantidade (kg)" autoFocus />
    </FormDialog>
  )
}

const schema = z.object({
  cor: obrigatorio('Informe a cor.'),
  material: texto.transform((s) => s || 'PLA'),
  estoque_g: numero({ min: 0 }),
  min_g: numero({ min: 0 }),
})

function FilModal({ f, onClose, onDone }: { f: Rascunho; onClose: () => void; onDone: () => void }) {
  const id = 'id' in f ? f.id : null
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { cor: f.cor, material: f.material, estoque_g: paraCampo(f.estoque_g), min_g: paraCampo(f.min_g) } })
  return (
    <FormDialog form={form} title={id ? 'Ajustar filamento' : 'Novo filamento'} onClose={onClose} onSubmit={async (row) => {
      await exec(id ? supabase.from('filamentos').update(row).eq('id', id) : supabase.from('filamentos').insert(row)); onDone()
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="cor" label="Cor" autoFocus />
        <TextField control={form.control} name="material" label="Material" />
        <NumberField control={form.control} name="estoque_g" label="Estoque (g)" description="Em gramas. Um rolo de 1 kg = 1000" />
        <NumberField control={form.control} name="min_g" label="Mínimo (g)" description="Em gramas. Avisa quando chegar aqui" />
      </div>
    </FormDialog>
  )
}
