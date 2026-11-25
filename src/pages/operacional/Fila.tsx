import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch, type Control } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ListChecks } from 'lucide-react'
import { Pager } from '@/components/pager'
import { CoresField, linhasCores, type LinhaCor } from '@/components/cores-field'
import { FormDialog } from '@/components/form-dialog'
import { NumberField, SelectField } from '@/components/form-fields'
import { EmptyState, Loading, PageHeader, StatusBadge } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAgora } from '@/hooks/use-agora'
import { usePagination } from '@/hooks/use-pagination'
import { gramasDoPedido, horasDoPedido } from '@/lib/capacity'
import { dataCurta, horas, num, paraCampo, quando } from '@/lib/format'
import { prazoDoPedido } from '@/lib/prazo'
import { consumoDoPedido, produtosSemCores } from '@/lib/consumo'
import { exec, useFilamentos, usePedidos, useTemCores } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Pedido } from '@/lib/types'
import { cn } from '@/lib/utils'
import { numero } from '@/lib/zod'

export function Fila() {
  const pedidos = usePedidos()
  const qc = useQueryClient()
  const [fim, setFim] = useState<Pedido | null>(null)
  const fila = (pedidos.data ?? []).filter((p) => p.status === 'novo' || p.status === 'producao').sort((a, b) => a.criado_em.localeCompare(b.criado_em))
  const pag = usePagination(fila)
  const agora = useAgora()
  const temCores = useTemCores()
  const refresh = () => qc.invalidateQueries({ queryKey: ['pedidos'] })
  async function iniciar(p: Pedido) {
    try { await exec(supabase.from('pedidos').update({ status: 'producao' }).eq('id', p.id)); await refresh() } catch (e) { toast.error((e as Error).message) }
  }
  const Janela = temCores ? ConcluirPorCor : Concluir
  const totalH = fila.reduce((s, p) => s + horasDoPedido(p), 0)
  return (
    <>
      <PageHeader title="Fila de produção" sub={`${fila.length} pedido(s) · ${horas(totalH)} de impressão na fila (mais antigos primeiro)`} />
      {pedidos.isLoading ? <Loading /> : fila.length === 0 ? (
        <EmptyState icon={ListChecks} title="Fila vazia">Bom trabalho! Novos pedidos aparecem aqui automaticamente.</EmptyState>
      ) : (
        <div className="grid gap-4">
          {pag.itens.map((p) => (
            <Card key={p.id}>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2.5">
                  <b className="text-lg">#{p.num}</b><StatusBadge pedido={p} /><span className="text-muted-foreground">{p.plataforma} · {dataCurta(p.criado_em)}</span>
                  <span className="ml-auto text-muted-foreground">{horas(horasDoPedido(p))} · {num(gramasDoPedido(p))} g</span>
                </div>
                <Prazo pedido={p} agora={agora} />
                <div className="my-2">{p.pedido_itens.map((i) => <div key={i.id}><b>{i.qtd}×</b> {i.nome}</div>)}</div>
                {p.obs && <div className="mb-2 text-muted-foreground">Obs.: {p.obs}</div>}
                <div className="flex gap-2">
                  {p.status === 'novo' && <Button variant="outline" onClick={() => void iniciar(p)}>Iniciar produção</Button>}
                  <Button disabled={temCores === undefined} onClick={() => setFim(p)}>Concluir</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Pager {...pag} />
        </div>
      )}
      {fim && <Janela pedido={fim} onClose={() => setFim(null)} onJaConcluido={() => void refresh()} onDone={() => { void refresh(); void qc.invalidateQueries({ queryKey: ['filamentos'] }); toast.success('Pedido pronto para envio') }} />}
    </>
  )
}

/** Contagem do prazo de um pedido em produção. */
function Prazo({ pedido, agora }: { pedido: Pedido; agora: number }) {
  const prazo = prazoDoPedido(pedido)
  if (!prazo) return null
  const restante = (prazo.getTime() - agora) / 3_600_000
  return (
    <div className={cn('mt-1.5 text-xs font-semibold', restante < 0 ? 'text-destructive' : 'text-muted-foreground')}>
      Iniciado {quando(new Date(pedido.iniciado_em!))} · prazo {quando(prazo)} · {restante < 0 ? `atrasado há ${horas(-restante)}` : `faltam ${horas(restante)}`}
    </div>
  )
}

const gramasValidas = numero({ min: 0 })

// as gramas só são exigidas quando um filamento é escolhido
const schema = z.object({ filamento: z.string(), gramas: z.string() }).transform(({ filamento, gramas }, ctx) => {
  if (!filamento) return { filamento: null, gramas: 0 }
  const r = gramasValidas.safeParse(gramas)
  if (r.success) return { filamento, gramas: r.data }
  ctx.addIssue({ code: 'custom', path: ['gramas'], message: r.error.issues[0].message })
  return z.NEVER
})

function Concluir({ pedido, onClose, onDone }: { pedido: Pedido; onClose: () => void; onDone: () => void }) {
  const fils = useFilamentos()
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { filamento: '', gramas: String(Math.round(gramasDoPedido(pedido))) } })
  const filamento = useWatch({ control: form.control, name: 'filamento' })
  return (
    <FormDialog form={form} title={`Concluir pedido #${pedido.num}`} description="Informe o filamento usado para baixar o estoque (opcional)."
      saveLabel="Marcar como pronto" onClose={onClose}
      onSubmit={async (v) => { await exec(supabase.rpc('concluir_pedido', { p_id: pedido.id, p_fil: v.filamento, p_gramas: v.gramas })); onDone() }}>
      <SelectField control={form.control} name="filamento" label="Filamento"
        options={[{ value: '', label: 'Não baixar estoque' }, ...(fils.data ?? []).map((f) => ({ value: f.id, label: `${f.cor} · ${f.material} (${num(f.estoque_g)} g)` }))]} />
      {filamento && <NumberField control={form.control} name="gramas" label="Gramas usadas" />}
    </FormDialog>
  )
}

interface PropsConclusao { pedido: Pedido; onClose: () => void; onDone: () => void; onJaConcluido: () => void }

const consumoSchema = z.object({ cores: linhasCores({ min: 0 }) })

/** Conclusão com baixa de todas as cores (supabase/005). */
function ConcluirPorCor({ pedido, onClose, onDone, onJaConcluido }: PropsConclusao) {
  const fils = useFilamentos()
  const form = useForm({
    resolver: zodResolver(consumoSchema),
    defaultValues: { cores: Object.entries(consumoDoPedido(pedido)).map(([fil_id, g]) => ({ fil_id, gramas: paraCampo(Math.round(g * 10) / 10) })) },
  })
  return (
    <FormDialog form={form} title={`Concluir pedido #${pedido.num}`} description="Confira o filamento usado. O estoque de cada cor é baixado ao confirmar."
      saveLabel="Marcar como pronto" onClose={onClose}
      onSubmit={async ({ cores }) => {
        const { data, error } = await supabase.rpc('concluir_pedido_cores', { p_id: pedido.id, p_consumo: cores })
        if (error) throw new Error(error.message)
        if (data === false) { toast.warning(`O pedido #${pedido.num} já estava concluído. O estoque não mudou.`); onJaConcluido() }
        else onDone()
      }}>
      {produtosSemCores([pedido]).length > 0 && (
        <p className="text-xs text-warning">Há itens sem cores cadastradas; acrescente o filamento usado, se quiser baixar o estoque.</p>
      )}
      <CoresField control={form.control as unknown as Control<{ cores: LinhaCor[] }>} filamentos={fils.data}
        mostrarEstoque titulo="Filamento usado" ajuda="Sem nenhuma linha, o estoque não muda." />
    </FormDialog>
  )
}

