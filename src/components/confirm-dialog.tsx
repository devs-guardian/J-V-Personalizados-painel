import { useState, type ReactNode } from 'react'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

/** Confirmação sem campos. Se `onConfirm` lançar um Error, a janela continua aberta. */
export function ConfirmDialog({
  title, children, confirmLabel, destructive = false, onClose, onConfirm,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  destructive?: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function confirm() {
    setBusy(true); setError('')
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Não foi possível concluir.')
      setBusy(false)
    }
  }
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{children}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <FieldError>{error}</FieldError>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant={destructive ? 'destructive' : 'default'} disabled={busy} onClick={() => void confirm()}>
            {busy && <Spinner />}{confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
