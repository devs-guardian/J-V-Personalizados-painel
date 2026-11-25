import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, ShoppingBag, X } from 'lucide-react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Pager } from '@/components/pager'
import { ComboboxField } from '@/components/combobox'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormDialog } from '@/components/form-dialog'
import { NumberField, SelectField, TextField } from '@/components/form-fields'
import { EmptyState, Loading, PageHeader, StatusBadge, TableCard } from '@/components/page'
import { Button } from '@/components/ui/button'
import { FieldError, FieldLegend, FieldSet } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAgora } from '@/hooks/use-agora'
import { usePagination } from '@/hooks/use-pagination'
import { brl, dataCurta, parseNum, pct } from '@/lib/format'
import { estaAtrasado } from '@/lib/prazo'
import { custo, lucroUnitario, precoAdotado } from '@/lib/pricing'
import { exec, useConfig, usePedidos, usePlataformas, useProdutos, useTemCores } from '@/lib/queries'
import { PEDIDO_STATUS } from '@/lib/status'
import { supabase } from '@/lib/supabase'
import type { Pedido, PedidoStatus } from '@/lib/types'
import { numero, obrigatorio, texto } from '@/lib/zod'

const FILTROS: [string, string][] = [['abertos', 'Em aberto'], ['novo', 'Novos'], ['producao', 'Em produção'], ['atrasado', 'Atrasados'], ['pronto', 'Prontos'], ['enviado', 'Enviados'], ['cancelado', 'Cancelados'], ['todos', 'Todos']]
const ABERTOS = ['novo', 'producao', 'pronto']

