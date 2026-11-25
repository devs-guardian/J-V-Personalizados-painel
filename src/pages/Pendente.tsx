import { useAuth } from '../lib/auth'
import { Wordmark } from '../components/Wordmark'

export function Pendente() {
  const { profile, signOut, refreshProfile } = useAuth()
  return (
    <div className="login">
      <div className="form" style={{ flex: '1 1 100%' }}>
        <div style={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <Wordmark size={48} c1="var(--tx)" c2="#F26B21" subColor="var(--mu)" />
          <h1 style={{ fontSize: 26 }}>Aguardando liberação</h1>
          <p className="mu">Sua conta ({profile?.email}) existe, mas a gestão ainda não definiu o seu acesso. Avise o responsável e toque em “Verificar de novo”.</p>
          <div className="row">
            <button className="btn pri" onClick={() => void refreshProfile()}>Verificar de novo</button>
            <button className="btn" onClick={() => void signOut()}>Sair</button>
          </div>
        </div>
      </div>
    </div>
  )
}
