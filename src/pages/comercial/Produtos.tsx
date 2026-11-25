import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Package, Plus } from 'lucide-react'
import { useForm, useWatch, type Control } from 'react-hook-form'
import { z } from 'zod'
import { Pager } from '@/components/pager'
import { CoresField, linhasCores, type LinhaCor } from '@/components/cores-field'
import { FormDialog } from '@/components/form-dialog'
import { CheckboxField, NumberField, TextField } from '@/components/form-fields'
import { EmptyState, Loading, PageHeader, TableCard } from '@/components/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePagination } from '@/hooks/use-pagination'
import { brl, minutosEmHoras, num, paraCampo, paraNumero, parseNum, pct } from '@/lib/format'
import { custo, lucroUnitario, precoAdotado } from '@/lib/pricing'
import { exec, useConfig, useFilamentos, usePlataformas, useProdutos, useTemCores } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Plataforma, Produto } from '@/lib/types'
import { numero, obrigatorio } from '@/lib/zod'

type Rascunho = Produto | Omit<Produto, 'id'>

const VAZIO: Omit<Produto, 'id'> = {
  nome: '', gramas: 0, purga: 0, tempo_min: 0, pecas_mesa: 1, falhas: 0.1, seu_tempo_peca: 0, embalagem: 1.8, tempo_pedido: 10, pecas_pedido: 1, ativo: true, precos: {},
}

