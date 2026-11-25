import { Plus, X } from 'lucide-react'
import { useFieldArray, type Control } from 'react-hook-form'
import { z } from 'zod'
import { ComboboxField } from '@/components/combobox'
import { NumberField } from '@/components/form-fields'
import { Button } from '@/components/ui/button'
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field'
import { num } from '@/lib/format'
import type { Filamento } from '@/lib/types'
import { numero, obrigatorio } from '@/lib/zod'

export interface LinhaCor { fil_id: string; gramas: string }

/** Linhas "filamento + gramas", sem repetir filamento. */
export function linhasCores(gramas: { min?: number; maiorQue?: number }) {
  return z
    .array(z.object({ fil_id: obrigatorio('Escolha o filamento'), gramas: numero(gramas) }))
    .superRefine((linhas, ctx) => {
      linhas.forEach((l, i) => {
        if (linhas.findIndex((x) => x.fil_id === l.fil_id) < i) ctx.addIssue({ code: 'custom', path: [i, 'fil_id'], message: 'Filamento repetido' })
      })
    })
}

/** Lista editável de cores. O formulário precisa ter o campo `cores`. */
export function CoresField({
  control, filamentos, titulo, ajuda, mostrarEstoque = false,
}: {
  control: Control<{ cores: LinhaCor[] }>
  /** `undefined` enquanto carrega. */
  filamentos: Filamento[] | undefined
  titulo: string
  ajuda?: string
  mostrarEstoque?: boolean
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'cores' })
  const opcoes = (filamentos ?? []).map((f) => ({ value: f.id, label: `${f.cor} · ${f.material}${mostrarEstoque ? ` (${num(f.estoque_g)} g)` : ''}` }))
  const opcoesCom = (id: string) =>
    !filamentos || !id || opcoes.some((o) => o.value === id) ? opcoes : [...opcoes, { value: id, label: 'Filamento removido' }]

  return (
    <FieldSet className="gap-3">
      <FieldLegend variant="label">{titulo}</FieldLegend>
      {ajuda && <FieldDescription>{ajuda}</FieldDescription>}
      {fields.map((linha, i) => (
        <div key={linha.id} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-start gap-2">
          <ComboboxField control={control} name={`cores.${i}.fil_id`} label="Filamento" hideLabel={i > 0} options={opcoesCom(linha.fil_id)}
            placeholder={filamentos ? 'Escolha a cor' : 'Carregando…'} searchPlaceholder="Pesquisar filamento…" emptyText="Nenhum filamento encontrado." />
          <NumberField control={control} name={`cores.${i}.gramas`} label="Gramas" hideLabel={i > 0} />
          <Button type="button" variant="destructive" size="icon" className={i === 0 ? 'mt-[1.625rem]' : ''} onClick={() => remove(i)} aria-label="Remover cor"><X /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => append({ fil_id: '', gramas: '' })}><Plus />Adicionar cor</Button>
    </FieldSet>
  )
}
