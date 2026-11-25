import { useId, useState, type Ref } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ComboboxOption { value: string; label: string }

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Todas as palavras digitadas precisam aparecer no nome, em qualquer ordem e sem diferenciar acentos. */
function filtrar(_value: string, busca: string, keywords?: string[]) {
  const alvo = semAcento((keywords ?? []).join(' '))
  return semAcento(busca).split(/\s+/).every((palavra) => alvo.includes(palavra)) ? 1 : 0
}

interface Props {
  value: string
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  id?: string
  invalid?: boolean
  ref?: Ref<HTMLButtonElement>
  onBlur?: () => void
}

/** Select com busca (Popover + Command do shadcn). */
export function Combobox({
  value, onValueChange, options, placeholder = 'Selecione', searchPlaceholder = 'Pesquisar…', emptyText = 'Nada encontrado.', id, invalid, ref, onBlur,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const listaId = useId()
  const atual = options.find((o) => o.value === value)

  return (
    // modal: permite rolar a lista quando o combobox está dentro de um diálogo
    <Popover open={aberto} onOpenChange={setAberto} modal>
      <PopoverTrigger asChild>
        <Button ref={ref} id={id} type="button" variant="outline" role="combobox" aria-expanded={aberto} aria-controls={listaId} aria-invalid={invalid} onBlur={onBlur}
          className="w-full min-w-0 justify-between bg-muted px-3 font-normal dark:bg-muted">
          <span className={cn('truncate', !atual && 'text-muted-foreground')}>{atual?.label ?? placeholder}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent id={listaId} align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        <Command filter={filtrar} defaultValue={value}>
          <CommandInput placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.value} keywords={[o.label]} data-checked={o.value === value}
                  onSelect={() => { onValueChange(o.value); setAberto(false) }}>
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function ComboboxField<T extends FieldValues, TOut>({
  control, name, label, hideLabel, className, onValueChange, ...props
}: Omit<Props, 'value' | 'onValueChange' | 'id' | 'invalid' | 'ref' | 'onBlur'> & {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
  hideLabel?: boolean
  className?: string
  onValueChange?: (value: string) => void
}) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={cn('min-w-0', className)}>
          <FieldLabel htmlFor={id} className={cn(hideLabel && 'sr-only')}>{label}</FieldLabel>
          <Combobox
            {...props}
            ref={field.ref}
            id={id}
            value={(field.value as string | undefined) ?? ''}
            onValueChange={(v) => { field.onChange(v); onValueChange?.(v) }}
            onBlur={field.onBlur}
            invalid={fieldState.invalid}
          />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
