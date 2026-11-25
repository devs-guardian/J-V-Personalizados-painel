import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { useAgora } from '@/hooks/use-agora'
import { estaAtrasado } from '@/lib/prazo'
import { ATRASADO, PEDIDO_STATUS } from '@/lib/status'
import type { Pedido } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Aviso de "sem dados": ícone, título, explicação e, se fizer sentido, uma ação. */
export function EmptyState({
  icon: Icon, title, children, action, className,
}: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <Empty className={cn('border bg-card', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon aria-hidden /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}

export function Loading() {
  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Spinner /></EmptyMedia>
        <EmptyTitle>Carregando…</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}

/** Cartão que envolve uma tabela, sem espaçamento nas bordas. */
export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn('gap-0 py-0 [&_td]:px-3 [&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td]:py-3 [&_td]:align-top [&_th]:bg-muted [&_th]:px-3 [&_th]:text-xs [&_th]:text-muted-foreground', className)}>
      {children}
    </Card>
  )
}

export function KpiCard({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <Card>
      <CardContent>
        <div className="text-[13px] text-muted-foreground">{label}</div>
        <div className={cn('mt-1.5 font-heading text-3xl font-bold tracking-tight', className)}>{value}</div>
      </CardContent>
    </Card>
  )
}

/** Status do pedido; em produção com o prazo vencido aparece como "Atrasado". */
export function StatusBadge({ pedido }: { pedido: Pedido }) {
  const agora = useAgora()
  const s = estaAtrasado(pedido, agora) ? ATRASADO : PEDIDO_STATUS[pedido.status]
  return <Badge variant={s.variant}>{s.label}</Badge>
}
