import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Store } from 'lucide-react'
import { Pager } from '@/components/pager'
import { FormDialog } from '@/components/form-dialog'
import { NumberField } from '@/components/form-fields'
import { EmptyState, KpiCard, Loading, PageHeader, TableCard } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePagination } from '@/hooks/use-pagination'
import { brl, paraCampo, pct } from '@/lib/format'
import { exec, useCapacidade, useConfig, usePlataformas } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import type { Capacidade, Config, Plataforma } from '@/lib/types'
import { numero } from '@/lib/zod'

export function Custos() {
  const config = useConfig()
  const cap = useCapacidade()
  const plats = usePlataformas()
  const [geral, setGeral] = useState(false)
  const [edit, setEdit] = useState<Plataforma | null>(null)
  const qc = useQueryClient()
  const c = config.data
  const pag = usePagination(plats.data ?? [])
  return (
    <>
      <PageHeader title="Custos e taxas" sub="Taxas das plataformas mudam com frequência: confirme na Central do Vendedor">
        <Button disabled={!c || !cap.data} onClick={() => setGeral(true)}>Editar custos gerais</Button>
      </PageHeader>
      {!c || !cap.data ? <div className="mb-4"><Loading /></div> : (
        <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <KpiCard label="Filamento (R$/kg)" value={brl(c.filamento_kg)} />
          <KpiCard label="Hora de máquina (R$/h)" value={brl(c.maquina_h)} />
          <KpiCard label="Seu tempo (R$/h)" value={brl(c.hora_sua)} />
          <KpiCard label="Impressoras × horas/dia" value={`${cap.data.impressoras} × ${cap.data.horas_dia}h`} />
        </div>
      )}
      {plats.isLoading ? <Loading /> : pag.total === 0 ? (
        <EmptyState icon={Store} title="Nenhuma plataforma cadastrada">
          Cadastre os canais de venda no Supabase (veja supabase/002_seed.sql).
        </EmptyState>
      ) : (
        <TableCard>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Plataforma</TableHead>
              {['Margem', 'Limite da faixa', 'Comissão (baixa / alta)', 'Taxa fixa (baixa / alta)', 'Imposto', 'Pagamento', 'Anúncio'].map((t) => <TableHead key={t} className="text-right">{t}</TableHead>)}
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{pag.itens.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold">{p.nome}</TableCell>
                <TableCell className="text-right">{pct(p.margem)}</TableCell>
                <TableCell className="text-right">{brl(p.lim)}</TableCell>
                <TableCell className="text-right">{pct(p.c_low)} / {pct(p.c_high)}</TableCell>
                <TableCell className="text-right">{brl(p.f_low)} / {brl(p.f_high)}</TableCell>
                <TableCell className="text-right">{pct(p.imposto)}</TableCell>
                <TableCell className="text-right">{pct(p.pag)}</TableCell>
                <TableCell className="text-right">{brl(p.anuncio)}</TableCell>
                <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setEdit(p)}>Editar</Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          <Pager {...pag} className="border-t px-4 py-3" />
        </TableCard>
      )}
      <p className="mt-3 text-xs text-muted-foreground">O imposto de 6% é exemplo; use o seu (MEI paga valor fixo no mês, então 0%). Ao salvar, os preços sugeridos de todos os produtos são recalculados; pedidos já feitos mantêm o preço da época.</p>

      {geral && c && cap.data && <GeralModal c={c} cap={cap.data} onClose={() => setGeral(false)} onDone={() => { void qc.invalidateQueries({ queryKey: ['config'] }); void qc.invalidateQueries({ queryKey: ['capacidade'] }) }} />}
      {edit && <PlatModal p={edit} onClose={() => setEdit(null)} onDone={() => qc.invalidateQueries({ queryKey: ['plataformas'] })} />}
    </>
  )
}

const valor = numero({ min: 0 })
const percentual = numero({ min: 0, max: 100 })

