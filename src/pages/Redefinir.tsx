import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { TextField } from '@/components/form-fields'
import { Button } from '@/components/ui/button'
import { FieldError, FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Wordmark } from '@/components/Wordmark'
import { supabase } from '@/lib/supabase'

const schema = z.object({ senha: z.string().min(8, 'Use ao menos 8 caracteres.') })

export function Redefinir() {
  const [ok, setOk] = useState(false)
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { senha: '' } })
  const { isSubmitting, errors } = form.formState

  const salvar = form.handleSubmit(async ({ senha }) => {
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) form.setError('root', { message: error.message }); else setOk(true)
  })

  return (
    <div className="flex min-h-screen items-center justify-center p-10">
      <form onSubmit={salvar} noValidate className="w-full max-w-95">
        <FieldGroup>
          <Wordmark c1="var(--foreground)" subColor="var(--muted-foreground)" />
          <h2 className="text-2xl font-bold">Nova senha</h2>
          {ok ? (
            <>
              <p role="status">Senha atualizada.</p>
              <Button asChild><a href="/">Entrar</a></Button>
            </>
          ) : (
            <>
              <TextField control={form.control} name="senha" label="Nova senha" type="password" autoFocus autoComplete="new-password" />
              <FieldError errors={[errors.root]} />
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Spinner />}Salvar senha</Button>
            </>
          )}
        </FieldGroup>
      </form>
    </div>
  )
}