export function Pedidos() {
  const pedidos = usePedidos()
  const [filtro, setFiltro] = useState('abertos')
  const [novo, setNovo] = useState(false)
  const [edit, setEdit] = useState<Pedido | null>(null)
  const [del, setDel] = useState<Pedido | null>(null)
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['pedidos'] })
  const agora = useAgora()

  const lista = (pedidos.data ?? []).filter((p) => {
    if (filtro === 'todos') return true
    if (filtro === 'abertos') return ABERTOS.includes(p.status)
    if (filtro === 'atrasado') return estaAtrasado(p, agora)
    return p.status === filtro
  })
  const pag = usePagination(lista, filtro)

  return (
    <>
      <PageHeader title="Pedidos" sub={`${(pedidos.data ?? []).filter((p) => ABERTOS.includes(p.status)).length} em aberto`}>
        <Button onClick={() => setNovo(true)}><Plus />Novo pedido</Button>
      </PageHeader>
      <ToggleGroup type="single" variant="outline" value={filtro} onValueChange={(v) => v && setFiltro(v)} className="mb-4 flex-wrap" aria-label="Filtrar pedidos">
        {FILTROS.map(([k, t]) => (
          <ToggleGroupItem key={k} value={k} className="rounded-full px-3.5 data-[state=on]:bg-foreground data-[state=on]:text-background">{t}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      {pedidos.isLoading ? <Loading /> : lista.length === 0 ? (
        <EmptyState icon={ShoppingBag} title={filtro === 'todos' ? 'Nenhum pedido ainda' : 'Nenhum pedido neste filtro'}
          action={<Button onClick={() => setNovo(true)}><Plus />Novo pedido</Button>}>
          {filtro === 'todos' ? 'Registre a primeira venda para acompanhar a produção e o lucro.' : 'Escolha outro filtro ou registre um novo pedido.'}
        </EmptyState>
      ) : (
        <TableCard>
          <Table>
            <TableHeader><TableRow>
              <TableHead>#</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Itens</TableHead><TableHead>Canal</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{pag.itens.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold">#{p.num}</TableCell>
                <TableCell className="text-muted-foreground">{dataCurta(p.criado_em)}</TableCell>
                <TableCell className="min-w-28 whitespace-normal">{p.cliente || <span className="text-muted-foreground">—</span>}{p.obs && <div className="text-xs text-muted-foreground">{p.obs}</div>}</TableCell>
                <TableCell className="min-w-36 whitespace-normal">{p.pedido_itens.map((i) => <div key={i.id}>{i.qtd}× {i.nome}</div>)}</TableCell>
                <TableCell className="text-muted-foreground">{p.plataforma}</TableCell>
                <TableCell><StatusBadge pedido={p} />{p.rastreio && <div className="mt-1 text-xs text-muted-foreground">{p.rastreio}</div>}</TableCell>
                <TableCell className="text-right font-semibold">{brl(p.pedido_financeiro?.total)}</TableCell>
                <TableCell className="text-right font-semibold text-success">{brl(p.pedido_financeiro?.lucro)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setEdit(p)}>Status</Button>
                    <Button variant="destructive" size="sm" onClick={() => setDel(p)}>Excluir</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          <Pager {...pag} className="border-t px-4 py-3" />
        </TableCard>
      )}
      {novo && <NovoPedido onClose={() => setNovo(false)} onDone={() => { void refresh(); toast.success('Pedido criado') }} />}
      {edit && <StatusModal pedido={edit} onClose={() => setEdit(null)} onDone={() => void refresh()} />}
      {del && (
        <ConfirmDialog title={`Excluir pedido #${del.num}?`} confirmLabel="Excluir" destructive onClose={() => setDel(null)}
          onConfirm={async () => { await exec(supabase.from('pedidos').delete().eq('id', del.id)); await refresh() }}>
          Isso apaga o pedido do histórico e dos totais. Para manter o registro, use “Status → Cancelado”.
        </ConfirmDialog>
      )}
    </>
  )
}

const statusSchema = z.object({ status: z.enum(['novo', 'producao', 'pronto', 'enviado', 'cancelado']), rastreio: texto })

function StatusModal({ pedido, onClose, onDone }: { pedido: Pedido; onClose: () => void; onDone: () => void }) {
  const form = useForm({ resolver: zodResolver(statusSchema), defaultValues: { status: pedido.status, rastreio: pedido.rastreio } })
  const temCores = useTemCores()
  const novoStatus = useWatch({ control: form.control, name: 'status' })
  // por aqui o pedido sai da fila sem passar pela baixa de filamento
  const pulaBaixa = temCores && ['novo', 'producao'].includes(pedido.status) && ['pronto', 'enviado'].includes(novoStatus)
  return (
    <FormDialog form={form} title={`Pedido #${pedido.num}`} onClose={onClose}
      onSubmit={async ({ status, rastreio }) => {
        const patch: Record<string, unknown> = { status, rastreio }
        if (status === 'pronto' && !pedido.pronto_em) patch.pronto_em = new Date().toISOString()
        if (status === 'enviado' && !pedido.enviado_em) patch.enviado_em = new Date().toISOString()
        await exec(supabase.from('pedidos').update(patch).eq('id', pedido.id)); onDone()
      }}>
      <SelectField control={form.control} name="status" label="Status"
        options={(Object.keys(PEDIDO_STATUS) as PedidoStatus[]).map((s) => ({ value: s, label: PEDIDO_STATUS[s].label }))} />
      <TextField control={form.control} name="rastreio" label="Código de rastreio" />
      {pulaBaixa && (
        <p className="text-xs font-semibold text-warning">Alterar o status por aqui não baixa o estoque de filamento. Para baixar, use “Concluir” na Fila de produção.</p>
      )}
    </FormDialog>
  )
}

const pedidoSchema = z.object({
  cliente: texto,
  plataforma: obrigatorio('Escolha o canal'),
  obs: texto,
  itens: z.array(z.object({
    produto_id: obrigatorio('Escolha o produto'),
    qtd: numero({ min: 1, inteiro: true }),
    preco: numero({ maiorQue: 0 }),
  })).min(1, 'Adicione ao menos um item.'),
})

function NovoPedido({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const produtos = useProdutos()
  const plats = usePlataformas()
  const config = useConfig()
  const PL = plats.data ?? []
  const prods = (produtos.data ?? []).filter((p) => p.ativo)
  const cfg = config.data

  const form = useForm({ resolver: zodResolver(pedidoSchema), defaultValues: { cliente: '', plataforma: '', obs: '', itens: [] } })
  const itens = useFieldArray({ control: form.control, name: 'itens' })
  const platId = useWatch({ control: form.control, name: 'plataforma' })
  const linhas = useWatch({ control: form.control, name: 'itens' }) ?? []
  const pl = PL.find((x) => x.id === platId)

  const precoDe = (produtoId: string, plId: string) => {
    const p = prods.find((x) => x.id === produtoId); const plt = PL.find((x) => x.id === plId)
    if (!p || !plt || !cfg) return ''
    const v = precoAdotado(p, plt, cfg)
    return v == null ? '' : String(v).replace('.', ',')
  }
  const novaLinha = (plId: string) => ({ produto_id: prods[0].id, qtd: '1', preco: precoDe(prods[0].id, plId) })

  // quando os dados chegam, escolhe o canal padrão (o último) e cria o primeiro item
  const iniciado = useRef(false)
  const pronto = prods.length > 0 && PL.length > 0 && !!cfg
  useEffect(() => {
    if (!pronto || iniciado.current) return
    iniciado.current = true
    const padrao = PL[PL.length - 1].id
    form.setValue('plataforma', padrao)
    itens.replace([novaLinha(padrao)])
  }, [pronto]) // eslint-disable-line react-hooks/exhaustive-deps

  const recalcula = (i: number, produtoId: string) => form.setValue(`itens.${i}.preco`, precoDe(produtoId, form.getValues('plataforma')), { shouldValidate: form.formState.isSubmitted })
  const mudaPlat = (id: string) => form.getValues('itens').forEach((l, i) => form.setValue(`itens.${i}.preco`, precoDe(l.produto_id, id), { shouldValidate: form.formState.isSubmitted }))

  let total = 0, lucro = 0
  linhas.forEach((l) => {
    const p = prods.find((x) => x.id === l.produto_id)
    const q = parseNum(l.qtd), pr = parseNum(l.preco)
    total += q * pr
    if (p && pl && cfg) lucro += q * lucroUnitario(pr, custo(p, cfg), pl)
  })
  const erroItens = form.formState.errors.itens

  return (
    <FormDialog form={form} title="Novo pedido" saveLabel="Criar pedido" wide onClose={onClose}
      onSubmit={async (v) => {
        const canal = PL.find((x) => x.id === v.plataforma)
        if (!canal || !cfg) throw new Error('Dados ainda carregando.')
        const linhasPedido = v.itens.map(({ produto_id, qtd, preco }) => {
          const p = prods.find((x) => x.id === produto_id)
          if (!p) throw new Error('Um produto do pedido não está mais disponível.')
          return { produto_id: p.id, nome: p.nome, qtd, preco, lucro: lucroUnitario(preco, custo(p, cfg), canal), gramas: (p.gramas + p.purga) * (1 + p.falhas), tempo_min: p.tempo_min / p.pecas_mesa }
        })
        await exec(supabase.rpc('criar_pedido', { p_cliente: v.cliente, p_plataforma: canal.nome, p_obs: v.obs, p_itens: linhasPedido }))
        onDone()
      }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="cliente" label="Cliente" autoFocus />
        <SelectField control={form.control} name="plataforma" label="Canal" placeholder="Carregando…" onValueChange={mudaPlat}
          options={PL.map((p) => ({ value: p.id, label: p.nome }))} />
      </div>
      <FieldSet className="gap-3">
        <FieldLegend variant="label">Itens (o preço vem do cálculo e pode ser ajustado)</FieldLegend>
        {itens.fields.map((item, i) => (
          <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_auto]">
            <ComboboxField control={form.control} name={`itens.${i}.produto_id`} label="Produto" hideLabel={i > 0} className="col-span-3 sm:col-span-1"
              searchPlaceholder="Pesquisar produto…" emptyText="Nenhum produto encontrado."
              onValueChange={(id) => recalcula(i, id)} options={prods.map((p) => ({ value: p.id, label: p.nome }))} />
            <NumberField control={form.control} name={`itens.${i}.qtd`} label="Qtd." hideLabel={i > 0} inputMode="numeric" />
            <NumberField control={form.control} name={`itens.${i}.preco`} label="Preço un." hideLabel={i > 0} />
            <Button type="button" variant="destructive" size="icon" className={i === 0 ? 'mt-[1.625rem]' : ''} onClick={() => itens.remove(i)} aria-label="Remover item"><X /></Button>
          </div>
        ))}
        <FieldError errors={[{ message: erroItens?.root?.message ?? erroItens?.message }]} />
        <Button type="button" variant="outline" size="sm" className="self-start" disabled={!pronto} onClick={() => itens.append(novaLinha(form.getValues('plataforma')))}><Plus />Adicionar item</Button>
      </FieldSet>
      <TextField control={form.control} name="obs" label="Observações (nome do pet, personalização, prazo…)" />
      <Separator />
      <div>
        <div className="flex items-center justify-between"><span className="text-muted-foreground">Total</span><b className="font-heading text-2xl">{brl(total)}</b></div>
        <div className="flex items-center justify-between text-xs font-semibold text-success"><span>Lucro estimado</span><span>{brl(lucro)} · {pct(total ? lucro / total : 0)}</span></div>
      </div>
    </FormDialog>
  )
}
