import type { MouseEvent } from 'react'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { POR_PAGINA, type usePagination } from '@/hooks/use-pagination'
import { cn } from '@/lib/utils'

/** Números a mostrar: primeira, última e vizinhas da atual; `null` vira reticências. */
function numeros(atual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (atual <= 4) return [1, 2, 3, 4, 5, null, total]
  if (atual >= total - 3) return [1, null, total - 4, total - 3, total - 2, total - 1, total]
  return [1, null, atual - 1, atual, atual + 1, null, total]
}

type Props = Omit<ReturnType<typeof usePagination>, 'itens'> & { itens?: unknown[]; className?: string }

/** Rodapé de paginação; não aparece quando tudo cabe em uma página. */
export function Pager({ pagina, totalPaginas, total, irPara, className }: Props) {
  if (totalPaginas <= 1) return null
  const ir = (n: number) => (e: MouseEvent) => {
    e.preventDefault()
    if (n >= 1 && n <= totalPaginas) irPara(n)
  }
  const bloqueado = (sim: boolean) => (sim ? { 'aria-disabled': true, tabIndex: -1, className: 'pointer-events-none opacity-50' } : {})

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2', className)}>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total}
      </p>
      <Pagination aria-label="Paginação" className="mx-0 w-auto">
        <PaginationContent className="flex-wrap">
          <PaginationItem>
            <PaginationPrevious href="#" text="Anterior" aria-label="Página anterior" onClick={ir(pagina - 1)} {...bloqueado(pagina === 1)} />
          </PaginationItem>
          {numeros(pagina, totalPaginas).map((n, i) => (
            <PaginationItem key={n ?? `r${i}`}>
              {n === null ? <PaginationEllipsis /> : (
                <PaginationLink href="#" size="icon-sm" isActive={n === pagina} className="data-[active=true]:border-primary data-[active=true]:text-primary" aria-label={`Página ${n}`} onClick={ir(n)}>{n}</PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext href="#" text="Próxima" aria-label="Próxima página" onClick={ir(pagina + 1)} {...bloqueado(pagina === totalPaginas)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
