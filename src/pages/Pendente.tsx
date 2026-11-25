import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/Wordmark'
import { useAuth } from '@/lib/auth'

export function Pendente() {
  const { profile, signOut, refreshProfile } = useAuth()
  return (
    <div className="flex min-h-screen items-center justify-center p-10">
      <div className="flex max-w-105 flex-col items-center gap-4 text-center">
        <Wordmark size={48} c1="var(--foreground)" c2="#F26B21" subColor="var(--muted-foreground)" />
        <h1 className="text-2xl font-bold">Aguardando liberação</h1>
        <p className="text-muted-foreground">Sua conta ({profile?.email}) existe, mas a gestão ainda não definiu o seu acesso. Avise o responsável e toque em “Verificar de novo”.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void refreshProfile()}>Verificar de novo</Button>
          <Button variant="outline" onClick={() => void signOut()}>Sair</Button>
        </div>
      </div>
    </div>
  )
}