const geralSchema = z.object({
  filamento_kg: valor, maquina_h: valor, hora_sua: valor,
  impressoras: numero({ min: 1, max: 20, inteiro: true }),
  horas_dia: numero({ min: 1, max: 24 }),
})

function GeralModal({ c, cap, onClose, onDone }: { c: Config; cap: Capacidade; onClose: () => void; onDone: () => void }) {
  const form = useForm({
    resolver: zodResolver(geralSchema),
    defaultValues: { filamento_kg: paraCampo(c.filamento_kg), maquina_h: paraCampo(c.maquina_h), hora_sua: paraCampo(c.hora_sua), impressoras: paraCampo(cap.impressoras), horas_dia: paraCampo(cap.horas_dia) },
  })
  const F = (name: keyof z.input<typeof geralSchema>, label: string) => <NumberField control={form.control} name={name} label={label} />
  return (
    <FormDialog form={form} title="Custos gerais" wide onClose={onClose} onSubmit={async ({ impressoras, horas_dia, ...custos }) => {
      await exec(supabase.from('config').update(custos).eq('id', 1))
      await exec(supabase.from('capacidade').update({ impressoras, horas_dia }).eq('id', 1))
      onDone()
    }}>
      <div className="grid items-start gap-4 sm:grid-cols-3">{F('filamento_kg', 'Filamento (R$/kg)')}{F('maquina_h', 'Hora de máquina (R$/h)')}{F('hora_sua', 'Seu tempo (R$/h)')}</div>
      <div className="grid items-start gap-4 sm:grid-cols-2">{F('impressoras', 'Impressoras')}{F('horas_dia', 'Horas úteis por impressora/dia')}</div>
    </FormDialog>
  )
}

const platSchema = z.object({
  margem: percentual, lim: valor, imposto: percentual,
  c_low: percentual, f_low: valor, outras: percentual,
  c_high: percentual, f_high: valor, pag: percentual,
  anuncio: valor, frete: valor,
})

function PlatModal({ p, onClose, onDone }: { p: Plataforma; onClose: () => void; onDone: () => void }) {
  const P = (x: number) => paraCampo(Math.round(x * 1000) / 10)
  const form = useForm({
    resolver: zodResolver(platSchema),
    defaultValues: { margem: P(p.margem), lim: paraCampo(p.lim), imposto: P(p.imposto), c_low: P(p.c_low), f_low: paraCampo(p.f_low), outras: P(p.outras), c_high: P(p.c_high), f_high: paraCampo(p.f_high), pag: P(p.pag), anuncio: paraCampo(p.anuncio), frete: paraCampo(p.frete) },
  })
  const F = (name: keyof z.input<typeof platSchema>, label: string) => <NumberField control={form.control} name={name} label={label} />
  return (
    <FormDialog form={form} title={p.nome} wide onClose={onClose} onSubmit={async (v) => {
      await exec(supabase.from('plataformas').update({
        ...v, margem: v.margem / 100, imposto: v.imposto / 100, c_low: v.c_low / 100, outras: v.outras / 100, c_high: v.c_high / 100, pag: v.pag / 100,
      }).eq('id', p.id))
      onDone()
    }}>
      <div className="grid items-start gap-4 sm:grid-cols-3">
        {F('margem', 'Margem desejada (%)')}{F('lim', 'Limite da faixa (R$)')}{F('imposto', 'Imposto (%)')}
        {F('c_low', 'Comissão abaixo do limite (%)')}{F('f_low', 'Taxa fixa abaixo (R$)')}{F('outras', 'Outras taxas (%)')}
        {F('c_high', 'Comissão a partir do limite (%)')}{F('f_high', 'Taxa fixa a partir (R$)')}{F('pag', 'Taxa de pagamento (%)')}
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">{F('anuncio', 'Anúncio por venda (R$)')}{F('frete', 'Frete pago por você (R$)')}</div>
    </FormDialog>
  )
}
