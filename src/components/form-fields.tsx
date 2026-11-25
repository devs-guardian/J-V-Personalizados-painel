import { useId, type ComponentProps, type ReactNode, type Ref } from 'react'
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Base<T extends FieldValues, TOut> {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: ReactNode
  /** Esconde o rótulo visualmente (continua lido por leitores de tela). */
  hideLabel?: boolean
}

type InputProps = Omit<ComponentProps<typeof Input>, 'name' | 'value' | 'defaultValue' | 'id'>

export function TextField<T extends FieldValues, TOut>({
  control, name, label, hideLabel, description, className, onChange, ...props
}: Base<T, TOut> & InputProps & { description?: ReactNode }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id} className={cn(hideLabel && 'sr-only')}>{label}</FieldLabel>
          <Input
            {...props}
            {...field}
            id={id}
            value={(field.value as string | undefined) ?? ''}
            onChange={(e) => { field.onChange(e); onChange?.(e) }}
            aria-invalid={fieldState.invalid}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

/** Campo numérico que aceita vírgula ou ponto; a conversão é feita pelo schema. */
export function NumberField<T extends FieldValues, TOut>(props: Base<T, TOut> & InputProps & { description?: ReactNode }) {
  return <TextField inputMode="decimal" autoComplete="off" {...props} />
}

// o Select do Radix não aceita item com valor vazio
const VAZIO = '__vazio__'

export interface Option { value: string; label: ReactNode }

export function OptionSelect({
  value, onValueChange, options, id, invalid, disabled, placeholder, className, ref, onBlur, 'aria-label': ariaLabel,
}: {
  value: string
  onValueChange: (value: string) => void
  options: Option[]
  id?: string
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  ref?: Ref<HTMLButtonElement>
  onBlur?: () => void
  'aria-label'?: string
}) {
  const temVazio = options.some((o) => o.value === '')
  return (
    <Select
      value={value === '' && temVazio ? VAZIO : value}
      onValueChange={(v) => onValueChange(v === VAZIO ? '' : v)}
      disabled={disabled}
    >
      <SelectTrigger ref={ref} id={id} onBlur={onBlur} aria-invalid={invalid} aria-label={ariaLabel} className={cn('w-full bg-muted', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          {options.map((o) => <SelectItem key={o.value || VAZIO} value={o.value || VAZIO}>{o.label}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function SelectField<T extends FieldValues, TOut>({
  control, name, label, hideLabel, options, placeholder, className, onValueChange,
}: Base<T, TOut> & { options: Option[]; placeholder?: string; className?: string; onValueChange?: (value: string) => void }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id} className={cn(hideLabel && 'sr-only')}>{label}</FieldLabel>
          <OptionSelect
            ref={field.ref}
            id={id}
            value={(field.value as string | undefined) ?? ''}
            onValueChange={(v) => { field.onChange(v); onValueChange?.(v) }}
            onBlur={field.onBlur}
            options={options}
            placeholder={placeholder}
            invalid={fieldState.invalid}
          />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export function CheckboxField<T extends FieldValues, TOut>({ control, name, label }: Base<T, TOut>) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal">
          <Checkbox ref={field.ref} id={id} checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} onBlur={field.onBlur} />
          <FieldLabel htmlFor={id} className="font-normal">{label}</FieldLabel>
        </Field>
      )}
    />
  )
}
