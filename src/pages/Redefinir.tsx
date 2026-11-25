import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Wordmark } from '../components/Wordmark'

export function Redefinir() {
  const [s1, setS1] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setErro('')
    if (s1.length < 8) return setErro('Use ao menos 8 caracteres.')
    const { error } = await supabase.auth.updateUser({ password: s1 })
    if (error) setErro(error.message); else setOk(true)
  }
  return (
    <div className="login"><div className="form"><form onSubmit={submit}>
      <Wordmark />
      <h2 style={{ margin: '16px 0 8px' }}>Nova senha</h2>
      {ok ? <><p>Senha atualizada.</p><a className="btn pri" href="/">Entrar</a></> : <>
        <label className="f">Nova senha<input className="i" type="password" value={s1} onChange={(e) => setS1(e.target.value)} autoFocus autoComplete="new-password" /></label>
        {erro && <div className="err">{erro}</div>}
        <button className="btn pri" style={{ marginTop: 12 }}>Salvar senha</button></>}
    </form></div></div>
  )
}
