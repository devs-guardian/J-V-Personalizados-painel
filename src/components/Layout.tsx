import { useEffect, useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useReposicoes } from '../lib/queries'
import { Wordmark } from './Wordmark'

const COMERCIAL = [
  ['/comercial', 'Resumo'], ['/comercial/pedidos', 'Pedidos'], ['/comercial/produtos', 'Produtos e preços'],
  ['/comercial/custos', 'Custos e taxas'], ['/comercial/aprovacoes', 'Aprovações'], ['/comercial/usuarios', 'Usuários'],
] as const
const OPERACIONAL = [
  ['/operacional', 'Fila de produção'], ['/operacional/envios', 'Envios'], ['/operacional/estoque', 'Estoque de filamento'], ['/operacional/reposicao', 'Reposição e compras'],
] as const

export function useTheme() {
  const [t, setT] = useState<string>(() => localStorage.getItem('jv-theme') || 'dark')
  useEffect(() => { document.documentElement.dataset.theme = t; localStorage.setItem('jv-theme', t) }, [t])
  return [t, () => setT(t === 'dark' ? 'light' : 'dark')] as const
}

export function Layout({ area }: { area: 'comercial' | 'operacional' }) {
  const { profile, signOut } = useAuth()
  const qc = useQueryClient()
  const loc = useLocation()
  const [theme, toggle] = useTheme()
  const reps = useReposicoes()
  const pend = (reps.data ?? []).filter((r) => r.status === 'pendente').length

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

  const gestao = profile?.role === 'gestao'
  if (area === 'comercial' && !gestao) return <Navigate to="/operacional" replace />
  const items = area === 'comercial' ? COMERCIAL : OPERACIONAL

  return (
    <div className="app">
      <nav className="side">
        <div style={{ padding: '0 8px 18px' }}><Wordmark size={34} /></div>
        {gestao && (
          <>
            <div className="grp">ÁREA</div>
            <NavLink to="/comercial" className={`nav ${area === 'comercial' ? 'on' : ''}`} end={false}>Comercial</NavLink>
            <NavLink to="/operacional" className={`nav ${area === 'operacional' ? 'on' : ''}`} end={false}>Operacional</NavLink>
          </>
        )}
        <div className="grp">{area === 'comercial' ? 'COMERCIAL' : 'OPERACIONAL'}</div>
        {items.map(([to, label]) => (
          <NavLink key={to} to={to} end className={({ isActive }) => `nav ${isActive ? 'on' : ''}`}>
            {label}
            {label === 'Aprovações' && pend > 0 && <span className="badge">{pend}</span>}
          </NavLink>
        ))}
        <button className="btn s" style={{ marginTop: 12, background: 'transparent', color: 'var(--nvt)', borderColor: '#3A4A72' }} onClick={toggle}>
          Tema {theme === 'dark' ? 'claro' : 'escuro'}
        </button>
        <div className="me">
          <div className="av">{(profile?.nome || profile?.email || '?').slice(0, 1).toUpperCase()}</div>
          <div className="who" style={{ lineHeight: 1.25 }}>
            <b>{profile?.nome}</b>
            <div style={{ color: 'var(--nvt)', fontSize: 12 }}>{gestao ? 'Gestão' : 'Operacional'}</div>
          </div>
          <button onClick={() => void signOut()}>Sair</button>
        </div>
      </nav>
      <main className="main" key={loc.pathname}><Outlet /></main>
    </div>
  )
}
