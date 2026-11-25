import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { TextField } from '@/components/form-fields'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldError, FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Wordmark } from '@/components/Wordmark'
import { useTheme } from '@/hooks/use-theme'
import { configured, supabase } from '@/lib/supabase'
import { email } from '@/lib/zod'

const schema = z.object({ email, senha: z.string().min(1, 'Informe a senha') })

export function Login() {
  useTheme()
  const [info, setInfo] = useState('')
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', senha: '' } })
  const { isSubmitting, errors } = form.formState

  const entrar = form.handleSubmit(async ({ email, senha }) => {
    setInfo('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) form.setError('root', { message: error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message })
  })

  async function esqueci() {
    setInfo(''); form.clearErrors()
    if (!(await form.trigger('email', { shouldFocus: true }))) return
    const { error } = await supabase.auth.resetPasswordForEmail(form.getValues('email').trim(), { redirectTo: window.location.origin + '/redefinir' })
    if (error) form.setError('root', { message: error.message }); else setInfo('Enviamos um link para redefinir a senha no seu e-mail.')
  }

  return (
    <div className="flex min-h-screen flex-wrap">
      <div className="relative flex min-h-80 flex-[1_1_440px] flex-col justify-between overflow-hidden bg-sidebar p-14">
        <div className="absolute -right-30 -bottom-15 -rotate-8 opacity-10">
          <Wordmark size={520} c1="#F26B21" c2="#FFFFFF" sub={false} />
        </div>
        <Wordmark size={64} />
        <div className="relative max-w-105">
          <h2 className="text-[34px] leading-tight font-bold text-white">Do pedido ao envio, tudo no mesmo lugar.</h2>
          <p className="mt-3.5 text-base text-[#C3CCE0]">
            Preços calculados, fila de produção, estoque de filamento e compras aprovadas por quem decide.
          </p>
        </div>
        <div className="text-[13px] text-[#8D99B8]">J&amp;V Personalizados · sistema interno</div>
      </div>
      <div className="flex flex-[1_1_440px] items-center justify-center p-10">
        <form onSubmit={entrar} noValidate className="w-full max-w-95">
          <h1 className="text-3xl font-bold">Entrar</h1>
          <p className="mt-1 mb-5 text-muted-foreground">Use o e-mail e a senha que a gestão cadastrou para você.</p>
          <FieldGroup>
            {!configured && (
              <Alert variant="destructive"><AlertDescription>Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).</AlertDescription></Alert>
            )}
            <TextField control={form.control} name="email" label="E-mail" type="email" autoComplete="email" placeholder="voce@jevpersonalizados.com.br" />
            <TextField control={form.control} name="senha" label="Senha" type="password" autoComplete="current-password" placeholder="••••••••" />
            <Button type="button" variant="link" size="sm" className="-mt-3 self-end px-0" onClick={() => void esqueci()}>Esqueci a senha</Button>
            <FieldError errors={[errors.root]} />
            {info && <p role="status" className="text-success">{info}</p>}
            <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting && <Spinner />}{isSubmitting ? 'Entrando…' : 'Entrar'}</Button>
            <p className="text-xs text-muted-foreground">
              Sem acesso? Peça para a gestão liberar. Cada pessoa entra direto na sua área: <b className="text-foreground">Comercial</b> ou <b className="text-foreground">Operacional</b>.
            </p>
          </FieldGroup>
        </form>
      </div>
    </div>
  )
}
