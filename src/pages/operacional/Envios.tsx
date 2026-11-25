import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { PackageCheck, Truck } from 'lucide-react'
import { Pager } from '@/components/pager'
import { FormDialog } from '@/components/form-dialog'
import { TextField } from '@/components/form-fields'
import { EmptyState, Loading, PageHeader, TableCard } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePagination } from '@/hooks/use-pagination'
import { dataCurta } from '@/lib/format'
import { exec, usePedidos } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Pedido } from '@/lib/types'
import { texto } from '@/lib/zod'

export function Envios() {
  const pedidos = usePedidos()
  const [sel, setSel] = useState<Pedido | null>(null)
  const prontos = (pedidos.data ?? []).filter((p) => p.status === 'pronto')
  const enviados = (pedidos.data ?? [])
    .filter((p) => p.status === 'enviado')
    .sort((a, b) => (b.enviado_em ?? b.criado_em).localeCompare(a.enviado_em ?? a.criado_em))
  const pagProntos = usePagination(prontos)
  const pagEnviados = usePagination(enviados)
  return (
    <>
      <PageHeader title="Envios" sub={`${prontos.length} pedido(s) prontos para despachar`} />
      {pedidos.isLoading ? <div className="mb-5"><Loading /></div> : prontos.length === 0 ? (
        <EmptyState icon={Truck} title="Nada para enviar agora" className="mb-5">Os pedidos aparecem aqui quando a produção é concluída.</EmptyState>
      ) : (
        <div className="mb-5 grid gap-4">
          {pagProntos.itens.map((p) => (
            <Card key={p.id}>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2.5">
                  <b className="text-lg">#{p.num}</b><span className="font-semibold">{p.cliente || 'Sem nome'}</span><span className="text-muted-foreground">{p.plataforma}</span>
                  <Button className="ml-auto" onClick={() => setSel(p)}>Marcar como enviado</Button>
                </div>
                <div className="mt-2">{p.pedido_itens.map((i) => <div key={i.id}>{i.qtd}× {i.nome}</div>)}</div>
                {p.obs && <div className="mt-1.5 text-muted-foreground">Obs.: {p.obs}</div>}
              </CardContent>
            </Card>
          ))}
          <Pager {...pagProntos} />
        </div>
      )}
      <h3 className="my-2 text-lg font-bold">Últimos enviados</h3>
      {pedidos.isLoading ? <Loading /> : enviados.length === 0 ? (
        <EmptyState icon={PackageCheck} title="Nenhum envio registrado">Os pedidos marcados como enviados ficam listados aqui.</EmptyState>
      ) : (
        <TableCard>
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Cliente</TableHead><TableHead>Canal</TableHead><TableHead>Enviado em</TableHead><TableHead>Rastreio</TableHead></TableRow></TableHeader>
            <TableBody>{pagEnviados.itens.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold">#{p.num}</TableCell><TableCell>{p.cliente}</TableCell><TableCell className="text-muted-foreground">{p.plataforma}</TableCell>
                <TableCell className="text-muted-foreground">{dataCurta(p.enviado_em ?? p.criado_em)}</TableCell><TableCell>{p.rastreio || '—'}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          <Pager {...pagEnviados} className="border-t px-4 py-3" />
        </TableCard>
      )}
      {sel && <EnvioModal pedido={sel} onClose={() => setSel(null)} />}
    </>
  )
}

const schema = z.object({ rastreio: texto })

function EnvioModal({ pedido, onClose }: { pedido: Pedido; onClose: () => void }) {
  const qc = useQueryClient()
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { rastreio: '' } })
  return (
    <FormDialog form={form} title={`Enviar pedido #${pedido.num}`} saveLabel="Confirmar envio" onClose={onClose}
      onSubmit={async ({ rastreio }) => {
        await exec(supabase.from('pedidos').update({ status: 'enviado', rastreio, enviado_em: new Date().toISOString() }).eq('id', pedido.id))
        await qc.invalidateQueries({ queryKey: ['pedidos'] }); toast.success('Envio registrado')
      }}>
      <TextField control={form.control} name="rastreio" label="Código de rastreio (opcional)" autoFocus />
    </FormDialog>
  )
}
