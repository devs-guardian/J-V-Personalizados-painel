import { useEffect } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useReposicoes } from '@/lib/queries'
import { useTheme } from '@/hooks/use-theme'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar'
import { Wordmark } from './Wordmark'

const COMERCIAL = [
  ['/comercial', 'Resumo'], ['/comercial/pedidos', 'Pedidos'], ['/comercial/produtos', 'Produtos e preços'],
  ['/comercial/custos', 'Custos e taxas'], ['/comercial/aprovacoes', 'Aprovações'], ['/comercial/usuarios', 'Usuários'],
] as const
const OPERACIONAL = [
  ['/operacional', 'Fila de produção'], ['/operacional/envios', 'Envios'], ['/operacional/estoque', 'Estoque de filamento'], ['/operacional/reposicao', 'Reposição e compras'],
] as const

type Area = 'comercial' | 'operacional'

function NavItem({ to, label, active, badge }: { to: string; label: string; active: boolean; badge?: number }) {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} className="h-10 px-3 font-medium">
        <Link to={to} onClick={() => setOpenMobile(false)} aria-current={active ? 'page' : undefined}><span>{label}</span></Link>
      </SidebarMenuButton>
      {!!badge && <SidebarMenuBadge className="top-2.5! rounded-full bg-sidebar-primary px-2 text-sidebar-primary-foreground!">{badge}</SidebarMenuBadge>}
    </SidebarMenuItem>
  )
}

function Menu({ area }: { area: Area }) {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const [theme, toggle] = useTheme()
  const reps = useReposicoes()
  const pend = (reps.data ?? []).filter((r) => r.status === 'pendente').length
  const gestao = profile?.role === 'gestao'
  const items = area === 'comercial' ? COMERCIAL : OPERACIONAL

  return (
    <Sidebar>
      <SidebarHeader className="px-5 pt-6 pb-2"><Wordmark size={34} /></SidebarHeader>
      <SidebarContent className="px-2">
        {gestao && (
          <SidebarGroup>
            <SidebarGroupLabel className="tracking-widest uppercase">Área</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>
              <NavItem to="/comercial" label="Comercial" active={area === 'comercial'} />
              <NavItem to="/operacional" label="Operacional" active={area === 'operacional'} />
            </SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel className="tracking-widest uppercase">{area === 'comercial' ? 'Comercial' : 'Operacional'}</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>
            {items.map(([to, label]) => (
              <NavItem key={to} to={to} label={label} active={pathname.replace(/\/$/, '') === to} badge={label === 'Aprovações' ? pend : undefined} />
            ))}
          </SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 p-4">
        <Button variant="ghost" size="sm" className="justify-start border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:bg-sidebar-accent" onClick={toggle}>
          {theme === 'dark' ? <Sun /> : <Moon />}Tema {theme === 'dark' ? 'claro' : 'escuro'}
        </Button>
        <div className="flex items-center gap-2.5 rounded-xl bg-sidebar-accent p-2.5 text-sidebar-accent-foreground">
          <Avatar>
            <AvatarFallback className="bg-sidebar-primary font-bold text-sidebar-primary-foreground">
              {(profile?.nome || profile?.email || '?').slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-semibold">{profile?.nome}</div>
            <div className="text-xs text-sidebar-foreground">{gestao ? 'Gestão' : 'Operacional'}</div>
          </div>
          <Button variant="ghost" size="icon-sm" className="hover:bg-sidebar hover:text-sidebar-accent-foreground dark:hover:bg-sidebar" onClick={() => void signOut()} aria-label="Sair" title="Sair">
            <LogOut />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export function Layout({ area }: { area: Area }) {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const loc = useLocation()

  // tempo real: qualquer mudança nas tabelas atualiza as telas abertas
  useEffect(() => {
    const ch = supabase.channel('jv-realtime')
    const map: Record<string, string> = { pedidos: 'pedidos', pedido_itens: 'pedidos', filamentos: 'filamentos', reposicoes: 'reposicoes', capacidade: 'capacidade' }
    Object.entries(map).forEach(([table, key]) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => qc.invalidateQueries({ queryKey: [key] })),
    )
    ch.subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [qc])

  if (area === 'comercial' && profile?.role !== 'gestao') return <Navigate to="/operacional" replace />

  return (
    <SidebarProvider>
      <Menu area={area} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-3 py-2 md:hidden">
          <SidebarTrigger />
          <Wordmark size={22} c1="var(--foreground)" sub={false} />
        </header>
        <div className="px-4 pt-5 pb-16 md:px-9 md:pt-7" key={loc.pathname}><Outlet /></div>
      </SidebarInset>
    </SidebarProvider>
  )
}