export function Produtos() {
  const produtos = useProdutos()
  const plats = usePlataformas()
  const config = useConfig()
  const [edit, setEdit] = useState<Rascunho | null>(null)
  const qc = useQueryClient()
  const PL = plats.data ?? []
  const cfg = config.data
  const lista = produtos.data ?? []
  const pag = usePagination(lista)

  return (
    <>
      <PageHeader title="Produtos e preços" sub="Preço sugerido por canal e lucro por unidade, calculados pelas suas regras">
        <Button disabled={!plats.data} onClick={() => setEdit(VAZIO)}><Plus />Novo produto</Button>
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        {PL.map((p) => <Badge key={p.id} variant={p.margem >= 0.3 ? 'brand' : 'info'}>{p.nome}: margem {pct(p.margem)}</Badge>)}
      </div>
      {!cfg || produtos.isLoading ? <Loading /> : lista.length === 0 ? (
        <EmptyState icon={Package} title="Nenhum produto cadastrado"
          action={<Button disabled={!plats.data} onClick={() => setEdit(VAZIO)}><Plus />Novo produto</Button>}>
          Cadastre um produto para ver o preço sugerido em cada canal.
        </EmptyState>
      ) : (
        <TableCard>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Produto</TableHead><TableHead className="text-right">Peso</TableHead><TableHead className="text-right">Tempo</TableHead><TableHead className="text-right">Custo</TableHead>
              {PL.map((p) => <TableHead key={p.id} className="text-right">{p.nome}</TableHead>)}
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{pag.itens.map((p) => {
              const cu = custo(p, cfg)
              return (
                <TableRow key={p.id} className={p.ativo ? '' : 'opacity-50'}>
                  <TableCell className="min-w-52 font-semibold whitespace-normal">{p.nome}{!p.ativo && <> <Badge variant="muted">inativo</Badge></>}</TableCell>
                  <TableCell className="text-right">{num(p.gramas)} g</TableCell>
                  <TableCell className="text-right">{minutosEmHoras(p.tempo_min)}</TableCell>
                  <TableCell className="text-right">{brl(cu)}</TableCell>
                  {PL.map((pl) => {
                    const pr = precoAdotado(p, pl, cfg)
                    return (
                      <TableCell key={pl.id} className="text-right">
                        {pr == null ? <span className="text-destructive">inviável</span> : (
                          <><div className="font-semibold">{brl(pr)}{p.precos?.[pl.id] != null ? '*' : ''}</div><div className="text-xs font-semibold text-success">+{brl(lucroUnitario(pr, cu, pl))}</div></>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setEdit(p)}>Editar</Button></TableCell>
                </TableRow>
              )
            })}</TableBody>
          </Table>
          <Pager {...pag} className="border-t px-4 py-3" />
        </TableCard>
      )}
      <p className="mt-3 text-xs text-muted-foreground">* preço fixado manualmente. Sem asterisco: preço sugerido.</p>
      {edit && <ProdutoModal produto={edit} plats={PL} onClose={() => setEdit(null)} onDone={() => { void qc.invalidateQueries({ queryKey: ['produtos'] }); void qc.invalidateQueries({ queryKey: ['pedidos'] }) }} />}
    </>
  )
}

const naoNegativo = numero({ min: 0 })
const peloMenosUm = numero({ min: 1 })

/** Preço fixo opcional: vazio significa "usar o sugerido". */
const precoFixo = z.string().trim().transform((s, ctx) => {
  if (s === '') return undefined
  const n = paraNumero(s)
  if (Number.isFinite(n) && n >= 0) return n
  ctx.addIssue({ code: 'custom', message: 'Preço inválido' })
  return z.NEVER
})

const produtoSchema = z.object({
  nome: obrigatorio('Informe o nome.'),
  gramas: naoNegativo, purga: naoNegativo, tempo_min: naoNegativo,
  pecas_mesa: peloMenosUm, falhas: numero({ min: 0, max: 100 }), embalagem: naoNegativo,
  seu_tempo_peca: naoNegativo, tempo_pedido: naoNegativo, pecas_pedido: peloMenosUm,
  ativo: z.boolean(),
  cores: linhasCores({ maiorQue: 0 }),
  precos: z.record(z.string(), precoFixo),
})

function ProdutoModal({ produto, plats, onClose, onDone }: { produto: Rascunho; plats: Plataforma[]; onClose: () => void; onDone: () => void }) {
  const id = 'id' in produto ? produto.id : null
  const temCores = useTemCores()
  const filamentos = useFilamentos()
  const form = useForm({
    resolver: zodResolver(produtoSchema),
    defaultValues: {
      nome: produto.nome, gramas: paraCampo(produto.gramas), purga: paraCampo(produto.purga), tempo_min: paraCampo(produto.tempo_min), pecas_mesa: paraCampo(produto.pecas_mesa),
      falhas: paraCampo(Math.round(produto.falhas * 1000) / 10), seu_tempo_peca: paraCampo(produto.seu_tempo_peca), embalagem: paraCampo(produto.embalagem),
      tempo_pedido: paraCampo(produto.tempo_pedido), pecas_pedido: paraCampo(produto.pecas_pedido), ativo: produto.ativo,
      precos: Object.fromEntries([
        ...plats.map((p) => [p.id, ''] as const),
        ...Object.entries(produto.precos ?? {}).map(([k, v]) => [k, paraCampo(Number(v))] as const),
      ]) as Record<string, string>,
      cores: Object.entries(produto.cores ?? {}).map(([fil_id, g]) => ({ fil_id, gramas: paraCampo(g) })),
    },
  })
  // com cores cadastradas, o peso do produto é a soma delas
  const cores = useWatch({ control: form.control, name: 'cores' })
  const somaTravada = temCores && cores.length > 0
  useEffect(() => {
    if (!somaTravada) return
    const soma = cores.reduce((s, c) => s + parseNum(c.gramas), 0)
    form.setValue('gramas', paraCampo(Math.round(soma * 1000) / 1000), { shouldValidate: form.formState.isSubmitted })
  }, [somaTravada, JSON.stringify(cores)]) // eslint-disable-line react-hooks/exhaustive-deps
  const N = (name: Exclude<keyof z.input<typeof produtoSchema>, 'ativo' | 'precos' | 'cores'>, label: string) => <NumberField control={form.control} name={name} label={label} />

  return (
    <FormDialog form={form} title={id ? 'Editar produto' : 'Novo produto'} wide onClose={onClose}
      onSubmit={async ({ precos, falhas, cores: linhas, ...v }) => {
        const fixos = Object.fromEntries(Object.entries(precos).filter(([, valor]) => valor !== undefined))
        const receita = Object.fromEntries(linhas.map((l) => [l.fil_id, l.gramas]))
        const row = { ...v, falhas: falhas / 100, precos: fixos, ...(temCores ? { cores: receita } : {}) }
        await exec(id ? supabase.from('produtos').update(row).eq('id', id) : supabase.from('produtos').insert(row))
        onDone()
      }}>
      <TextField control={form.control} name="nome" label="Nome" autoFocus />
      <div className="grid items-start gap-4 sm:grid-cols-3">
        <NumberField control={form.control} name="gramas" label="Gramas (total do pedido)" readOnly={somaTravada} />{N('purga', 'Purga (g)')}{N('tempo_min', 'Tempo de impressão (min)')}
        {N('pecas_mesa', 'Peças por mesa')}{N('falhas', 'Falhas (%)')}{N('embalagem', 'Embalagem (R$)')}
        {N('seu_tempo_peca', 'Seu tempo por peça (min)')}{N('tempo_pedido', 'Tempo por pedido (min)')}{N('pecas_pedido', 'Peças no pedido')}
      </div>
      {temCores && (
        <CoresField control={form.control as unknown as Control<{ cores: LinhaCor[] }>} filamentos={filamentos.data}
          titulo="Cores do filamento" ajuda="Gramas de cada cor, na mesma base do peso total. Usado para o estoque e a compra." />
      )}
      <FieldSet className="gap-3">
        <FieldLegend variant="label">Preço fixo por canal (vazio = usar o sugerido)</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          {plats.map((p) => <NumberField key={p.id} control={form.control} name={`precos.${p.id}`} label={p.nome} />)}
        </div>
      </FieldSet>
      <CheckboxField control={form.control} name="ativo" label="Produto ativo (aparece nos pedidos)" />
    </FormDialog>
  )
}
