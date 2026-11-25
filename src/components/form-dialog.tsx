import type { ReactNode } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldError, FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

/** Janela com formulário. Se `onSubmit` lançar um Error, a mensagem aparece e a janela continua aberta. */
export function FormDialog<TIn extends FieldValues, TOut>({
  form, title, description, children, onClose, onSubmit, saveLabel = 'Salvar', wide = false,
}: {
  form: UseFormReturn<TIn, unknown, TOut>
  title: string
  description?: ReactNode
  children: ReactNode
  onClose: () => void
  onSubmit: (values: TOut) => Promise<void>
  saveLabel?: string
  wide?: boolean
}) {
  const { isSubmitting, errors } = form.formState
  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values)
      onClose()
    } catch (e) {
      form.setError('root', { message: (e as Error).message || 'Não foi possível salvar.' })
    }
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')} {...(description ? {} : { 'aria-describedby': undefined })}>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FieldGroup>{children}</FieldGroup>
          <FieldError errors={[errors.root]} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}{isSubmitting ? 'Salvando…' : saveLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
