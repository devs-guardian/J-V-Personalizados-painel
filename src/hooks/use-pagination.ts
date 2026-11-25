import { useState } from 'react'

export const POR_PAGINA = 10

/** Pagina uma lista já carregada. `chave` volta para a página 1 quando muda (ex.: filtro). */
export function usePagination<T>(lista: T[], chave = '') {
  const [estado, setEstado] = useState({ chave, pagina: 1 })
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  // se a lista encolher (exclusão, mudança de status), fica na última página que existe
  const pagina = estado.chave === chave ? Math.min(estado.pagina, totalPaginas) : 1
  // o filtro mudou: esquece a página antiga, para que voltar ao filtro anterior também comece na 1
  if (estado.chave !== chave) setEstado({ chave, pagina: 1 })
  const inicio = (pagina - 1) * POR_PAGINA
  return {
    itens: lista.slice(inicio, inicio + POR_PAGINA),
    pagina,
    totalPaginas,
    total: lista.length,
    irPara: (n: number) => setEstado({ chave, pagina: n }),
  }
}
