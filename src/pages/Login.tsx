import { useState, type FormEvent } from 'react'
import { supabase, configured } from '../lib/supabase'
import { Wordmark } from '../components/Wordmark'
import { useTheme } from '../components/Layout'

export function Login() {
  useTheme()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErro(''); setInfo('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    if (error) setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
    setBusy(false)
  }
  async function esqueci() {
    if (!email.trim()) { setErro('Digite seu e-mail primeiro.'); return }
    setErro('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/redefinir' })
    if (error) setErro(error.message); else setInfo('Enviamos um link para redefinir a senha no seu e-mail.')
  }

  return (
    <div className="login">
      <div className="brand">
        <div style={{ position: 'absolute', right: -120, bottom: -60, opacity: 0.12, transform: 'rotate(-8deg)' }}>
          <Wordmark size={520} c1="#F26B21" c2="#FFFFFF" sub={false} />
        </div>
        <Wordmark size={64} />
        <div style={{ position: 'relative', maxWidth: 420 }}>
          <h2 style={{ fontSize: 34, lineHeight: 1.15, color: '#fff' }}>Do pedido ao envio, tudo no mesmo lugar.</h2>
          <p style={{ color: '#C3CCE0', fontSize: 16, lineHeight: 1.5, marginTop: 14 }}>
            Preços calculados, fila de produção, estoque de filamento e compras aprovadas por quem decide.
          </p>
        </div>
        <div style={{ color: '#8D99B8', fontSize: 13 }}>J&amp;V Personalizados · sistema interno</div>
      </div>
      <div className="form">
        <form onSubmit={entrar}>
          <h1 style={{ fontSize: 30 }}>Entrar</h1>
          <p className="mu" style={{ margin: '4px 0 18px' }}>Use o e-mail e a senha que a gestão cadastrou para você.</p>
          {!configured && <div className="note dg">Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).</div>}
          <label className="f">E-mail
            <input className="i" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@jevpersonalizados.com.br" />
          </label>
          <label className="f">Senha
            <input className="i" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 14 }}>
            <a href="#" className="b sm" onClick={(e) => { e.preventDefault(); void esqueci() }}>Esqueci a senha</a>
          </div>
          {erro && <div className="err" role="alert" style={{ marginBottom: 10 }}>{erro}</div>}
          {info && <div className="ok" style={{ marginBottom: 10 }}>{info}</div>}
          <button className="btn pri block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <p className="mu sm" style={{ marginTop: 18, lineHeight: 1.5 }}>
            Sem acesso? Peça para a gestão liberar. Cada pessoa entra direto na sua área: <b style={{ color: 'var(--tx)' }}>Comercial</b> ou <b style={{ color: 'var(--tx)' }}>Operacional</b>.
          </p>
        </form>
      </div>
    </div>
  )
}
