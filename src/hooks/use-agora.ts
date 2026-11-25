import { useEffect, useState } from 'react'

/** Hora atual, atualizada sozinha para os prazos mudarem sem recarregar a tela. */
export function useAgora(intervalo = 15_000) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const atualizar = () => setAgora(Date.now())
    const id = setInterval(atualizar, intervalo)
    // abas em segundo plano atrasam o timer: atualiza ao voltar
    document.addEventListener('visibilitychange', atualizar)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', atualizar) }
  }, [intervalo])
  return agora
}
